/**
 * 🔵 VACCINATION SERVICE
 * - Business logic for immunization management
 * - Orchestrates repository calls
 * - Due date calculations
 * - Overdue status determination
 * - Caching with versioning
 * - Comprehensive error handling
 * - Transaction integrity
 */

import { randomUUID } from 'node:crypto';

import { logger } from '@naroto/logger';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';
import z from 'zod';

import type { Prisma } from '../../generated/browser';
import type { PrismaClient } from '../../generated/client';
import { prisma, ValidationError } from '..';
import { AppError, ConflictError, NotFoundError } from '../error';
import * as patientRepo from '../repositories/patient.repo';
import * as staffRepo from '../repositories/staff.repo';
import * as vaccinationRepo from '../repositories/vac.repository';
import type { ImmunizationStatus } from '../types';
import { cacheService } from './cache.service';
// ==================== INTERFACES & TYPES ====================

export interface ImmunizationInput {
  administeredById?: string | null;
  batchNumber?: string | null;
  date: Date;
  dose?: string | null;
  expirationDate?: Date | null;
  manufacturer?: string | null;
  medicalRecordId?: string | null;
  nextDoseDate?: Date | null;
  notes?: string | null;
  patientId: string;
  route?: string | null;
  site?: string | null;
  vaccine: string;
}

export interface ImmunizationReminder {
  daysOverdue: number;
  daysUntilDue: number;
  dueDate: Date;
  immunizationId: string;
  isOverdue: boolean;
  parentContact?: string | null;
  patientDateOfBirth: Date;
  patientId: string;
  patientName: string;
  vaccine: string;
}

export interface DueVaccineResult {
  ageInDaysMax: number | null;
  ageInDaysMin: number;
  daysUntilDue: number;
  doseNumber?: number | null;
  dueDate: Date;
  isMandatory: boolean | null;
  isOverdue: boolean;
  notes?: string | null;
  vaccineName: string;
}

export interface PatientDueVaccinesResponse {
  dueVaccines: DueVaccineResult[];
  overdueCount: number;
  patient: {
    id: string;
    name: string;
    ageInDays: number;
    ageInMonths: number;
  };
  totalDue: number;
}

export interface UpcomingImmunizationsResponse {
  immunizations: Array<{
    id: string;
    vaccine: string;
    date: Date;
    status: ImmunizationStatus;
    daysUntilDue: number;
    patient: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      dateOfBirth: Date;
    };
  }>;
  summary: {
    total: number;
    dueToday: number;
    dueThisWeek: number;
    dueThisMonth: number;
  };
}

export interface OverdueImmunizationsResponse {
  immunizations: Array<{
    id: string;
    vaccine: string;
    date: Date;
    status: ImmunizationStatus;
    daysOverdue: number;
    severity: 'mild' | 'moderate' | 'critical';
    patient: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      dateOfBirth: Date;
    };
  }>;
  summary: {
    total: number;
    critical: number;
    moderate: number;
    mild: number;
  };
}

export interface ClinicVaccinationStats {
  averagePerPatient: number;
  completed: number;
  completionRate: number;
  coverageRate: number;
  overdue: number;
  patientsCount: number;
  pending: number;
  total: number;
}

// ==================== SERVICE CLASS ====================

export class VaccinationService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';

  constructor(private readonly db: typeof prisma = prisma) {}

  // ==================== READ OPERATIONS ====================

  /**
   * Get immunization by ID
   */
  async getImmunizationById(id: string, clinicId?: string) {
    // Validate input
    const validatedId = z.uuid().parse(id);

    const cacheKey = CACHE_KEYS.IMMUNIZATION(validatedId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const immunization = await vaccinationRepo.findImmunizationById(this.db, validatedId);

      // Verify clinic access if provided
      if (clinicId && immunization?.patient?.clinicId !== clinicId) {
        return null;
      }

      if (!immunization) {
        throw new NotFoundError('Immunization', validatedId);
      }

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, immunization, CACHE_TTL.IMMUNIZATION);
      }

      return immunization;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get immunization', { error, id: validatedId });
      throw new AppError('Failed to retrieve immunization record', {
        code: 'IMMUNIZATION_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get patient immunizations
   */
  async getPatientImmunizations(
    patientId: string,
    clinicId: string,
    options?: {
      includeCompleted?: boolean;
      limit?: number;
      offset?: number;
    }
  ) {
    // Validate inputs
    const validatedPatientId = z.uuid().parse(patientId);
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.PATIENT_IMMUNIZATIONS(
      validatedPatientId
      // options?.includeCompleted ? 'all' : 'pending'
    );

    try {
      // Verify patient exists and belongs to clinic
      const patient = await patientRepo.getPatientById(this.db, validatedPatientId, validatedClinicId);
      if (!patient) {
        throw new NotFoundError('Patient', validatedPatientId);
      }

      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const immunizations = await vaccinationRepo.findImmunizationsByPatient(this.db, validatedPatientId, {
        includeCompleted: options?.includeCompleted,
        limit: options?.limit,
        offset: options?.offset
      });

      const total = await vaccinationRepo.countImmunizationsByPatient(this.db, validatedPatientId);

      // Calculate coverage percentage
      const completed = immunizations.filter(i => i.status === 'COMPLETED').length;
      const coverage = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Get upcoming due dates
      const upcoming = immunizations
        .filter(i => i.status === 'PENDING' && new Date(i.date) > new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const result = {
        immunizations,
        total,
        completed,
        pending: total - completed,
        coverage,
        nextDue: upcoming[0] || null,
        upcomingCount: upcoming.length
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.PATIENT_IMMUNIZATIONS);
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get patient immunizations', { error, patientId: validatedPatientId });
      throw new AppError('Failed to retrieve immunization records', {
        code: 'IMMUNIZATION_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get clinic immunizations
   */
  async getClinicImmunizations(
    clinicId: string,
    options?: {
      status?: ImmunizationStatus;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.CLINIC_IMMUNIZATIONS(
      validatedClinicId
      // options?.status || 'all',
      // options?.startDate?.toISOString() || '',
      // options?.endDate?.toISOString() || ''
    );

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const immunizations = await vaccinationRepo.findImmunizationsByClinic(this.db, validatedClinicId, options);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, immunizations, CACHE_TTL.CLINIC_IMMUNIZATIONS);
      }

      return immunizations;
    } catch (error) {
      logger.error('Failed to get clinic immunizations', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve immunization records', {
        code: 'IMMUNIZATION_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get upcoming immunizations
   */
  async getUpcomingImmunizations(
    clinicId: string,
    daysAhead = 30,
    limit?: number
  ): Promise<UpcomingImmunizationsResponse> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedDaysAhead = z.number().int().min(1).max(365).parse(daysAhead);

    const cacheKey = CACHE_KEYS.UPCOMING_IMMUNIZATIONS(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as UpcomingImmunizationsResponse;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + validatedDaysAhead);

      const immunizations = await vaccinationRepo.findUpcomingImmunizations(
        this.db,
        validatedClinicId,
        { startDate: today, endDate: futureDate },
        { limit }
      );

      // Enhance with calculated fields
      const enhanced = immunizations.map(imm => ({
        ...imm,
        status: imm.status ?? ('PENDING' as ImmunizationStatus),
        daysUntilDue: Math.ceil((new Date(imm.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      })) as UpcomingImmunizationsResponse['immunizations'];

      const result: UpcomingImmunizationsResponse = {
        immunizations: enhanced,
        summary: {
          total: enhanced.length,
          dueToday: enhanced.filter(i => i.daysUntilDue === 0).length,
          dueThisWeek: enhanced.filter(i => i.daysUntilDue <= 7).length,
          dueThisMonth: enhanced.length
        }
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.IMMUNIZATIONS);
      }

      return result;
    } catch (error) {
      logger.error('Failed to get upcoming immunizations', { error, clinicId: validatedClinicId, daysAhead });
      throw new AppError('Failed to retrieve upcoming immunizations', {
        code: 'IMMUNIZATION_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get overdue immunizations
   */
  async getOverdueImmunizations(
    clinicId: string,
    daysOverdue?: number,
    limit?: number
  ): Promise<OverdueImmunizationsResponse> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.OVERDUE_IMMUNIZATIONS(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as OverdueImmunizationsResponse;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const cutoffDate = new Date(today);
      if (daysOverdue !== undefined) {
        cutoffDate.setDate(today.getDate() - daysOverdue);
      }

      const immunizations = await vaccinationRepo.findOverdueImmunizations(this.db, validatedClinicId, cutoffDate, {
        limit
      });

      // Enhance with calculated fields
      const enhanced = immunizations.map(imm => ({
        id: imm.id,
        vaccine: imm.vaccine,
        date: imm.date,
        status: imm.status ?? ('PENDING' as ImmunizationStatus),
        daysOverdue: Math.ceil((today.getTime() - new Date(imm.date).getTime()) / (1000 * 60 * 60 * 24)),
        severity: this.calculateOverdueSeverity(new Date(imm.date)),
        patient: imm.patient
      })) as OverdueImmunizationsResponse['immunizations'];

      const result: OverdueImmunizationsResponse = {
        immunizations: enhanced,
        summary: {
          total: enhanced.length,
          critical: enhanced.filter(i => i.severity === 'critical').length,
          moderate: enhanced.filter(i => i.severity === 'moderate').length,
          mild: enhanced.filter(i => i.severity === 'mild').length
        }
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.IMMUNIZATIONS);
      }

      return result;
    } catch (error) {
      logger.error('Failed to get overdue immunizations', { error, clinicId: validatedClinicId, daysOverdue });
      throw new AppError('Failed to retrieve overdue immunizations', {
        code: 'IMMUNIZATION_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Generate reminders for upcoming and overdue immunizations
   */
  async generateReminders(
    clinicId: string,
    options?: {
      daysAhead?: number;
      includeOverdue?: boolean;
      limit?: number;
    }
  ): Promise<ImmunizationReminder[]> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const daysAhead = options?.daysAhead || 30;
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + daysAhead);

      // Get upcoming immunizations
      const upcoming = await vaccinationRepo.findImmunizationsByDateRange(
        this.db,
        validatedClinicId,
        { startDate: today, endDate: futureDate },
        { status: 'PENDING', limit: options?.limit }
      );

      // Get overdue immunizations if requested
      let overdue: Awaited<ReturnType<typeof vaccinationRepo.findImmunizationsByDateRange>> = [];
      if (options?.includeOverdue) {
        overdue = await vaccinationRepo.findImmunizationsByDateRange(
          this.db,
          validatedClinicId,
          { startDate: new Date(0), endDate: today },
          { status: 'PENDING', limit: options?.limit }
        );
      }

      const allImmunizations = [...upcoming, ...overdue];

      // Get patient contact info (in a real app, you'd fetch this from patient records)
      const reminders: ImmunizationReminder[] = await Promise.all(
        allImmunizations.map(async imm => {
          const dueDate = new Date(imm.date);
          const daysUntilDue =
            dueDate > today
              ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              : -Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          const isOverdue = dueDate < today;

          return {
            immunizationId: imm.id,
            patientId: imm.patient.id,
            patientName: `${imm.patient.firstName || ''} ${imm.patient.lastName || ''}`.trim(),
            patientDateOfBirth: imm.patient.dateOfBirth,
            vaccine: imm.vaccine,
            dueDate,
            daysUntilDue: Math.abs(daysUntilDue),
            isOverdue,
            daysOverdue: isOverdue ? Math.abs(daysUntilDue) : 0,
            // This would come from patient records in a real app
            parentContact: null
          };
        })
      );

      // Sort by due date (closest first)
      return reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    } catch (error) {
      logger.error('Failed to generate reminders', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to generate immunization reminders', {
        code: 'REMINDER_GENERATION_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== VACCINE SCHEDULE SERVICES ====================

  /**
   * Get vaccine schedule
   */
  async getVaccineSchedule(options?: {
    ageMonths?: number;
    isMandatory?: boolean;
    vaccineName?: string;
    limit?: number;
  }) {
    const cacheKey = CACHE_KEYS.VACCINE_SCHEDULE(
      options?.ageMonths?.toString() || 'all',
      options?.vaccineName || 'all'
    );

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const schedule = await vaccinationRepo.findVaccineSchedule(this.db, options);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, schedule, CACHE_TTL.VACCINE_SCHEDULE);
      }

      return schedule;
    } catch (error) {
      logger.error('Failed to get vaccine schedule', { error, options });
      throw new AppError('Failed to retrieve vaccine schedule', {
        code: 'VACCINE_SCHEDULE_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get due vaccines for a patient
   */
  async getDueVaccinesForPatient(patientId: string, clinicId: string): Promise<PatientDueVaccinesResponse> {
    // Validate inputs
    const validatedPatientId = z.uuid().parse(patientId);
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.PATIENT_DUE_VACCINES(validatedPatientId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as PatientDueVaccinesResponse;
      }

      // Get patient details
      const patient = await patientRepo.getPatientById(this.db, validatedPatientId, validatedClinicId);
      if (!patient?.dateOfBirth) {
        throw new NotFoundError('Patient', validatedPatientId);
      }

      // Calculate patient's age
      const today = new Date();
      const ageInDays = Math.floor((today.getTime() - patient.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

      // Get all vaccines from schedule
      const allVaccines = await vaccinationRepo.findVaccineSchedule(this.db);

      // Get already administered vaccines
      const administered = await vaccinationRepo.findImmunizationsByPatient(this.db, validatedPatientId, {
        includeCompleted: true
      });

      const administeredSet = new Set(
        administered.filter(i => i.status === 'COMPLETED').map(i => `${i.vaccine}-${i.dose || 1}`)
      );

      // Determine due vaccines
      const dueVaccines = allVaccines.filter(vaccine => {
        // Check if patient is old enough for this vaccine
        if (ageInDays < (vaccine.ageInDaysMin || 0)) return false;

        // Check if already administered
        const key = `${vaccine.vaccineName}-${vaccine.dosesRequired || 1}`;
        if (administeredSet.has(key)) return false;

        // Check if not too old (if max age exists)
        if (vaccine.ageInDaysMax && ageInDays > vaccine.ageInDaysMax) return false;

        return true;
      });

      // Calculate due dates
      const withDueDates: DueVaccineResult[] = dueVaccines.map(vaccine => {
        const dueDate = new Date(patient.dateOfBirth);
        dueDate.setDate(dueDate.getDate() + (vaccine.ageInDaysMin || 0));

        return {
          vaccineName: vaccine.vaccineName,
          doseNumber: vaccine.dosesRequired,
          ageInDaysMin: vaccine.ageInDaysMin || 0,
          ageInDaysMax: vaccine.ageInDaysMax,
          dueDate,
          isOverdue: dueDate < today,
          daysUntilDue: Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
          isMandatory: vaccine.isMandatory
        };
      });

      const result: PatientDueVaccinesResponse = {
        patient: {
          id: patient.id,
          name: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
          ageInDays,
          ageInMonths: Math.floor(ageInDays / 30.44)
        },
        dueVaccines: withDueDates.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
        totalDue: withDueDates.length,
        overdueCount: withDueDates.filter(v => v.isOverdue).length
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.PATIENT_DUE_VACCINES);
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get due vaccines for patient', { error, patientId: validatedPatientId });
      throw new AppError('Failed to determine due vaccines', {
        code: 'DUE_VACCINES_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== STATISTICS SERVICES ====================

  /**
   * Get clinic vaccination statistics
   */
  async getClinicVaccinationStats(clinicId: string): Promise<ClinicVaccinationStats> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.CLINIC_VACCINATION_STATS(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as ClinicVaccinationStats;
      }

      const [totalImmunizations, completedImmunizations, pendingImmunizations, totalPatients] = await Promise.all([
        vaccinationRepo.countImmunizationsByClinic(this.db, validatedClinicId),
        vaccinationRepo.countImmunizationsByStatus(this.db, validatedClinicId, 'COMPLETED'),
        vaccinationRepo.countImmunizationsByStatus(this.db, validatedClinicId, 'PENDING'),
        patientRepo.countActivePatients(this.db, validatedClinicId)
      ]);

      // Get overdue count
      const today = new Date();
      const overdue = await vaccinationRepo.findImmunizationsByDateRange(
        this.db,
        validatedClinicId,
        { startDate: new Date(0), endDate: today },
        { status: 'PENDING' }
      );
      const overdueCount = overdue.length;

      // Calculate coverage rate (assuming ~10 vaccines per child on average)
      const coverageRate = totalPatients > 0 ? Math.round((completedImmunizations / (totalPatients * 10)) * 100) : 0;

      const result: ClinicVaccinationStats = {
        total: totalImmunizations,
        completed: completedImmunizations,
        pending: pendingImmunizations,
        overdue: overdueCount,
        completionRate: totalImmunizations > 0 ? Math.round((completedImmunizations / totalImmunizations) * 100) : 0,
        coverageRate,
        patientsCount: totalPatients,
        averagePerPatient: totalPatients > 0 ? Math.round((totalImmunizations / totalPatients) * 10) / 10 : 0
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.CLINIC_STATS);
      }

      return result;
    } catch (error) {
      logger.error('Failed to get clinic vaccination stats', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve vaccination statistics', {
        code: 'STATS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== WRITE OPERATIONS ====================

  /**
   * Record an immunization
   */
  async recordImmunization(input: ImmunizationInput, clinicId: string, administeredById?: string) {
    // Validate input
    const validatedInput = this.validateImmunizationInput(input);
    const validatedClinicId = z.uuid().parse(clinicId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify patient exists and belongs to clinic
          const patient = await patientRepo.getPatientById(
            tx as unknown as PrismaClient,
            validatedInput.patientId,
            validatedClinicId
          );
          if (!patient) {
            throw new NotFoundError('Patient', validatedInput.patientId);
          }

          // Verify staff exists if provided
          const adminId = administeredById || validatedInput.administeredById;
          if (adminId) {
            const staff = await staffRepo.findStaffById(tx as unknown as PrismaClient, adminId, validatedClinicId);
            if (!staff) {
              throw new NotFoundError('Staff', adminId);
            }
          }

          // Check for duplicate vaccination
          const duplicate = await vaccinationRepo.checkDuplicateVaccination(
            tx as unknown as PrismaClient,
            validatedInput.patientId,
            validatedInput.vaccine,
            validatedInput.date
          );

          if (duplicate) {
            throw new ConflictError('A vaccination with this vaccine already exists on this date');
          }

          // Calculate overdue status
          const today = new Date();
          const isOverDue = validatedInput.date < today;
          const daysOverDue = isOverDue
            ? Math.ceil((today.getTime() - validatedInput.date.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          const now = new Date();
          const immunization = await vaccinationRepo.createImmunization(tx as unknown as PrismaClient, {
            id: randomUUID(),
            ...validatedInput,
            administeredById: adminId || null,
            status: 'PENDING' as ImmunizationStatus,
            isOverDue,
            daysOverDue,
            createdAt: now,
            updatedAt: now
          });

          logger.info('Immunization recorded', {
            immunizationId: immunization.id,
            patientId: validatedInput.patientId,
            vaccine: validatedInput.vaccine
          });

          return immunization;
        } catch (error) {
          logger.error('Failed to record immunization', { error, input: validatedInput });
          throw error;
        }
      })
      .then(async immunization => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await this.invalidateImmunizationCaches(immunization.id, {
            patientId: validatedInput.patientId,
            clinicId: validatedClinicId
          });
        }

        return immunization;
      });
  }

  /**
   * Record bulk immunizations
   */
  async recordBulkImmunizations(inputs: ImmunizationInput[], clinicId: string) {
    // Validate inputs
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedInputs = inputs.map(input => this.validateImmunizationInput(input));

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        const results = [];
        const errors = [];

        for (const input of validatedInputs) {
          try {
            // Verify each patient
            const patient = await patientRepo.getPatientById(
              tx as unknown as PrismaClient,
              input.patientId,
              validatedClinicId
            );
            if (!patient) {
              errors.push({ input, error: 'Patient not found' });
              continue;
            }

            const now = new Date();
            const today = new Date();
            const isOverDue = input.date < today;
            const daysOverDue = isOverDue
              ? Math.ceil((today.getTime() - input.date.getTime()) / (1000 * 60 * 60 * 24))
              : 0;

            const immunization = await vaccinationRepo.createImmunization(tx as unknown as PrismaClient, {
              id: randomUUID(),
              ...input,
              status: 'PENDING' as ImmunizationStatus,
              isOverDue,
              daysOverDue,
              createdAt: now,
              updatedAt: now
            });

            results.push(immunization);
          } catch (err) {
            errors.push({
              input,
              error: err instanceof Error ? err.message : 'Unknown error'
            });
          }
        }

        logger.info('Bulk immunizations recorded', {
          successCount: results.length,
          errorCount: errors.length
        });

        return { results, errors };
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches for all affected patients
        if (this.CACHE_ENABLED && result.results.length > 0) {
          const patientIds = [...new Set(validatedInputs.map(i => i.patientId))];
          await Promise.all([
            ...patientIds.map(id => cacheService.invalidatePatientCaches(id, validatedClinicId)),
            cacheService.invalidateClinicCaches(validatedClinicId)
          ]);
        }

        return result;
      });
  }

  /**
   * Update immunization status
   */
  async updateImmunizationStatus(id: string, clinicId: string, status: ImmunizationStatus, administeredById?: string) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedStatus = z.enum(['PENDING', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).parse(status);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify immunization exists and belongs to clinic
          const immunization = await vaccinationRepo.checkImmunizationExists(
            tx as unknown as PrismaClient,
            validatedId
          );
          if (!immunization || immunization.patient?.clinicId !== validatedClinicId) {
            throw new NotFoundError('Immunization', validatedId);
          }

          if (administeredById) {
            const staff = await staffRepo.findStaffById(
              tx as unknown as PrismaClient,
              administeredById,
              validatedClinicId
            );
            if (!staff) {
              throw new NotFoundError('Staff', administeredById);
            }
          }

          const updated = await vaccinationRepo.updateImmunizationStatus(
            tx as unknown as PrismaClient,
            validatedId,
            validatedStatus as ImmunizationStatus,
            administeredById ? { administeredById } : undefined
          );

          logger.info('Immunization status updated', { immunizationId: validatedId, status: validatedStatus });

          return updated;
        } catch (error) {
          logger.error('Failed to update immunization status', { error, id: validatedId, status: validatedStatus });
          throw error;
        }
      })
      .then(async updated => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          const immunization = await vaccinationRepo.findImmunizationById(this.db, validatedId);
          if (immunization) {
            await this.invalidateImmunizationCaches(validatedId, {
              patientId: immunization.patientId,
              clinicId: validatedClinicId
            });
          }
        }

        return updated;
      });
  }

  /**
   * Update an immunization
   */
  async updateImmunization(id: string, clinicId: string, data: Partial<ImmunizationInput>) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedData = this.validatePartialImmunizationInput(data);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify immunization exists and belongs to clinic
          const existing = await vaccinationRepo.checkImmunizationExists(tx as unknown as PrismaClient, validatedId);
          if (!existing || existing.patient?.clinicId !== validatedClinicId) {
            throw new NotFoundError('Immunization', validatedId);
          }

          // Recalculate overdue status if date changed
          let isOverDue: boolean | undefined;
          let daysOverDue: number | undefined;

          if (validatedData.date) {
            const today = new Date();
            isOverDue = validatedData.date < today;
            daysOverDue = isOverDue
              ? Math.ceil((today.getTime() - validatedData.date.getTime()) / (1000 * 60 * 60 * 24))
              : 0;
          }

          const now = new Date();
          const updated = await vaccinationRepo.updateImmunization(tx as unknown as PrismaClient, validatedId, {
            ...validatedData,
            isOverDue,
            daysOverDue,
            updatedAt: now
          });

          logger.info('Immunization updated', { immunizationId: validatedId });

          return updated;
        } catch (error) {
          logger.error('Failed to update immunization', { error, id: validatedId });
          throw error;
        }
      })
      .then(async updated => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          const immunization = await vaccinationRepo.findImmunizationById(this.db, validatedId);
          if (immunization) {
            await this.invalidateImmunizationCaches(validatedId, {
              patientId: immunization.patientId,
              clinicId: validatedClinicId
            });
          }
        }

        return updated;
      });
  }

  /**
   * Delete an immunization
   */
  async deleteImmunization(id: string, clinicId: string, permanent = false) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify immunization exists and belongs to clinic
          const immunization = await vaccinationRepo.checkImmunizationExists(
            tx as unknown as PrismaClient,
            validatedId
          );
          if (!immunization || immunization.patient?.clinicId !== validatedClinicId) {
            throw new NotFoundError('Immunization', validatedId);
          }

          let result;
          if (permanent) {
            // For permanent delete, we need to actually delete
            // Since we don't have a hard delete in repo, we'll use update with isDeleted
            result = await vaccinationRepo.softDeleteImmunization(tx as unknown as PrismaClient, validatedId, {
              isDeleted: true,
              deletedAt: new Date(),
              updatedAt: new Date()
            });
          } else {
            result = await vaccinationRepo.softDeleteImmunization(tx as unknown as PrismaClient, validatedId, {
              isDeleted: true,
              deletedAt: new Date(),
              updatedAt: new Date()
            });
          }

          logger.info('Immunization deleted', { immunizationId: validatedId, permanent });

          return result;
        } catch (error) {
          logger.error('Failed to delete immunization', { error, id: validatedId });
          throw error;
        }
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          const immunization = await vaccinationRepo.findImmunizationById(this.db, validatedId);
          if (immunization) {
            await this.invalidateImmunizationCaches(validatedId, {
              patientId: immunization.patientId,
              clinicId: validatedClinicId
            });
          }
        }

        return result;
      });
  }

  // ==================== VALIDATION SERVICES ====================

  /**
   * Validate an immunization record
   */
  async validateImmunizationRecord(patientId: string, vaccine: string, date: Date, clinicId: string) {
    // Validate inputs
    const validatedPatientId = z.uuid().parse(patientId);
    const validatedVaccine = z.string().min(1).max(100).parse(vaccine);
    const validatedDate = z.date().parse(date);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      // Verify patient
      const patient = await patientRepo.getPatientById(this.db, validatedPatientId, validatedClinicId);
      if (!patient) {
        return { valid: false, error: 'Patient not found' };
      }

      // Check if vaccine exists in schedule
      const vaccineSchedule = await vaccinationRepo.findVaccineSchedule(this.db, {
        vaccineName: validatedVaccine
      });

      if (vaccineSchedule.length === 0) {
        return { valid: false, error: 'Vaccine not found in schedule' };
      }

      // Check for duplicate
      const duplicate = await vaccinationRepo.checkDuplicateVaccination(
        this.db,
        validatedPatientId,
        validatedVaccine,
        validatedDate
      );

      if (duplicate) {
        return { valid: false, error: 'Duplicate vaccination record exists' };
      }

      // Validate age appropriateness
      if (patient.dateOfBirth) {
        const ageInDays = Math.floor((validatedDate.getTime() - patient.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

        const schedule = vaccineSchedule[0];
        if (ageInDays < (schedule?.ageInDaysMin || 0)) {
          return {
            valid: false,
            error: `Patient is too young for this vaccine. Minimum age: ${Math.floor(
              (schedule?.ageInDaysMin || 0) / 30
            )} months`
          };
        }

        if (schedule?.ageInDaysMax && ageInDays > schedule?.ageInDaysMax) {
          return {
            valid: false,
            error: `Patient is past the recommended age for this vaccine. Maximum age: ${Math.floor(
              schedule.ageInDaysMax / 30
            )} months`
          };
        }
      }

      return { valid: true, schedule: vaccineSchedule[0] };
    } catch (error) {
      logger.error('Failed to validate immunization', { error, patientId, vaccine });
      return { valid: false, error: 'Validation failed' };
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Validate immunization input
   */
  private validateImmunizationInput(input: ImmunizationInput): Required<ImmunizationInput> {
    if (!input.patientId) throw new ValidationError('Patient ID is required');
    if (!input.vaccine) throw new ValidationError('Vaccine name is required');
    if (!input.date) throw new ValidationError('Date is required');

    return {
      patientId: input.patientId,
      vaccine: input.vaccine,
      date: input.date,
      dose: input.dose || null,
      route: input.route || null,
      site: input.site || null,
      manufacturer: input.manufacturer || null,
      batchNumber: input.batchNumber || null,
      expirationDate: input.expirationDate || null,
      notes: input.notes || null,
      administeredById: input.administeredById || null,
      medicalRecordId: input.medicalRecordId || null,
      nextDoseDate: input.nextDoseDate || null
    };
  }

  /**
   * Validate partial immunization input
   */
  private validatePartialImmunizationInput(input: Partial<ImmunizationInput>): Partial<ImmunizationInput> {
    const validated: Partial<ImmunizationInput> = {};

    if (input.patientId !== undefined) validated.patientId = input.patientId;
    if (input.vaccine !== undefined) validated.vaccine = input.vaccine;
    if (input.date !== undefined) validated.date = input.date;
    if (input.dose !== undefined) validated.dose = input.dose;
    if (input.route !== undefined) validated.route = input.route;
    if (input.site !== undefined) validated.site = input.site;
    if (input.manufacturer !== undefined) validated.manufacturer = input.manufacturer;
    if (input.batchNumber !== undefined) validated.batchNumber = input.batchNumber;
    if (input.expirationDate !== undefined) validated.expirationDate = input.expirationDate;
    if (input.notes !== undefined) validated.notes = input.notes;
    if (input.administeredById !== undefined) validated.administeredById = input.administeredById;
    if (input.medicalRecordId !== undefined) validated.medicalRecordId = input.medicalRecordId;
    if (input.nextDoseDate !== undefined) validated.nextDoseDate = input.nextDoseDate;

    return validated;
  }

  /**
   * Calculate overdue severity
   */
  private calculateOverdueSeverity(dueDate: Date): 'mild' | 'moderate' | 'critical' {
    const today = new Date();
    const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue > 90) return 'critical';
    if (daysOverdue > 30) return 'moderate';
    return 'mild';
  }

  /**
   * Invalidate immunization-related caches
   */
  private async invalidateImmunizationCaches(
    immunizationId: string,
    context: {
      patientId: string;
      clinicId: string;
    }
  ): Promise<void> {
    if (!this.CACHE_ENABLED) return;

    const keys = [
      CACHE_KEYS.IMMUNIZATION(immunizationId),
      CACHE_KEYS.PATIENT_IMMUNIZATIONS(context.patientId),
      CACHE_KEYS.PATIENT_IMMUNIZATIONS(context.patientId),
      CACHE_KEYS.PATIENT_DUE_VACCINES(context.patientId),
      CACHE_KEYS.UPCOMING_IMMUNIZATIONS(context.clinicId),
      CACHE_KEYS.OVERDUE_IMMUNIZATIONS(context.clinicId),
      CACHE_KEYS.CLINIC_VACCINATION_STATS(context.clinicId)
    ];

    await cacheService.invalidate(...keys);
    await cacheService.invalidateClinicCaches(context.clinicId);
    await cacheService.invalidatePatientCaches(context.patientId, context.clinicId);
  }
}

// Export singleton instance
export const vaccinationService = new VaccinationService();

// Export service class for testing
export default VaccinationService;
