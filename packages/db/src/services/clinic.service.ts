/**
 * 🔵 CLINIC SERVICE
 * - Business logic for clinic management
 * - Orchestrates repository calls
 * - Zod validation for all inputs
 * - Caching with versioning
 * - Comprehensive error handling
 * - Transaction integrity
 */

import { logger } from '@naroto/logger';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';
import { z } from 'zod';

import type { Prisma, PrismaClient } from '../../generated/client';
import type { ClinicUpdateInput, RatingCreateInput } from '../../generated/models';
import { prisma } from '../client';
import { AppError, NotFoundError, ValidationError } from '../error';
import * as appointmentRepo from '../repositories/appointment.repo';
import * as clinicRepo from '../repositories/clinic.repo';
import * as doctorRepo from '../repositories/doctor.repo';
import * as patientRepo from '../repositories/patient.repo';
import type { MedicalRecords } from '../types';
import { toNumber } from '../utils';
import {
  type ClinicCreateInput,
  type ClinicStatsInput,
  ClinicStatsSchema,
  ClinicUpdateSchema,
  clinicCreateSchema,
  RatingCreateSchema
} from '../zodSchemas';
import { cacheService } from './cache.service';

// ==================== TYPE DEFINITIONS ====================

export interface DashboardStats {
  appointmentCounts: {
    scheduled: number;
    completed: number;
    cancelled: number;
    pending: number;
  };
  availableDoctors: number;
  dailyAppointmentsData: Array<{
    appointmentDate: Date;
    appointments: number;
    revenue: number;
  }>;
  last5Records: string[];
  monthlyData: Array<{
    name: string;
    appointment: number;
    completed: number;
  }>;
  services: number;
  todayAppointments: Array<{
    id: string;
    time: Date;
    patient: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
    doctor: {
      id: string;
      name: string | null;
    } | null;
    status: string;
  }>;
  todayAppointmentsCount: number;
  topDoctors: Array<{
    id: string;
    name: string;
    img: string | null;
    specialty: string | null;
    rating: number;
    appointments: number;
  }>;
  topSpecialties: Array<{
    specialty: string;
    count: number;
  }>;
  totalAppointments: number;
  totalDoctors: number;
  totalPatients: number;
  totalRevenue: number;
}

export interface GeneralStats {
  completedAppointments: number;
  completionRate: number;
  totalAppointments: number;
  totalDoctors: number;
  totalPatients: number;
}

export interface MedicalRecordsSummary {
  currentMonthCount: number;
  growth: number;
  previousMonthCount: number;
  recentRecords: MedicalRecords[];
  totalRecords: number;
}

export interface MonthlyPerformance {
  month: string;
  revenue: number;
  visits: number;
}

export interface PersonalizedGreeting {
  childName: string | null;
  message: string;
}

// ==================== SERVICE CLASS ====================

export class ClinicService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';

  constructor(private readonly db: typeof prisma = prisma) {}

  // ==================== READ OPERATIONS ====================

  /**
   * Get clinic by ID
   */
  async getClinicById(id: string) {
    // Validate input
    const validatedId = z.uuid().parse(id);

    const cacheKey = CACHE_KEYS.CLINIC(validatedId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const clinic = await clinicRepo.findClinicById(this.db, validatedId);

      if (!clinic) {
        throw new NotFoundError('Clinic', validatedId);
      }

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, clinic, CACHE_TTL.CLINIC);
      }

      return clinic;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get clinic', { error, id: validatedId });
      throw new AppError('Failed to retrieve clinic', {
        code: 'CLINIC_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get clinic with user access validation
   */
  async getClinicWithUserAccess(clinicId: string, userId: string) {
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedUserId = z.uuid().parse(userId);

    try {
      const clinic = await clinicRepo.findClinicWithUserAccess(this.db, validatedClinicId, validatedUserId);

      if (!clinic) {
        throw new NotFoundError('Clinic', validatedClinicId);
      }

      return clinic;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get clinic with user access', { error, clinicId, userId });
      throw new AppError('Failed to retrieve clinic', {
        code: 'CLINIC_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get clinic working hours
   */
  async getClinicWorkingHours(clinicId: string) {
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      const hours = await clinicRepo.findClinicHoursById(this.db, validatedClinicId);
      return hours || [];
    } catch (error) {
      logger.error('Failed to get clinic working hours', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve working hours', {
        code: 'WORKING_HOURS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get all features
   */
  async getFeatures() {
    const cacheKey = CACHE_KEYS.FEATURES();

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const features = await clinicRepo.getFeatures(this.db);

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, features, CACHE_TTL.FEATURES);
      }

      return features;
    } catch (error) {
      logger.error('Failed to get features', { error });
      throw new AppError('Failed to retrieve features', {
        code: 'FEATURES_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get clinic statistics
   */
  async getClinicStats(clinicId: string) {
    const cacheKey = CACHE_KEYS.CLINIC_STATS(clinicId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const [specialists, patients, appointments, satisfaction] = await clinicRepo.getClinicStats(this.db);

      const stats = {
        specialists,
        patients: patients.toLocaleString(),
        appointments: appointments.toLocaleString(),
        satisfaction: Math.round((satisfaction._avg.rating || 4.5) * 20)
      };

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, stats, CACHE_TTL.CLINIC_STATS);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get clinic stats', { error });
      throw new AppError('Failed to retrieve clinic statistics', {
        code: 'STATS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Count clinics for a user
   */
  async countUserClinics(userId: string) {
    const validatedUserId = z.uuid().parse(userId);

    try {
      return await clinicRepo.countUserClinics(this.db, validatedUserId);
    } catch (error) {
      logger.error('Failed to count user clinics', { error, userId: validatedUserId });
      throw new AppError('Failed to count clinics', {
        code: 'CLINIC_COUNT_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== MUTATIONS ====================

  /**
   * Create a new clinic
   */
  async createClinic(data: ClinicCreateInput, userId: string) {
    // Validate input
    const validated = clinicCreateSchema.parse(data);
    const validatedUserId = z.uuid().parse(userId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Business rules
          if (!validatedUserId) {
            throw new ValidationError('User must be authenticated');
          }

          // 2. Check limits
          const userClinicCount = await clinicRepo.countUserClinics(tx as unknown as PrismaClient, validatedUserId);

          if (userClinicCount >= 10) {
            throw new ValidationError('Maximum number of clinics reached (10)');
          }

          // 3. Validate clinic name
          if (!validated.name || validated.name.trim().length < 2) {
            throw new ValidationError('Clinic name must be at least 2 characters');
          }

          // 4. Create clinic
          const now = new Date();
          const clinic = await clinicRepo.createClinic(tx as unknown as PrismaClient, {
            name: validated.name.trim(),
            email: validated.email,
            phone: validated.phone,
            address: validated.address,
            logo: validated.logo,
            isActive: true,
            createdAt: now,
            updatedAt: now
          });

          // 5. Create clinic member association
          await clinicRepo.createClinicMember(tx as unknown as PrismaClient, {
            userId: validatedUserId,
            clinicId: clinic.id,
            role: 'ADMIN'
          });

          logger.info('Clinic created', { clinicId: clinic.id, userId: validatedUserId });

          return { clinic };
        } catch (error) {
          logger.error('Failed to create clinic', { error, input: validated });
          throw error;
        }
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await cacheService.invalidate(CACHE_KEYS.CLINICS_USER(validatedUserId));
          if (result.clinic.id) {
            await cacheService.invalidate(CACHE_KEYS.CLINIC_STATS(result.clinic.id));
          }
        }

        return result;
      });
  }

  /**
   * Update a clinic
   */
  async updateClinic(id: string, data: ClinicUpdateInput, userId: string) {
    const validatedId = z.uuid().parse(id);
    const validated = ClinicUpdateSchema.parse(data);
    const validatedUserId = z.uuid().parse(userId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify clinic exists and user has access
          const existing = await clinicRepo.findClinicWithUserAccess(
            tx as unknown as PrismaClient,
            validatedId,
            validatedUserId
          );

          if (!existing) {
            throw new NotFoundError('Clinic', validatedId);
          }

          const now = new Date();
          const clinic = await clinicRepo.updateClinic(tx as unknown as PrismaClient, validatedId, {
            ...validated,
            email: validated.email ?? undefined,
            phone: validated.phone ?? undefined,
            address: validated.address || (existing.clinic?.address ?? ''),
            logo: validated.logo || existing.clinic?.logo || undefined,
            updatedAt: now
          });

          logger.info('Clinic updated', { clinicId: validatedId });

          return clinic;
        } catch (error) {
          logger.error('Failed to update clinic', { error, id: validatedId });
          throw error;
        }
      })
      .then(async clinic => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validatedId);
          await cacheService.invalidate(CACHE_KEYS.CLINIC_STATS(validatedId));
        }

        return clinic;
      });
  }

  /**
   * Create a clinic review/rating
   */
  async createReview(input: RatingCreateInput) {
    // Validate input
    const validated = RatingCreateSchema.parse(input);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Business rules
          if (validated.rating < 1 || validated.rating > 5) {
            throw new ValidationError('Rating must be between 1 and 5');
          }

          if (!validated.comment || validated.comment.trim().length < 3) {
            throw new ValidationError('Comment must be at least 3 characters');
          }

          // 2. Verify doctor exists
          const doctor = await doctorRepo.findDoctorById(
            tx as unknown as PrismaClient,
            validated.staffId ?? '',
            validated.clinicId ?? ''
          );

          if (!doctor) {
            throw new NotFoundError('Doctor', validated.staffId);
          }

          // 3. Verify patient exists
          const patient = await patientRepo.getPatientById(
            tx as unknown as PrismaClient,
            validated.patientId,
            validated.clinicId ?? ''
          );

          if (!patient) {
            throw new NotFoundError('Patient', validated.patientId);
          }

          // 4. Create rating
          const now = new Date();
          const review = await clinicRepo.createRating(tx as unknown as PrismaClient, {
            clinicId: validated.clinicId,
            patientId: validated.patientId,
            staffId: validated.staffId ?? '',
            rating: validated.rating,
            comment: validated.comment,
            createdAt: now
          });

          logger.info('Review created', {
            reviewId: review.id,
            doctorId: validated.staffId,
            patientId: validated.patientId
          });

          return review;
        } catch (error) {
          logger.error('Failed to create review', { error, input: validated });
          throw error;
        }
      })
      .then(async review => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await cacheService.invalidate(CACHE_KEYS.DOCTOR(validated.staffId ?? '', validated.clinicId ?? ''));
          await cacheService.invalidatePatientCaches(validated.patientId, validated.clinicId ?? '');
        }

        return review;
      });
  }

  /**
   * Get personalized greeting
   */
  async getPersonalizedGreeting(userPrefs?: { lastVisit?: string; childName?: string }): Promise<PersonalizedGreeting> {
    try {
      const now = new Date();
      const hour = now.getHours();

      let message = 'Welcome to Smart Pediatric Clinic';

      if (userPrefs?.lastVisit) {
        const lastVisit = new Date(userPrefs.lastVisit);
        const daysSince = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
        message = daysSince < 7 ? 'Welcome back! We missed you.' : 'Welcome back! We hope your child is doing well.';
      }

      if (hour < 12) message += ' Good morning!';
      else if (hour < 17) message += ' Good afternoon!';
      else message += ' Good evening!';

      return {
        message,
        childName: userPrefs?.childName || null
      };
    } catch (error) {
      logger.error('Failed to generate personalized greeting', { error, userPrefs });
      throw new AppError('Failed to generate greeting', {
        code: 'GREETING_ERROR',
        statusCode: 500
      });
    }
  }
}

// ==================== DASHBOARD SERVICE ====================

export class DashboardService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';

  constructor(private readonly db: typeof prisma = prisma) {}

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(clinicId: string, input: ClinicStatsInput) {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);
    const validated = ClinicStatsSchema.parse(input);

    const cacheKey = CACHE_KEYS.DASHBOARD_STATS(
      validatedClinicId,
      validated.from?.toISOString() ?? '',
      validated.to?.toISOString() ?? ''
    );

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as DashboardStats;
      }

      const params = {
        clinicId: validatedClinicId,
        from: validated.from ?? new Date(0),
        to: validated.to ?? new Date()
      };

      const [
        totalRevenueAgg,
        appointmentsCount,
        patientsCount,
        doctorsCount,
        topDoctorsRaw,
        todayAppointmentsList,
        dailyAppointmentsGroups,
        servicesCount
      ] = await clinicRepo.getAdminDashboardStats(this.db, params);

      // Transform appointments for today
      const todayAppointments = todayAppointmentsList.map(apt => ({
        id: apt.id,
        time: apt.appointmentDate,
        patient: apt.patient
          ? {
              id: apt.patient.id,
              firstName: apt.patient.firstName,
              lastName: apt.patient.lastName
            }
          : null,
        doctor: apt.doctor
          ? {
              id: apt.doctor.id,
              name: apt.doctor.name
            }
          : null,
        status: apt.status || 'UNKNOWN'
      }));

      // Process appointment counts by status
      const appointmentCounts = {
        scheduled: todayAppointmentsList.filter(a => a.status === 'SCHEDULED').length,
        completed: todayAppointmentsList.filter(a => a.status === 'COMPLETED').length,
        cancelled: todayAppointmentsList.filter(a => a.status === 'CANCELLED').length,
        pending: todayAppointmentsList.filter(a => a.status === 'PENDING').length
      };

      // Process monthly data
      const monthlyMap = new Map<string, { appointments: number; completed: number }>();

      for (const apt of todayAppointmentsList) {
        const month = new Date(apt.appointmentDate).toLocaleString('default', {
          month: 'short'
        });
        const current = monthlyMap.get(month) || {
          appointments: 0,
          completed: 0
        };
        monthlyMap.set(month, {
          appointments: current.appointments + 1,
          completed: current.completed + (apt.status === 'COMPLETED' ? 1 : 0)
        });
      }

      const monthlyData = Array.from(monthlyMap.entries()).map(([name, data]) => ({
        name,
        appointment: data.appointments,
        completed: data.completed
      }));

      // Get specialty stats
      const { groupedByDoctor, doctors } = await clinicRepo.getSpecialtyStats(
        this.db,
        validatedClinicId,
        validated.from ?? new Date(0),
        validated.to ?? new Date(0)
      );

      const specialtyMap = new Map<string, number>();
      for (const g of groupedByDoctor) {
        const doc = doctors.find(d => d.id === g.doctorId);
        const specialty = doc?.specialty ?? 'General';
        const count = typeof g._count === 'object' && g._count !== null ? (g._count._all ?? 0) : 0;

        specialtyMap.set(specialty, (specialtyMap.get(specialty) || 0) + count);
      }

      const topSpecialties = Array.from(specialtyMap.entries())
        .map(([specialty, count]) => ({ specialty, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Map top doctors with ratings
      const topDoctors = topDoctorsRaw.map(d => ({
        id: d.id,
        name: d.name,
        img: d.img,
        specialty: d.specialty || 'General',
        rating: d.ratings?.[0]?.rating ?? 0,
        appointments: typeof d._count === 'object' && d._count !== null ? (d._count.appointments ?? 0) : 0
      }));

      // Process daily appointments data
      const dailyAppointmentsData = dailyAppointmentsGroups.map(d => ({
        appointmentDate: d.appointmentDate,
        appointments: typeof d._count === 'object' && d._count !== null ? (d._count._all ?? 0) : 0,
        revenue: d._sum?.appointmentPrice?.toNumber() ?? 0
      }));

      const stats: DashboardStats = {
        totalPatients: patientsCount,
        totalDoctors: doctorsCount,
        availableDoctors: todayAppointmentsList.length,
        services: servicesCount,
        totalAppointments: appointmentsCount,
        totalRevenue: toNumber(totalRevenueAgg._sum?.appointmentPrice) ?? 0,
        appointmentCounts,
        monthlyData,
        topDoctors,
        topSpecialties,
        todayAppointments,
        dailyAppointmentsData,
        last5Records: todayAppointmentsList.slice(0, 5).map(a => a.id),
        todayAppointmentsCount: todayAppointmentsList.length
      };

      // Cache the result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, stats, CACHE_TTL.DASHBOARD);
      }

      return stats;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid input parameters', { errors: error.issues });
      }
      logger.error('Failed to get dashboard stats', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve dashboard statistics', {
        code: 'DASHBOARD_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get general statistics
   */
  async getGeneralStats(): Promise<GeneralStats> {
    const cacheKey = CACHE_KEYS.GENERAL_STATS();

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as GeneralStats;
      }

      const [patients, doctors, appointments, completed] = await clinicRepo.getGeneralStats(this.db);

      const stats: GeneralStats = {
        totalPatients: patients,
        totalDoctors: doctors,
        totalAppointments: appointments,
        completedAppointments: completed,
        completionRate: appointments > 0 ? Math.round((completed / appointments) * 100) : 0
      };

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, stats, CACHE_TTL.GENERAL_STATS);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get general stats', { error });
      throw new AppError('Failed to retrieve general statistics', {
        code: 'STATS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get medical records summary
   */
  async getMedicalRecordsSummary(clinicId: string): Promise<MedicalRecordsSummary> {
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.MEDICAL_RECORDS_SUMMARY(validatedClinicId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as MedicalRecordsSummary;
      }

      const [totalRecords, currentMonthCount, previousMonthCount, recentRecords] =
        await clinicRepo.getMedicalRecordsSummary(this.db, validatedClinicId);

      // Calculate growth percentage
      const growth =
        previousMonthCount > 0
          ? ((currentMonthCount - previousMonthCount) / previousMonthCount) * 100
          : currentMonthCount > 0
            ? 100
            : 0;

      const summary: MedicalRecordsSummary = {
        totalRecords,
        currentMonthCount,
        previousMonthCount,
        growth: Math.round(growth * 10) / 10,
        recentRecords: recentRecords.map(record => ({
          ...record,
          updatedAt: record.createdAt // Fallback to createdAt if updatedAt is missing from repo result
        })) as MedicalRecords[]
      };

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, summary, CACHE_TTL.MEDICAL_RECORDS);
      }

      return summary;
    } catch (error) {
      logger.error('Failed to get medical records summary', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve medical records summary', {
        code: 'MEDICAL_RECORDS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get recent appointments
   */
  async getRecentAppointments(clinicId: string, limit = 10) {
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedLimit = z.number().int().min(1).max(50).parse(limit);
    const validatedOffset = 0; 

    const cacheKey = CACHE_KEYS.RECENT_APPOINTMENTS(validatedClinicId, validatedLimit);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const appointments = await appointmentRepo.findRecentAppointments(this.db, validatedClinicId, validatedLimit, validatedOffset);

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, appointments, CACHE_TTL.APPOINTMENT);
      }

      return appointments;
    } catch (error) {
      logger.error('Failed to get recent appointments', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve recent appointments', {
        code: 'APPOINTMENTS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get today's schedule
   */
  async getTodaySchedule(clinicId: string) {
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.TODAY_SCHEDULE(validatedClinicId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const doctors = await appointmentRepo.findTodayAppointments(this.db, validatedClinicId);
      const today = new Date().toLocaleString('en-US', { weekday: 'long' });

      const schedule = doctors.map(d => ({
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        img: d.img,
        colorCode: d.colorCode,
        isAvailable: d.workingDays?.some(w => w.day === today) ?? false,
        appointments:
          d.appointments?.map(apt => ({
            id: apt.id,
            time: apt.appointmentDate,
            patient: apt.patient
              ? {
                  firstName: apt.patient.firstName,
                  lastName: apt.patient.lastName,
                  image: apt.patient.image,
                  colorCode: apt.patient.colorCode
                }
              : null,
            status: apt.status
          })) ?? []
      }));

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, schedule, CACHE_TTL.SCHEDULE);
      }

      return schedule;
    } catch (error) {
      logger.error('Failed to get today schedule', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve today schedule', {
        code: 'SCHEDULE_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get upcoming immunizations
   */
  async getUpcomingImmunizations(clinicId: string) {
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.UPCOMING_IMMUNIZATIONS(validatedClinicId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const immunizations = await clinicRepo.getUpcomingImmunizations(this.db, validatedClinicId);

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, immunizations, CACHE_TTL.IMMUNIZATIONS);
      }

      return immunizations;
    } catch (error) {
      logger.error('Failed to get upcoming immunizations', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve upcoming immunizations', {
        code: 'IMMUNIZATIONS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get monthly performance
   */
  async getMonthlyPerformance(clinicId: string): Promise<MonthlyPerformance[]> {
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.MONTHLY_PERFORMANCE(validatedClinicId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as MonthlyPerformance[];
      }

      const data = await clinicRepo.getMonthlyPerformance(this.db, validatedClinicId);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const performance = months.map((month, i) => {
        const match = data.find(d => d.month === i + 1);
        return {
          month,
          visits: Number(match?.visits ?? 0),
          revenue: Number(match?.revenue ?? 0)
        };
      });

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, performance, CACHE_TTL.PERFORMANCE);
      }

      return performance;
    } catch (error) {
      logger.error('Failed to get monthly performance', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve monthly performance', {
        code: 'PERFORMANCE_FETCH_ERROR',
        statusCode: 500
      });
    }
  }
}

// Export singleton instances
export const clinicService = new ClinicService();
export const dashboardService = new DashboardService();

// Export service classes for testing
export default { clinicService, dashboardService };
