/**
 * 🔵 ADMIN SERVICE
 * - Business logic for admin dashboard and management
 * - Orchestrates repository calls
 * - Zod validation for all inputs
 * - Caching with versioning
 * - Comprehensive error handling
 * - Transaction integrity
 */

import { randomUUID } from 'node:crypto';

import type { AppointmentStatus, PrismaClient } from '@generated/client';
import { Prisma } from '@generated/client';
import { logger } from '@naroto/logger';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';
import { addDays, endOfDay, endOfMonth, startOfDay, startOfMonth, subDays } from 'date-fns';
import { z } from 'zod';

import { ValidationError } from '..';
import { prisma } from '../client';
import { AppError, ConflictError, NotFoundError } from '../error';
import * as appointmentRepo from '../repositories/appointment.repo';
import * as dashboardRepo from '../repositories/dashboard.repo';
import * as doctorRepo from '../repositories/doctor.repo';
import * as growthRepo from '../repositories/growth.repo';
import * as patientRepo from '../repositories/patient.repo';
import * as paymentRepo from '../repositories/payment.repo';
import * as serviceRepo from '../repositories/service.repo';
import * as staffRepo from '../repositories/staff.repo';
import * as vaccinationRepo from '../repositories/vac.repository';
import { toNumber } from '../utils';
import {
  type CreateStaffInput,
  type DeleteInput,
  DeleteInputSchema,
  type ServiceInput,
  ServicesSchema,
  StaffAuthSchema,
  type StaffCreate,
  type StatsInput,
  StatsInputSchema,
  staffUpdateSchema,
  statusChangeSchema
} from '../zodSchemas';
import { cacheService } from './cache.service';

// ==================== TYPE DEFINITIONS ====================

export interface AdminDashboardStats {
  activePatients: number;
  appointmentsRevenue: number;
  cancelledAppointments: number;
  completedAppointments: number;
  doctorsWorkingToday: Awaited<ReturnType<typeof doctorRepo.findDoctorsWorkingOnDay>>;

  // Financial
  monthlyRevenue: number;

  // Patient metrics
  newPatientsThisMonth: number;
  overdueImmunizations: Awaited<ReturnType<typeof vaccinationRepo.findOverdueImmunizations>>;

  // Growth metrics
  patientsNeedingGrowthCheck: number;
  pendingPayments: number;

  // Lists
  recentAppointments: Awaited<ReturnType<typeof appointmentRepo.getRecentAppointments>>;
  recentServices: Awaited<ReturnType<typeof serviceRepo.findRecentServices>>;

  // Appointment metrics
  todayAppointments: number;
  totalDoctors: number;
  // Core metrics
  totalPatients: number;
  totalServices: number;
  totalStaff: number;
  upcomingAppointments: number;
}

export interface DashboardStatsWithRange {
  appointmentsInRange: number;
  doctorsWorkingToday: Awaited<ReturnType<typeof doctorRepo.findDoctorsWorkingOnDay>>;
  recentAppointments: Awaited<ReturnType<typeof appointmentRepo.getRecentAppointments>>;
  recentServices: Awaited<ReturnType<typeof serviceRepo.findRecentServices>>;
  revenueInRange: number;
  totalDoctors: number;
  totalPatients: number;
  totalPendingPayments: number;
  totalStaff: number;
  upcomingAppointments: number;
}

export interface MonthlyReport {
  activePatients: number;
  appointmentsByDay: Record<string, number>;
  cancelledAppointments: number;
  completedAppointments: number;
  newPatients: number;
  period: { year: number; month: number };
  revenueByService: Array<{
    serviceName: string;
    revenue: number;
    count: number;
  }>;
  topDoctors: Array<{
    doctorId: string;
    doctorName: string;
    appointmentCount: number;
    revenue: number;
  }>;
  totalAppointments: number;
  totalRevenue: number;
}

export interface ClinicOverview {
  activeAppointments: number;
  averageWaitTime: number | null;
  doctorCount: number;
  occupancyRate: number;
  patientCount: number;
  staffCount: number;
}

export interface GrowthStats {
  atRiskPatients: number;
  classifications: Array<{ classification: string; count: number }>;
  criticalPatients: number;
  patientsWithMeasurements: number;
  totalMeasurements: number;
}

export interface RealtimeStatus {
  appointmentsToday: number;
  availableDoctors: number;
  nextAppointment: Awaited<ReturnType<typeof appointmentRepo.getTodaySchedule>>[number]['appointments'][number] | null;
  patientsInClinic: number;
  timestamp: string;
  waitTimeEstimate: number;
}

// ==================== SERVICE CLASS ====================

export class AdminService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';
  private readonly DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  constructor(private readonly db: typeof prisma = prisma) {}

  // ==================== DASHBOARD SERVICES ====================

  /**
   * Get comprehensive dashboard statistics for a clinic
   */
  async getAdminDashboardStats(clinicId: string, options?: { skipCache?: boolean }): Promise<AdminDashboardStats> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.ADMIN_DASHBOARD(validatedClinicId);
    const startTime = Date.now();

    try {
      // Check cache
      if (this.CACHE_ENABLED && !options?.skipCache) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          logger.debug('Dashboard stats served from cache', {
            clinicId: validatedClinicId,
            duration: Date.now() - startTime
          });
          return cached as AdminDashboardStats;
        }
      }

      // Date calculations (business logic in service)
      const now = new Date();
      const today = startOfDay(now);
      const tomorrow = startOfDay(addDays(now, 1));
      const thirtyDaysAgo = subDays(now, 30);

      const startOfCurrentMonth = startOfMonth(now);
      const endOfCurrentMonth = endOfMonth(now);

      const todayDayName = this.DAYS_OF_WEEK[now.getDay()] as string;

      // Parallel repository calls for performance
      const [
        totalPatients,
        totalDoctors,
        totalStaff,
        totalServices,
        todayAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        // appointmentsRevenue,
        newPatientsThisMonth,
        activePatients,
        recentAppointments,
        doctorsWorkingToday,
        recentServices,
        overdueImmunizations,
        monthlyRevenue,
        pendingPayments,
        patientsNeedingGrowthCheck
      ] = await Promise.allSettled([
        patientRepo.countActivePatients(this.db, validatedClinicId),
        doctorRepo.countActiveDoctors(this.db, validatedClinicId),
        staffRepo.countActiveStaff?.(this.db, validatedClinicId) ?? Promise.resolve(0),
        serviceRepo.countServices?.(this.db, validatedClinicId) ?? Promise.resolve(0),
        appointmentRepo.countAppointmentsInRange(this.db, validatedClinicId, today, tomorrow),
        appointmentRepo.countAppointmentsByStatus(this.db, validatedClinicId, [
          'SCHEDULED',
          'CONFIRMED'
        ] as AppointmentStatus[]),
        appointmentRepo.countAppointmentsByStatus(this.db, validatedClinicId, ['COMPLETED'] as AppointmentStatus[]),
        appointmentRepo.countAppointmentsByStatus(this.db, validatedClinicId, [
          'CANCELLED',
          'NO_SHOW'
        ] as AppointmentStatus[]),
        // appointmentRepo.sumAppointmentRevenue?.(this.db, validatedClinicId, today, tomorrow) ?? Promise.resolve(0),
        patientRepo.countNewPatientsInRange(this.db, validatedClinicId, startOfCurrentMonth, endOfCurrentMonth),
        patientRepo.countActivePatients(this.db, validatedClinicId),
        appointmentRepo.getRecentAppointments(this.db, validatedClinicId),
        doctorRepo.findDoctorsWorkingOnDay(this.db, validatedClinicId, todayDayName, 5),
        serviceRepo.findRecentServices?.(this.db, validatedClinicId, 10, 0) ?? Promise.resolve([]),
        vaccinationRepo.findOverdueImmunizations(this.db, validatedClinicId, now, { limit: 20 }),
        paymentRepo.sumPaymentsInRange(this.db, validatedClinicId, startOfCurrentMonth, endOfCurrentMonth),
        paymentRepo.countPendingPayments(this.db, validatedClinicId),
        growthRepo.countPatientsNeedingGrowthCheck?.(this.db, validatedClinicId, thirtyDaysAgo) ?? Promise.resolve(0)
      ]);

      // Handle partial failures gracefully
      const stats: AdminDashboardStats = {
        totalPatients: this.unwrapPromise(totalPatients, 0),
        totalDoctors: this.unwrapPromise(totalDoctors, 0),
        totalStaff: this.unwrapPromise(totalStaff, 0),
        totalServices: this.unwrapPromise(totalServices, 0),
        todayAppointments: this.unwrapPromise(todayAppointments, 0),
        upcomingAppointments: this.unwrapPromise(upcomingAppointments, 0),
        completedAppointments: this.unwrapPromise(completedAppointments, 0),
        cancelledAppointments: this.unwrapPromise(cancelledAppointments, 0),
        appointmentsRevenue: 0, // Placeholder as sumAppointmentRevenue is commented out
        newPatientsThisMonth: this.unwrapPromise(newPatientsThisMonth, 0),
        activePatients: this.unwrapPromise(activePatients, 0),
        recentAppointments: this.unwrapPromise(recentAppointments, []),
        doctorsWorkingToday: this.unwrapPromise(doctorsWorkingToday, []),
        recentServices: this.unwrapPromise(recentServices, []),
        overdueImmunizations: this.unwrapPromise(overdueImmunizations, []),
        monthlyRevenue: toNumber(this.unwrapPromise(monthlyRevenue, 0)) ?? 0,
        pendingPayments: this.unwrapPromise(pendingPayments, 0),
        patientsNeedingGrowthCheck: this.unwrapPromise(patientsNeedingGrowthCheck, 0)
      };

      // Cache the result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, stats, CACHE_TTL.DASHBOARD);
      }

      logger.info('Dashboard stats generated', {
        clinicId: validatedClinicId,
        duration: Date.now() - startTime
      });

      return stats;
    } catch (error) {
      logger.error('Failed to generate dashboard stats', { error, clinicId: validatedClinicId });
      throw new AppError('Unable to fetch dashboard statistics', {
        code: 'DASHBOARD_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get dashboard statistics for a custom date range
   */
  async getDashboardStatsWithRange(input: StatsInput): Promise<DashboardStatsWithRange> {
    // Validate input
    const validated = StatsInputSchema.parse(input);

    const cacheKey = CACHE_KEYS.ADMIN_DASHBOARD_RANGE(
      validated.clinicId,
      validated.from.toISOString(),
      validated.to.toISOString()
    );

    const startTime = Date.now();

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return cached as DashboardStatsWithRange;
        }
      }

      const todayDayName = this.DAYS_OF_WEEK[new Date().getDay()] as string;

      const [
        totalPatients,
        totalDoctors,
        totalStaff,
        appointmentsInRange,
        upcomingAppointments,
        recentAppointments,
        doctorsWorkingToday,
        recentServices,
        revenueInRange,
        pendingPayments
      ] = await Promise.all([
        patientRepo.countActivePatients(this.db, validated.clinicId),
        doctorRepo.countActiveDoctors(this.db, validated.clinicId),
        staffRepo.countActiveStaff?.(this.db, validated.clinicId) ?? Promise.resolve(0),
        appointmentRepo.countAppointmentsInRange(this.db, validated.clinicId, validated.from, validated.to),
        appointmentRepo.countAppointmentsByStatus(this.db, validated.clinicId, [
          'SCHEDULED',
          'CONFIRMED'
        ] as AppointmentStatus[]),
        appointmentRepo.getRecentAppointments(this.db, validated.clinicId),
        doctorRepo.findDoctorsWorkingOnDay(this.db, validated.clinicId, todayDayName, 5),
        serviceRepo.findRecentServices?.(this.db, validated.clinicId, 10, 0) ?? Promise.resolve([]),
        paymentRepo.sumPaymentsInRange(this.db, validated.clinicId, validated.from, validated.to),
        paymentRepo.countPendingPayments(this.db, validated.clinicId)
      ]);

      const result: DashboardStatsWithRange = {
        totalPatients,
        totalDoctors,
        totalStaff,
        appointmentsInRange,
        upcomingAppointments,
        recentAppointments,
        doctorsWorkingToday,
        recentServices,
        revenueInRange: toNumber(revenueInRange) ?? 0,
        totalPendingPayments: pendingPayments
      };

      // Cache for 5 minutes
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.DASHBOARD);
      }

      logger.info('Range dashboard stats generated', {
        clinicId: validated.clinicId,
        duration: Date.now() - startTime
      });

      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid input parameters', { errors: (error as z.ZodError).issues });
      }
      logger.error('Failed to generate range dashboard stats', { error, input: validated });
      throw new AppError('Unable to fetch dashboard statistics for range', {
        code: 'DASHBOARD_RANGE_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get clinic overview with occupancy calculations
   */
  async getClinicOverview(clinicId: string): Promise<ClinicOverview> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const startTime = Date.now();

    try {
      const now = new Date();
      const today = startOfDay(now);
      const tomorrow = endOfDay(now);

      const [patientCount, doctorCount, staffCount, activeAppointments, totalAppointmentsToday] = await Promise.all([
        patientRepo.countActivePatients(this.db, validatedClinicId),
        doctorRepo.countActiveDoctors(this.db, validatedClinicId),
        staffRepo.countActiveStaff?.(this.db, validatedClinicId) ?? Promise.resolve(0),
        appointmentRepo.countAppointmentsByStatus(this.db, validatedClinicId, [
          'SCHEDULED' as AppointmentStatus,
          'CONFIRMED' as AppointmentStatus,
          'IN_PROGRESS' as AppointmentStatus
        ]),
        appointmentRepo.countAppointmentsInRange(this.db, validatedClinicId, today, tomorrow)
      ]);

      const occupancyRate = this.calculateOccupancyRate(totalAppointmentsToday, doctorCount);

      // Calculate average wait time from recent appointments
      const recentAppointments = await appointmentRepo.getRecentAppointments(this.db, validatedClinicId);
      const waitTimes = recentAppointments
        .map(apt => (apt as { waitTime?: number | null }).waitTime)
        .filter((time): time is number => time !== null && time !== undefined);

      const averageWaitTime =
        waitTimes.length > 0
          ? Math.round(waitTimes.reduce((a: number, b: number) => a + b, 0) / waitTimes.length)
          : null;

      logger.info('Clinic overview generated', {
        clinicId: validatedClinicId,
        duration: Date.now() - startTime
      });

      return {
        patientCount,
        doctorCount,
        staffCount,
        activeAppointments,
        occupancyRate,
        averageWaitTime
      };
    } catch (error) {
      logger.error('Failed to get clinic overview', { error, clinicId: validatedClinicId });
      throw new AppError('Unable to fetch clinic overview', {
        code: 'CLINIC_OVERVIEW_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Generate comprehensive monthly report
   */
  async getMonthlyReport(clinicId: string, year: number, month: number): Promise<MonthlyReport> {
    // Validate inputs
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedYear = z.number().int().min(2000).max(2100).parse(year);
    const validatedMonth = z.number().int().min(1).max(12).parse(month);

    const cacheKey = CACHE_KEYS.MONTHLY_REPORT(validatedClinicId, validatedYear, validatedMonth);
    const startTime = Date.now();

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return cached as MonthlyReport;
        }
      }

      const startDate = startOfMonth(new Date(validatedYear, validatedMonth - 1, 1));
      const endDate = endOfMonth(new Date(validatedYear, validatedMonth - 1, 1));

      // Get appointments in range
      const appointments = await appointmentRepo.findForMonth(this.db, validatedClinicId, startDate, endDate);

      // Get payments in range
      const payments = await paymentRepo.findPaymentsInRange(this.db, validatedClinicId, startDate, endDate);

      // Get new patients count
      const newPatients = await patientRepo.countNewPatientsInRange(this.db, validatedClinicId, startDate, endDate);

      // Get active patients count
      const activePatients = await patientRepo.countActivePatients(this.db, validatedClinicId);

      // Calculate top doctors
      const topDoctors = this.calculateTopDoctors(appointments);

      // Calculate revenue by service
      const revenueByService = this.calculateRevenueByService(payments);

      const report: MonthlyReport = {
        period: { year: validatedYear, month: validatedMonth },
        totalAppointments: appointments.length,
        completedAppointments: appointments.filter(a => a.status === 'COMPLETED').length,
        cancelledAppointments: appointments.filter(a => a.status === 'CANCELLED').length,
        totalRevenue: payments.reduce((sum: number, p) => sum + (toNumber(p.amount) || 0), 0),
        activePatients,
        newPatients,
        appointmentsByDay: this.groupAppointmentsByDay(appointments),
        topDoctors,
        revenueByService
      };

      // Cache for 1 hour
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, report, 3600);
      }

      logger.info('Monthly report generated', {
        clinicId: validatedClinicId,
        year: validatedYear,
        month: validatedMonth,
        duration: Date.now() - startTime,
        appointmentCount: appointments.length
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate monthly report', { error, clinicId: validatedClinicId, year, month });
      throw new AppError('Unable to fetch monthly report', {
        code: 'MONTHLY_REPORT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get growth tracking statistics
   */
  async getGrowthStats(clinicId: string, options?: { days?: number }): Promise<GrowthStats> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);
    const days = options?.days ? z.number().int().min(1).max(365).parse(options.days) : 90;

    try {
      const startDate = subDays(new Date(), days);
      const endDate = new Date();

      const [totalMeasurements, patientsWithMeasurements, classifications] = await Promise.all([
        growthRepo.getGrowthStatsByClinic(this.db, validatedClinicId, { startDate, endDate }).then(r => r[0]),
        growthRepo.getGrowthStatsByClinic(this.db, validatedClinicId, { startDate, endDate }).then(r => r[1]),
        growthRepo.getGrowthStatsByClinic(this.db, validatedClinicId, { startDate, endDate }).then(r => r[2])
      ]);

      // Calculate at-risk patients (Z-score < -2 or > 2)
      const atRiskPatients = classifications
        .filter(
          c =>
            (c.growthStatus as string).includes('Underweight') ||
            (c.growthStatus as string).includes('Overweight') ||
            (c.growthStatus as string).includes('Obese')
        )
        .reduce((sum: number, c) => sum + (c._count as number), 0);

      // Calculate critical patients (Z-score < -3 or > 3)
      const criticalPatients = classifications
        .filter(c => (c.growthStatus as string).includes('Severe'))
        .reduce((sum: number, c) => sum + (c._count as number), 0);

      return {
        totalMeasurements,
        patientsWithMeasurements,
        classifications: classifications.map(c => ({
          classification: (c.growthStatus as string) || 'Unknown',
          count: Number(c._count)
        })),
        atRiskPatients,
        criticalPatients
      };
    } catch (error) {
      logger.error('Failed to get growth stats', { error, clinicId: validatedClinicId });
      throw new AppError('Unable to fetch growth statistics', {
        code: 'GROWTH_STATS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get real-time clinic status (no caching)
   */
  async getRealtimeStatus(clinicId: string): Promise<RealtimeStatus> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      const now = new Date();
      // const today = startOfDay(now);
      // const tomorrow = endOfDay(now);

      const [todaySchedule, patientsInClinic, availableDoctors] = await Promise.all([
        appointmentRepo.getTodaySchedule?.(this.db, validatedClinicId) ?? Promise.resolve([]),
        patientRepo.countPatientsCheckedIn?.(this.db, validatedClinicId) ?? Promise.resolve(0),
        doctorRepo.countAvailableDoctors?.(this.db, validatedClinicId, now) ?? Promise.resolve(0)
      ]);

      const appointmentsToday = todaySchedule.flatMap(doctor => doctor.appointments);

      return {
        timestamp: now.toISOString(),
        appointmentsToday: appointmentsToday.length,
        patientsInClinic,
        availableDoctors,
        nextAppointment: appointmentsToday[0] || null,
        waitTimeEstimate: this.calculateWaitTimeEstimate(appointmentsToday, availableDoctors)
      };
    } catch (error) {
      logger.error('Failed to get realtime status', { error, clinicId: validatedClinicId });
      throw new AppError('Unable to fetch realtime status', {
        code: 'REALTIME_STATUS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Clear dashboard cache for a clinic
   */
  async clearDashboardCache(clinicId: string): Promise<void> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      await cacheService.invalidateClinicCaches(validatedClinicId);
      logger.info('Dashboard cache cleared', { clinicId: validatedClinicId });
    } catch (error) {
      logger.error('Failed to clear dashboard cache', { error, clinicId: validatedClinicId });
    }
  }

  // ==================== SERVICE MANAGEMENT ====================

  /**
   * Get all services for a clinic
   */
  async getServices(clinicId: string) {
    const validatedClinicId = z.uuid().parse(clinicId);
    const cacheKey = CACHE_KEYS.SERVICES(validatedClinicId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const services = await serviceRepo.findServices(this.db, validatedClinicId);

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, services, CACHE_TTL.SERVICES);
      }

      return services;
    } catch (error) {
      logger.error('Failed to get services', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve services', {
        code: 'SERVICES_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get service by ID
   */
  async getServiceById(id: string, clinicId: string) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);
    const cacheKey = CACHE_KEYS.SERVICE(validatedId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const service = await serviceRepo.findServiceById(this.db, validatedId, validatedClinicId);

      if (!service) {
        throw new NotFoundError('Service', validatedId);
      }

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, service, CACHE_TTL.SERVICE);
      }

      return service;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get service', { error, id: validatedId });
      throw new AppError('Failed to retrieve service', {
        code: 'SERVICE_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get services with usage statistics
   */
  async getServicesWithUsage(clinicId: string) {
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      return await serviceRepo.findServicesWithUsage(this.db, validatedClinicId);
    } catch (error) {
      logger.error('Failed to get services with usage', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve services with usage', {
        code: 'SERVICES_USAGE_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Create a new service
   */
  async createService(input: ServiceInput) {
    // Validate input
    const validated = ServicesSchema.parse(input);

    return this.db.$transaction(async tx => {
      try {
        // Check for duplicate service name
        const existing = await serviceRepo.findServiceByName(
          tx as unknown as PrismaClient,
          validated.serviceName,
          validated.clinicId
        );

        if (existing) {
          throw new ConflictError('Service with this name already exists');
        }

        // const now = new Date();
        const service = await serviceRepo.createService(tx as unknown as PrismaClient, {
          id: randomUUID(),
          clinicId: validated.clinicId,
          serviceName: validated.serviceName,
          price: new Prisma.Decimal(validated.price),
          isAvailable: validated.isAvailable ?? true,
          description: validated.description
        });

        // Invalidate cache
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validated.clinicId);
        }

        logger.info('Service created', { serviceId: service.id, clinicId: validated.clinicId });
        return service;
      } catch (error) {
        logger.error('Failed to create service', { error, input: validated });
        throw error;
      }
    });
  }

  /**
   * Update a service
   */
  async updateService(id: string, clinicId: string, data: Partial<ServiceInput>) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedData = ServicesSchema.partial().parse(data);

    return this.db.$transaction(async tx => {
      try {
        // Verify service exists
        const existing = await serviceRepo.findServiceById(
          tx as unknown as PrismaClient,
          validatedId,
          validatedClinicId
        );

        if (!existing) {
          throw new NotFoundError('Service', validatedId);
        }

        // Check for name conflict if name is being changed
        if (validatedData.serviceName && validatedData.serviceName !== existing.serviceName) {
          const nameConflict = await serviceRepo.findServiceByName(
            tx as unknown as PrismaClient,
            validatedData.serviceName,
            validatedClinicId
          );

          if (nameConflict && nameConflict.id !== validatedId) {
            throw new ConflictError('Service with this name already exists');
          }
        }

        const now = new Date();
        const service = await serviceRepo.updateService(tx as unknown as PrismaClient, validatedId, validatedClinicId, {
          serviceName: validatedData.serviceName ?? existing.serviceName,
          description: validatedData.description ?? existing.description ?? '',
          price: new Prisma.Decimal(toNumber(validatedData.price) || 0),
          updatedAt: now
        });

        // Invalidate cache
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validatedClinicId);
          await cacheService.invalidate(CACHE_KEYS.SERVICE(validatedId));
        }

        logger.info('Service updated', { serviceId: validatedId });
        return service;
      } catch (error) {
        logger.error('Failed to update service', { error, id: validatedId });
        throw error;
      }
    });
  }

  /**
   * Delete a service (soft delete if in use)
   */
  async deleteService(input: DeleteInput) {
    // Validate input
    const validated = DeleteInputSchema.parse(input);

    return this.db.$transaction(async tx => {
      try {
        // Check if service is in use
        const inUse = await serviceRepo.checkServiceInUse(tx as unknown as PrismaClient, validated.id);

        let result;
        if (inUse > 0) {
          // Soft delete if in use
          const now = new Date();
          result = await serviceRepo.softDeleteService(
            tx as unknown as PrismaClient,
            validated.id,
            validated.clinicId,
            {
              isDeleted: true,
              isAvailable: false,
              deletedAt: now,
              updatedAt: now
            }
          );

          logger.info('Service soft deleted (in use)', { serviceId: validated.id });
        } else {
          // Hard delete if not in use
          result = await serviceRepo.deleteService(tx as unknown as PrismaClient, validated.id, validated.clinicId);

          logger.info('Service permanently deleted', { serviceId: validated.id });
        }

        // Invalidate cache
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validated.clinicId);
          await cacheService.invalidate(CACHE_KEYS.SERVICE(validated.id));
        }

        return result;
      } catch (error) {
        logger.error('Failed to delete service', { error, id: validated.id });
        throw new AppError('Failed to delete service', {
          code: 'SERVICE_DELETE_ERROR',
          statusCode: 500
        });
      }
    });
  }

  // ==================== STAFF MANAGEMENT ====================

  /**
   * Get all staff for a clinic
   */
  async getStaffList(clinicId: string) {
    const validatedClinicId = z.uuid().parse(clinicId);
    const cacheKey = CACHE_KEYS.STAFF(validatedClinicId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const staff = await staffRepo.findStaffList(this.db, validatedClinicId);

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, staff, CACHE_TTL.STAFF);
      }

      return staff;
    } catch (error) {
      logger.error('Failed to get staff list', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve staff list', {
        code: 'STAFF_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get staff by ID
   */
  async getStaffById(id: string, clinicId: string) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      const staff = await staffRepo.findStaffById(this.db, validatedId, validatedClinicId);

      if (!staff) {
        throw new NotFoundError('Staff', validatedId);
      }

      return staff;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get staff', { error, id: validatedId });
      throw new AppError('Failed to retrieve staff', {
        code: 'STAFF_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Create new staff member
   */
  async createStaff(input: CreateStaffInput) {
    // Validate input
    const validated = StaffAuthSchema.parse(input);

    return this.db.$transaction(async tx => {
      try {
        // Check for duplicate email
        const existing = await staffRepo.findStaffByEmail(
          tx as unknown as PrismaClient,
          validated.email,
          validated.clinicId
        );

        if (existing) {
          throw new ConflictError('Staff with this email already exists');
        }

        const now = new Date();
        const staff = await staffRepo.createStaff(tx as unknown as PrismaClient, {
          id: randomUUID(),
          clinicId: validated.clinicId,
          email: validated.email,
          name: validated.name,
          phone: validated.phone,
          address: validated.address,
          department: validated.department || '',
          img: validated.img,
          colorCode: validated.colorCode,
          hireDate: validated.hireDate || now,
          role: validated.role,
          status: validated.status || 'ACTIVE',
          createdAt: now,
          updatedAt: now
        });

        // Invalidate cache
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validated.clinicId);
        }

        logger.info('Staff created', { staffId: staff.id, clinicId: validated.clinicId });
        return staff;
      } catch (error) {
        logger.error('Failed to create staff', { error, input: validated });
        throw error;
      }
    });
  }

  /**
   * Update staff member
   */
  async updateStaff(id: string, clinicId: string, data: Partial<StaffCreate>) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedData = staffUpdateSchema.parse({ id: validatedId, clinicId: validatedClinicId, ...data });

    return this.db.$transaction(async tx => {
      try {
        // Verify staff exists
        const existing = await staffRepo.findStaffById(tx as unknown as PrismaClient, validatedId, validatedClinicId);

        if (!existing) {
          throw new NotFoundError('Staff', validatedId);
        }

        // Check email conflict if email is being changed
        if (validatedData.email && validatedData.email !== existing.email) {
          const emailConflict = await staffRepo.findStaffByEmail(
            tx as unknown as PrismaClient,
            validatedData.email,
            validatedClinicId
          );

          if (emailConflict && emailConflict.id !== validatedId) {
            throw new ConflictError('Email already in use');
          }
        }

        const now = new Date();
        const staff = await staffRepo.updateStaff(tx as unknown as PrismaClient, validatedId, validatedClinicId, {
          ...validatedData,
          updatedAt: now
        });

        // Invalidate cache
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validatedClinicId);
        }

        logger.info('Staff updated', { staffId: validatedId });
        return staff;
      } catch (error) {
        logger.error('Failed to update staff', { error, id: validatedId });
        throw error;
      }
    });
  }

  /**
   * Change staff status
   */
  async changeStaffStatus(input: z.infer<typeof statusChangeSchema>) {
    const validated = statusChangeSchema.parse(input);

    try {
      const staff = await staffRepo.updateStaffStatus(
        this.db,
        validated.id,
        validated.clinicId,
        validated.status,
        validated.reason
      );

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await cacheService.invalidateClinicCaches(validated.clinicId);
      }

      logger.info('Staff status changed', {
        staffId: validated.id,
        status: validated.status
      });

      return staff;
    } catch (error) {
      logger.error('Failed to change staff status', { error, input: validated });
      throw new AppError('Failed to change staff status', {
        code: 'STAFF_STATUS_CHANGE_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Archive staff (soft delete)
   */
  async archiveStaff(id: string, clinicId: string) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      // Verify staff exists
      const existing = await staffRepo.findStaffById(this.db, validatedId, validatedClinicId);
      if (!existing) {
        throw new NotFoundError('Staff', validatedId);
      }

      const result = await patientRepo.archivePatient(this.db, validatedId, validatedClinicId, {
        deletedAt: new Date()
      });

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await cacheService.invalidateClinicCaches(validatedClinicId);
      }

      logger.info('Staff archived', { staffId: validatedId });
      return result;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to archive staff', { error, id: validatedId });
      throw new AppError('Failed to archive staff', {
        code: 'STAFF_ARCHIVE_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Permanently delete staff
   */
  async deleteStaff(id: string, clinicId: string) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      const result = await staffRepo.deleteStaff(this.db, validatedId, validatedClinicId);

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await cacheService.invalidateClinicCaches(validatedClinicId);
      }

      logger.info('Staff permanently deleted', { staffId: validatedId });
      return result;
    } catch (error) {
      logger.error('Failed to delete staff', { error, id: validatedId });
      throw new AppError('Failed to delete staff', {
        code: 'STAFF_DELETE_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== DOCTOR MANAGEMENT ====================

  /**
   * Get all doctors for a clinic
   */
  async getDoctorList(clinicId: string) {
    const validatedClinicId = z.uuid().parse(clinicId);
    const cacheKey = CACHE_KEYS.DOCTORS(validatedClinicId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const doctors = await doctorRepo.findDoctorList(this.db, validatedClinicId);

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, doctors, CACHE_TTL.DOCTORS);
      }

      return doctors;
    } catch (error) {
      logger.error('Failed to get doctor list', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve doctor list', {
        code: 'DOCTOR_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get doctor by ID
   */
  async getDoctorById(id: string, clinicId: string) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      const doctor = await doctorRepo.findDoctorById(this.db, validatedId, validatedClinicId);

      if (!doctor) {
        throw new NotFoundError('Doctor', validatedId);
      }

      return doctor;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get doctor', { error, id: validatedId });
      throw new AppError('Failed to retrieve doctor', {
        code: 'DOCTOR_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Delete doctor
   */
  async deleteDoctor(id: string, clinicId: string) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      const result = await doctorRepo.deleteDoctor(this.db, validatedId, validatedClinicId);

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await cacheService.invalidateClinicCaches(validatedClinicId);
      }

      logger.info('Doctor deleted', { doctorId: validatedId });
      return result;
    } catch (error) {
      logger.error('Failed to delete doctor', { error, id: validatedId });
      throw new AppError('Failed to delete doctor', {
        code: 'DOCTOR_DELETE_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== PATIENT MANAGEMENT ====================

  /**
   * Get patient by ID
   */
  async getPatientById(id: string, clinicId: string) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      const patient = await patientRepo.getPatientById(this.db, validatedId, validatedClinicId);

      if (!patient || patient.clinicId !== validatedClinicId) {
        throw new NotFoundError('Patient', validatedId);
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
   * Archive patient (soft delete)
   */
  async archivePatient(id: string, clinicId: string) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      const result = await patientRepo.archivePatient(this.db, validatedId, validatedClinicId, {
        deletedAt: new Date()
      });

      logger.info('Patient archived', { patientId: validatedId });
      return result;
    } catch (error) {
      logger.error('Failed to archive patient', { error, id: validatedId });
      throw new AppError('Failed to archive patient', {
        code: 'PATIENT_ARCHIVE_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== PAYMENT MANAGEMENT ====================

  /**
   * Refund a payment
   */
  async refundPayment(id: string) {
    const validatedId = z.uuid().parse(id);

    try {
      const result = await paymentRepo.updatePaymentStatus(this.db, validatedId, {
        status: 'REFUNDED',
        updatedAt: new Date()
      });

      logger.info('Payment refunded', { paymentId: validatedId });
      return result;
    } catch (error) {
      logger.error('Failed to refund payment', { error, id: validatedId });
      throw new AppError('Failed to refund payment', {
        code: 'PAYMENT_REFUND_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== AUDIT SERVICES ====================

  /**
   * Get recent activity for a user
   */
  async getRecentActivity(userId: string, clinicId: string, limit = 20) {
    const validatedUserId = z.uuid().parse(userId);
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedLimit = z.number().int().min(1).max(100).parse(limit);

    try {
      return await dashboardRepo.findRecentActivity(this.db, validatedUserId, validatedClinicId, validatedLimit);
    } catch (error) {
      logger.error('Failed to get recent activity', { error, userId: validatedUserId, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve recent activity', {
        code: 'ACTIVITY_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== HELPER METHODS ====================

  private calculateOccupancyRate(
    totalAppointments: number,
    totalDoctors: number,
    workingHoursPerDay = 8,
    slotsPerHour = 2
  ): number {
    if (totalDoctors === 0) return 0;
    const totalCapacity = totalDoctors * workingHoursPerDay * slotsPerHour;
    return Math.min(Math.round((totalAppointments / totalCapacity) * 100), 100);
  }

  private groupAppointmentsByDay(appointments: Array<{ appointmentDate: Date }>): Record<string, number> {
    return appointments.reduce(
      (acc, apt) => {
        const day = apt.appointmentDate.toISOString().split('T')[0];
        if (day) acc[day] = (acc[day] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private calculateWaitTimeEstimate(
    appointments: Array<{ status?: string | null; appointmentDate: Date }>,
    availableDoctors: number
  ): number {
    if (availableDoctors === 0 || appointments.length === 0) return 0;

    const pendingAppointments = appointments.filter(a => a.status === 'SCHEDULED' || a.status === 'PENDING').length;

    // Assume 30 minutes per appointment
    return Math.ceil((pendingAppointments * 30) / availableDoctors);
  }

  private calculateTopDoctors(appointments: Awaited<ReturnType<typeof appointmentRepo.findForMonth>>): Array<{
    doctorId: string;
    doctorName: string;
    appointmentCount: number;
    revenue: number;
  }> {
    const doctorPerformance = new Map<string, { count: number; revenue: number; name: string }>();

    for (const apt of appointments) {
      if (!apt.doctorId) continue;

      const current = doctorPerformance.get(apt.doctorId) || {
        count: 0,
        revenue: 0,
        name: apt.doctor?.name || 'Unknown'
      };
      current.count++;
      current.revenue += toNumber(apt.appointmentPrice) || 0;
      doctorPerformance.set(apt.doctorId, current);
    }

    return Array.from(doctorPerformance.entries())
      .map(([doctorId, data]) => ({
        doctorId,
        doctorName: data.name,
        appointmentCount: data.count,
        revenue: data.revenue
      }))
      .sort((a, b) => b.appointmentCount - a.appointmentCount)
      .slice(0, 5);
  }

  private calculateRevenueByService(payments: Awaited<ReturnType<typeof paymentRepo.findPaymentsInRange>>): Array<{
    serviceName: string;
    revenue: number;
    count: number;
  }> {
    const serviceRevenue = new Map<string, { revenue: number; count: number }>();

    for (const payment of payments) {
      for (const bill of payment.bills || []) {
        const serviceName = bill.service?.serviceName || 'Unknown';
        const current = serviceRevenue.get(serviceName) || { revenue: 0, count: 0 };
        current.revenue += toNumber(bill.service?.price) ?? 0;
        current.count++;
        serviceRevenue.set(serviceName, current);
      }
    }

    return Array.from(serviceRevenue.entries())
      .map(([serviceName, data]) => ({
        serviceName,
        revenue: data.revenue,
        count: data.count
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  private unwrapPromise<T>(promiseResult: PromiseSettledResult<T>, defaultValue: T): T {
    return promiseResult.status === 'fulfilled' ? promiseResult.value : defaultValue;
  }
}

// Export singleton instance
export const adminService = new AdminService();

// Export service class for testing
export default AdminService;
