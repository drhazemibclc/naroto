/**
 * 🔵 PATIENT SERVICE
 * - Business logic for patient management
 * - Orchestrates repository calls
 * - Zod validation for all inputs
 * - Caching with versioning
 * - Comprehensive error handling
 * - Transaction integrity
 */

import { randomUUID } from 'node:crypto';

import type {
  AppointmentStatus,
  Gender,
  Patient as PatientModel,
  Prisma,
  PrismaClient,
  Status
} from '@generated/client';
import { logger } from '@naroto/logger';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';
import { z } from 'zod';

import { prisma } from '../client';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../error';
import * as appointmentRepo from '../repositories/appointment.repo';
import * as patientRepo from '../repositories/patient.repo';
import type { Appointment, Patient } from '../types';
import { processAppointments } from '../utils/helper';
import {
  type CreatePatientInput,
  CreatePatientSchema,
  type GetAllPatientsInput,
  GetAllPatientsSchema,
  type SearchPatientsInput,
  SearchPatientsSchema,
  type UpdatePatientInput,
  UpdatePatientSchema,
  type UpsertPatientInput,
  UpsertPatientSchema
} from '../zodSchemas/patient.schema';
import { cacheService } from './cache.service';

// ==================== TYPE DEFINITIONS ====================

export interface PatientDashboardStats {
  activePrescriptions: number;
  appointmentCounts: Record<string, number>;
  data: Partial<PatientModel>;
  last5Records: Awaited<ReturnType<typeof patientRepo.findPatientDashboardStats>>[1];
  monthlyData: Array<{
    name: string;
    appointment: number;
    completed: number;
  }>;
  totalAppointments: number;
  totalRecords: number;
}

export interface PatientFullData {
  _count?: {
    appointments: number;
    prescriptions: number;
    medicalRecords: number;
  };
  allergies: string | null;
  appointments?: Array<{
    appointmentDate: Date;
    status: string | null;
    doctor: {
      name: string;
      specialty: string | null;
    } | null;
  }>;
  bloodGroup: string | null;
  colorCode: string | null;
  dateOfBirth: Date;
  email: string | null;
  firstName: string;
  gender: Gender;
  id: string;
  image: string | null;
  lastName: string;
  lastVisit: Date | null;
  medicalConditions: string | null;
  phone: string | null;
  status: Status | null;
  totalAppointments: number;
}

export interface PaginatedPatientsResult {
  currentPage: number;
  data: PatientModel[];
  limit: number;
  totalPages: number;
  totalRecords: number;
}

export interface PatientWithDetails {
  activePrescriptions: number;
  appointments: Appointment[];
  medicalRecordsCount: number;
  patient: Patient;
}

// ==================== SERVICE CLASS ====================

export class PatientService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';

  constructor(private readonly db: typeof prisma = prisma) {}

  // ==================== READ OPERATIONS ====================

  /**
   * Get patient by ID
   */
  async getPatientById(id: string, clinicId?: string) {
    // Validate input
    const validatedId = z.uuid().parse(id);

    const cacheKey = CACHE_KEYS.PATIENT(validatedId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const patient = await patientRepo.getPatientById(this.db, validatedId, clinicId || '');

      // Verify clinic access if provided
      if (clinicId && patient?.clinicId !== clinicId) {
        return null;
      }

      if (!patient) {
        throw new NotFoundError('Patient', validatedId);
      }

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, patient, CACHE_TTL.PATIENT);
      }

      return patient;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get patient', { error, id: validatedId });
      throw new AppError('Failed to retrieve patient', {
        code: 'PATIENT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get patient by ID with full data (appointments, medical records, etc.)
   */
  async getPatientFullDataById(id: string, clinicId: string): Promise<PatientFullData> {
    // Validate input
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.PATIENT_FULL(validatedId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as PatientFullData;
      }

      const patient = await patientRepo.findPatientByIdWithFullData(this.db, validatedId, validatedClinicId);

      if (!patient) {
        throw new NotFoundError('Patient', validatedId);
      }

      const result: PatientFullData = {
        ...patient,
        totalAppointments: patient._count?.appointments || 0,
        lastVisit: patient.appointments?.[0]?.appointmentDate || null
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.PATIENT);
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get patient full data', { error, id: validatedId });
      throw new AppError('Failed to retrieve patient details', {
        code: 'PATIENT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get recent patients for a clinic
   */
  async getRecentPatients(clinicId: string, limit = 5) {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedLimit = z.number().int().min(1).max(20).parse(limit);

    const cacheKey = CACHE_KEYS.PATIENTS_RECENT(validatedClinicId, validatedLimit);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const patients = await patientRepo.findRecentPatients(this.db, validatedClinicId, validatedLimit);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, patients, CACHE_TTL.PATIENTS_LIST);
      }

      return patients;
    } catch (error) {
      logger.error('Failed to get recent patients', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve recent patients', {
        code: 'PATIENT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get patient dashboard statistics
   */
  async getPatientDashboardStats(patientId: string, clinicId: string): Promise<PatientDashboardStats> {
    // Validate inputs
    const validatedId = z.uuid().parse(patientId);
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.PATIENT_DASHBOARD(validatedId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as PatientDashboardStats;
      }

      const [patient, appointments, activePrescriptions, totalRecords] = await patientRepo.findPatientDashboardStats(
        this.db,
        validatedId,
        validatedClinicId
      );

      if (!patient) {
        throw new NotFoundError('Patient', validatedId);
      }

      // Business logic: Process appointments for charts
      const { appointmentCounts, monthlyData } = processAppointments(appointments);
      const last5Records = appointments.slice(0, 5);

      const stats: PatientDashboardStats = {
        data: patient,
        appointmentCounts,
        last5Records,
        totalAppointments: appointments.length,
        activePrescriptions,
        totalRecords,
        monthlyData
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, stats, CACHE_TTL.DASHBOARD);
      }

      return stats;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get patient dashboard stats', { error, patientId: validatedId });
      throw new AppError('Failed to retrieve patient dashboard', {
        code: 'DASHBOARD_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get all patients for a clinic (basic list)
   */
  async getPatientsByClinic(clinicId: string, options?: { limit?: number; offset?: number }) {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.PATIENTS_BY_CLINIC(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const patients = await patientRepo.findPatientsByClinic(this.db, validatedClinicId, options);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, patients, CACHE_TTL.PATIENTS_LIST);
      }

      return patients;
    } catch (error) {
      logger.error('Failed to get patients by clinic', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve patients', {
        code: 'PATIENT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get all patients for a clinic (complete list)
   */
  async getAllPatientsByClinic(clinicId: string) {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.PATIENTS_ALL(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const patients = await patientRepo.findAllPatientsByClinic(this.db, validatedClinicId);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, patients, CACHE_TTL.PATIENTS_LIST);
      }

      return patients;
    } catch (error) {
      logger.error('Failed to get all patients by clinic', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve patients', {
        code: 'PATIENT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get patient count for a clinic
   */
  async getPatientCount(clinicId: string): Promise<number> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.PATIENT_COUNT(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as number;
      }

      const count = await patientRepo.countPatientsByClinic(this.db, validatedClinicId);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, count, CACHE_TTL.COUNT);
      }

      return count;
    } catch (error) {
      logger.error('Failed to get patient count', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve patient count', {
        code: 'COUNT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get available doctors by day
   */
  async getAvailableDoctorsByDay(day: string, clinicId: string) {
    // Validate inputs
    const validatedDay = z.string().min(1).max(20).parse(day);
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.DOCTORS_AVAILABLE_DAY(validatedClinicId, validatedDay);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const doctors = await patientRepo.findAvailableDoctorsByDay(this.db, validatedDay, validatedClinicId);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, doctors, CACHE_TTL.DOCTORS);
      }

      return doctors;
    } catch (error) {
      logger.error('Failed to get available doctors by day', { error, clinicId: validatedClinicId, day: validatedDay });
      throw new AppError('Failed to retrieve available doctors', {
        code: 'DOCTOR_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get paginated patients with filters
   */
  async getAllPatientsPaginated(input: GetAllPatientsInput & { clinicId: string }): Promise<PaginatedPatientsResult> {
    // Validate input
    const validatedInput = GetAllPatientsSchema.extend({
      clinicId: z.uuid()
    }).parse(input);

    const PAGE_NUMBER = validatedInput.page;
    const LIMIT = validatedInput.limit;
    const SKIP = (PAGE_NUMBER - 1) * LIMIT;

    const cacheKey = CACHE_KEYS.PATIENTS_PAGINATED(
      validatedInput.clinicId,
      validatedInput.search || 'all',
      validatedInput.status || 'all',
      validatedInput.gender || 'all',
      PAGE_NUMBER,
      LIMIT
    );

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as PaginatedPatientsResult;
      }

      const [patients, totalRecords] = await patientRepo.findPatientsPaginated(this.db, {
        clinicId: validatedInput.clinicId,
        search: validatedInput.search,
        status: validatedInput.status as Status | undefined,
        gender: validatedInput.gender as Gender | undefined,
        fromDate: validatedInput.dateOfBirthRange?.from,
        toDate: validatedInput.dateOfBirthRange?.to,
        sortBy: validatedInput.sortBy,
        sortOrder: validatedInput.sortOrder,
        skip: SKIP,
        take: LIMIT
      });

      const totalPages = Math.ceil(totalRecords / LIMIT);

      const result: PaginatedPatientsResult = {
        data: patients as unknown as PatientModel[],
        totalRecords,
        totalPages,
        currentPage: PAGE_NUMBER,
        limit: LIMIT
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.PATIENTS_LIST);
      }

      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid input parameters', { errors: error.issues });
      }
      logger.error('Failed to get paginated patients', { error, clinicId: validatedInput.clinicId });
      throw new AppError('Failed to retrieve patients', {
        code: 'PATIENT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Search patients
   */
  async searchPatients(input: SearchPatientsInput) {
    // Validate input
    const validated = SearchPatientsSchema.parse(input);

    const cacheKey = CACHE_KEYS.PATIENTS_SEARCH(validated.clinicId, validated.query, validated.searchBy);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      let patients;
      if (validated.searchBy === 'id') {
        const patient = await patientRepo.getPatientById(this.db, validated.query, validated.clinicId);
        patients = patient ? [patient] : [];
      } else {
        patients = await patientRepo.findPatientsWithFilters(this.db, validated.clinicId, {
          search: validated.query,
          take: validated.limit
        });
      }

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, patients, CACHE_TTL.SEARCH);
      }

      return patients;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid search parameters', { errors: error.issues });
      }
      logger.error('Failed to search patients', { error, clinicId: validated.clinicId });
      throw new AppError('Failed to search patients', {
        code: 'PATIENT_SEARCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get patient appointments
   */
  async getPatientAppointments(patientId: string, clinicId: string, options?: { limit?: number; status?: string }) {
    // Validate inputs
    const validatedId = z.uuid().parse(patientId);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      // Verify patient exists
      const patient = await patientRepo.getPatientById(this.db, validatedId, validatedClinicId);
      if (!patient) {
        throw new NotFoundError('Patient', validatedId);
      }

      return await patientRepo.findPatientAppointments(this.db, validatedId, validatedClinicId, {
        ...options,
        status: options?.status as AppointmentStatus | undefined
      });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get patient appointments', { error, patientId: validatedId });
      throw new AppError('Failed to retrieve patient appointments', {
        code: 'APPOINTMENTS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get patient medical records
   */
  async getPatientMedicalRecords(patientId: string, clinicId: string, options?: { limit?: number }) {
    // Validate inputs
    const validatedId = z.uuid().parse(patientId);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      // Verify patient exists
      const patient = await patientRepo.getPatientById(this.db, validatedId, validatedClinicId);
      if (!patient) {
        throw new NotFoundError('Patient', validatedId);
      }

      return await patientRepo.findPatientMedicalRecords(this.db, validatedId, validatedClinicId, options);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get patient medical records', { error, patientId: validatedId });
      throw new AppError('Failed to retrieve medical records', {
        code: 'MEDICAL_RECORDS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get patient prescriptions
   */
  async getPatientPrescriptions(patientId: string, clinicId: string, options?: { limit?: number; status?: string }) {
    // Validate inputs
    const validatedId = z.uuid().parse(patientId);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      // Verify patient exists
      const patient = await patientRepo.getPatientById(this.db, validatedId, validatedClinicId);
      if (!patient) {
        throw new NotFoundError('Patient', validatedId);
      }

      return await patientRepo.findPatientPrescriptions(this.db, validatedId, validatedClinicId, {
        ...options,
        status: options?.status as 'active' | 'completed' | 'cancelled'
      });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get patient prescriptions', { error, patientId: validatedId });
      throw new AppError('Failed to retrieve prescriptions', {
        code: 'PRESCRIPTIONS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== MUTATIONS ====================

  /**
   * Create a new patient
   */
  async createPatient(input: CreatePatientInput & { clinicId: string }, userId: string) {
    // Validate input
    const validated = CreatePatientSchema.extend({
      clinicId: z.uuid()
    }).parse(input);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Business rules
          if (!(validated.firstName && validated.lastName)) {
            throw new ValidationError('First and last name are required');
          }

          // 2. Check for duplicate email
          if (validated.email) {
            const existing = await patientRepo.findPatientByEmail(
              tx as unknown as PrismaClient,
              validated.email,
              validated.clinicId
            );
            if (existing) {
              throw new ConflictError('Patient with this email already exists');
            }
          }

          // 3. Check for duplicate phone
          if (validated.phone) {
            const existing = await patientRepo.findPatientByPhone(
              tx as unknown as PrismaClient,
              validated.phone,
              validated.clinicId
            );
            if (existing) {
              throw new ConflictError('Patient with this phone number already exists');
            }
          }

          // 4. Create patient
          const now = new Date();
          const patient = await patientRepo.createPatientInternal(tx as unknown as PrismaClient, {
            id: randomUUID(),
            clinicId: validated.clinicId,
            createdById: userId,
            firstName: validated.firstName,
            lastName: validated.lastName,
            dateOfBirth: validated.dateOfBirth,
            gender: validated.gender as Gender,
            phone: validated.phone || '',
            email: validated.email,
            address: validated.address || null,
            emergencyContactName: validated.emergencyContactName || null,
            emergencyContactNumber: validated.emergencyContactNumber || null,
            relation: validated.relation || null,
            bloodGroup: validated.bloodGroup || null,
            allergies: validated.allergies || null,
            medicalConditions: validated.medicalConditions || null,
            colorCode: validated.colorCode || '#4ECDC4',
            createdAt: now,
            updatedAt: now,
            userId: ''
          });

          logger.info('Patient created', {
            patientId: patient.id,
            clinicId: validated.clinicId
          });

          return patient;
        } catch (error) {
          logger.error('Failed to create patient', { error, input: validated });
          throw error;
        }
      })
      .then(async patient => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validated.clinicId);
          await cacheService.invalidate(
            CACHE_KEYS.PATIENTS_BY_CLINIC(validated.clinicId),
            CACHE_KEYS.PATIENT_COUNT(validated.clinicId)
          );
        }

        return patient;
      });
  }

  /**
   * Update an existing patient
   */
  async updatePatient(id: string, clinicId: string, data: UpdatePatientInput) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedData = UpdatePatientSchema.parse(data);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Verify patient exists
          const existing = await patientRepo.getPatientById(
            tx as unknown as PrismaClient,
            validatedId,
            validatedClinicId
          );

          if (!existing) {
            throw new NotFoundError('Patient', validatedId);
          }

          // 2. Check for duplicate email if email is being changed
          if (validatedData.email && validatedData.email !== existing.email) {
            const emailConflict = await patientRepo.findPatientByEmail(
              tx as unknown as PrismaClient,
              validatedData.email,
              validatedClinicId
            );
            if (emailConflict && emailConflict.id !== validatedId) {
              throw new ConflictError('Email already in use by another patient');
            }
          }

          // 3. Check for duplicate phone if phone is being changed
          if (validatedData.phone && validatedData.phone !== existing.phone) {
            const phoneConflict = await patientRepo.findPatientByPhone(
              tx as unknown as PrismaClient,
              validatedData.phone,
              validatedClinicId
            );
            if (phoneConflict && phoneConflict.id !== validatedId) {
              throw new ConflictError('Phone number already in use by another patient');
            }
          }

          // 4. Update patient
          const now = new Date();
          const patient = await patientRepo.updatePatientInternal(
            tx as unknown as PrismaClient,
            validatedId,
            validatedClinicId,
            {
              ...(validatedData as Prisma.PatientUncheckedUpdateInput),
              updatedAt: now
            }
          );

          logger.info('Patient updated', { patientId: validatedId });

          return patient;
        } catch (error) {
          logger.error('Failed to update patient', { error, id: validatedId });
          throw error;
        }
      })
      .then(async patient => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validatedClinicId);
          await cacheService.invalidate(
            CACHE_KEYS.PATIENT(validatedId),
            CACHE_KEYS.PATIENT_FULL(validatedId),
            CACHE_KEYS.PATIENT_DASHBOARD(validatedId),
            CACHE_KEYS.PATIENTS_BY_CLINIC(validatedClinicId),
            CACHE_KEYS.PATIENTS_ALL(validatedClinicId)
          );
        }

        return patient;
      });
  }

  /**
   * Upsert patient (create or update)
   */
  async upsertPatient(input: UpsertPatientInput & { clinicId: string }, userId: string) {
    // Validate input
    const validated = UpsertPatientSchema.extend({
      clinicId: z.uuid()
    }).parse(input);

    if (validated.id) {
      return this.updatePatient(validated.id, validated.clinicId, validated);
    }
    return this.createPatient(validated as CreatePatientInput & { clinicId: string }, userId);
  }

  /**
   * Delete patient (soft delete with checks)
   */
  async deletePatient(id: string, clinicId: string) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Verify patient exists
          const patient = await patientRepo.getPatientById(
            tx as unknown as PrismaClient,
            validatedId,
            validatedClinicId
          );

          if (!patient) {
            throw new NotFoundError('Patient', validatedId);
          }

          // 2. Business rule: Check for upcoming appointments
          const upcomingAppointments = await appointmentRepo.findAppointmentsByPatient(tx as unknown as PrismaClient, {
            patientId: validatedId,
            clinicId: validatedClinicId,
            fromDate: new Date(),
            status: ['SCHEDULED', 'PENDING']
          });

          if (upcomingAppointments.length > 0) {
            throw new ValidationError(
              'Cannot delete patient with upcoming appointments. Please cancel or reschedule appointments first.'
            );
          }

          // 3. Soft delete
          const result = await patientRepo.softDeletePatientInternal(
            tx as unknown as PrismaClient,
            validatedId,
            validatedClinicId
          );

          logger.info('Patient soft deleted', { patientId: validatedId });

          return { success: true, data: result };
        } catch (error) {
          logger.error('Failed to delete patient', { error, id: validatedId });
          throw error;
        }
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validatedClinicId);
          await cacheService.invalidate(
            CACHE_KEYS.PATIENT(validatedId),
            CACHE_KEYS.PATIENT_FULL(validatedId),
            CACHE_KEYS.PATIENT_DASHBOARD(validatedId),
            CACHE_KEYS.PATIENTS_BY_CLINIC(validatedClinicId),
            CACHE_KEYS.PATIENTS_ALL(validatedClinicId),
            CACHE_KEYS.PATIENT_COUNT(validatedClinicId)
          );
        }

        return result;
      });
  }

  /**
   * Archive patient (alternative soft delete)
   */
  async archivePatient(id: string, clinicId: string) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify patient exists
          const patient = await patientRepo.getPatientById(
            tx as unknown as PrismaClient,
            validatedId,
            validatedClinicId
          );

          if (!patient) {
            throw new NotFoundError('Patient', validatedId);
          }

          const result = await patientRepo.archivePatient(
            tx as unknown as PrismaClient,
            validatedId,
            validatedClinicId,
            { deletedAt: new Date() }
          );

          logger.info('Patient archived', { patientId: validatedId });

          return result;
        } catch (error) {
          logger.error('Failed to archive patient', { error, id: validatedId });
          throw error;
        }
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validatedClinicId);
          await cacheService.invalidate(
            CACHE_KEYS.PATIENT(validatedId),
            CACHE_KEYS.PATIENT_FULL(validatedId),
            CACHE_KEYS.PATIENT_DASHBOARD(validatedId)
          );
        }

        return result;
      });
  }

  /**
   * Get patient statistics by doctor
   */
  async getPatientStatsByDoctor(clinicId: string) {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.PATIENT_STATS_BY_DOCTOR(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const stats = await patientRepo.getPatientStatsByDoctor(this.db, validatedClinicId);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, stats, CACHE_TTL.STATS);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get patient stats by doctor', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve patient statistics', {
        code: 'STATS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get patient registration trend
   */
  async getPatientRegistrationTrend(clinicId: string, period: 'day' | 'week' | 'month' = 'month', limit = 12) {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.PATIENT_REGISTRATION_TREND(validatedClinicId, period);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const trend = await patientRepo.getPatientRegistrationTrend(this.db, validatedClinicId, period, limit);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, trend, CACHE_TTL.TREND);
      }

      return trend;
    } catch (error) {
      logger.error('Failed to get patient registration trend', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve registration trend', {
        code: 'TREND_FETCH_ERROR',
        statusCode: 500
      });
    }
  }
}

// Export singleton instance
export const patientService = new PatientService();

// Export service class for testing
export default PatientService;
