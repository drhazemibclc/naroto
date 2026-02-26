/**
 * 🔵 DOCTOR SERVICE
 * - Business logic for doctor management
 * - Orchestrates repository calls
 * - Zod validation for all inputs
 * - Caching with versioning
 * - Comprehensive error handling
 * - Transaction integrity
 */

import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@generated/client';
import { logger } from '@naroto/logger';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';
import { isBefore, isSameDay, isValid, parseISO, set, startOfDay } from 'date-fns';
import { format as formatTz, toZonedTime } from 'date-fns-tz';
import { z } from 'zod';

import { db, prisma } from '../client';
import { ApiError, AppError, NotFoundError, ValidationError } from '../error';
import * as doctorRepo from '../repositories/doctor.repo';
import type { Doctor } from '../types';
import { generateTimeSlots, toNumber } from '../utils';
import { processAppointments } from '../utils/helper';
import { type CreateDoctorInput, WorkingDaySchema } from '../zodSchemas';
import { cacheService } from './cache.service';

// const DEFAULT_TIMEZONE = 'Africa/Cairo';

// ==================== TYPE DEFINITIONS ====================

export type UpdateDoctorInput = Partial<CreateDoctorInput> & { id: string };

export interface DoctorDashboardStats {
  appointmentCounts: {
    scheduled: number;
    completed: number;
    cancelled: number;
    pending: number;
  };
  availableDoctors: number;
  monthlyData: Array<{
    name: string;
    appointment: number;
    completed: number;
  }>;
  recentAppointments: Array<{
    id: string;
    appointmentDate: Date;
    patient: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
    status: string;
  }>;
  totalAppointments: number;
  totalPatients: number;
}

export interface PaginatedDoctorsResult {
  currentPage: number;
  data: Doctor[];
  totalPages: number;
  totalRecords: number;
}

export interface DoctorWithAppointmentsResult {
  data: Awaited<ReturnType<typeof doctorRepo.findDoctorWithAppointments>>;
  totalAppointments: number;
}

// ==================== SERVICE CLASS ====================

export class DoctorService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';
  private readonly DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  constructor(private readonly db: typeof prisma = prisma) {}

  // ==================== READ OPERATIONS ====================

  /**
   * Get all doctors for a clinic
   */
  async getDoctorsByClinic(clinicId: string) {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.DOCTORS(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const doctors = await doctorRepo.findDoctorList(this.db, validatedClinicId);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, doctors, CACHE_TTL.DOCTORS);
      }

      return doctors;
    } catch (error) {
      logger.error('Failed to get doctors by clinic', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve doctors', {
        code: 'DOCTOR_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get doctor by ID with clinic validation
   */
  async getDoctorById(id: string, clinicId: string) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.DOCTOR(validatedId, validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const doctor = await doctorRepo.findDoctorById(this.db, validatedId, validatedClinicId);

      if (!doctor) {
        throw new NotFoundError('Doctor', validatedId);
      }

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, doctor, CACHE_TTL.DOCTOR);
      }

      return doctor;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get doctor by id', { error, id: validatedId });
      throw new AppError('Failed to retrieve doctor', {
        code: 'DOCTOR_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get doctor with appointments
   */
  async getDoctorWithAppointments(id: string, clinicId: string): Promise<DoctorWithAppointmentsResult> {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      const [doctor, totalAppointments] = await Promise.all([
        doctorRepo.findDoctorWithAppointments(this.db, validatedId, validatedClinicId),
        doctorRepo.countDoctorUpcomingAppointments(this.db, validatedId, new Date())
      ]);

      if (!doctor) {
        throw new NotFoundError('Doctor', validatedId);
      }

      return { data: doctor, totalAppointments };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get doctor with appointments', { error, id: validatedId });
      throw new AppError('Failed to retrieve doctor details', {
        code: 'DOCTOR_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get today's schedule for a clinic
   */
  async getTodaySchedule(clinicId: string) {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.TODAY_SCHEDULE(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const today = new Date();
      const dayName = this.DAYS_OF_WEEK[today.getDay()];

      const doctors = await doctorRepo.findDoctorsWorkingOnDay(this.db, validatedClinicId, dayName ?? 'monday', 50);

      // Enhance with appointments
      const schedule = await Promise.all(
        doctors.map(async doctor => {
          const appointments = await this.getDoctorAppointmentsForDate(doctor.id, validatedClinicId, today);
          return {
            ...doctor,
            appointments
          };
        })
      );

      // Cache result (short TTL for schedule)
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
   * Get available doctors for a clinic
   */
  async getAvailableDoctors(clinicId: string, date?: Date) {
    // Validate inputs
    const validatedClinicId = z.uuid().parse(clinicId);
    const targetDate = date && isValid(date) ? date : new Date();

    const cacheKey = date
      ? CACHE_KEYS.DOCTORS_AVAILABLE_DATE(validatedClinicId, targetDate.toISOString().split('T')[0] ?? '')
      : CACHE_KEYS.DOCTORS_AVAILABLE(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const dayName = this.DAYS_OF_WEEK[targetDate.getDay()];

      const doctors = await doctorRepo.findDoctorsWorkingOnDay(this.db, validatedClinicId, dayName ?? 'monday', 100);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, doctors, CACHE_TTL.DOCTORS);
      }

      return doctors;
    } catch (error) {
      logger.error('Failed to get available doctors', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve available doctors', {
        code: 'DOCTOR_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get doctor working days
   */
  async getDoctorWorkingDays(doctorId: string, clinicId: string) {
    // Validate inputs
    const validatedId = z.uuid().parse(doctorId);
    const validatedClinicId = z.uuid().parse(clinicId);

    try {
      // Verify doctor belongs to clinic
      await this.validateDoctorBelongsToClinic(validatedId, validatedClinicId);

      const workingDays = await doctorRepo.findDoctorWorkingDays(this.db, validatedId);
      return workingDays || [];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get doctor working days', { error, doctorId: validatedId });
      throw new AppError('Failed to retrieve working days', {
        code: 'WORKING_DAYS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get paginated doctors list
   */
  async getPaginatedDoctors(params: {
    clinicId: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<PaginatedDoctorsResult> {
    // Validate inputs
    const validatedClinicId = z.uuid().parse(params.clinicId);
    const validatedPage = z.number().int().positive().parse(params.page);
    const validatedLimit = z.number().int().positive().max(100).parse(params.limit);
    const validatedSearch = params.search ? z.string().min(1).parse(params.search) : undefined;

    const skip = (validatedPage - 1) * validatedLimit;

    const cacheKey = CACHE_KEYS.DOCTORS_PAGINATED(
      validatedClinicId,
      validatedSearch || 'all',
      validatedPage,
      validatedLimit
    );

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as PaginatedDoctorsResult;
      }

      const [doctors, totalRecords] = await doctorRepo.findPaginated(this.db, {
        clinicId: validatedClinicId,
        search: validatedSearch,
        skip,
        take: validatedLimit
      });

      const result: PaginatedDoctorsResult = {
        data: doctors,
        totalRecords,
        totalPages: Math.ceil(totalRecords / validatedLimit),
        currentPage: validatedPage
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.DOCTORS);
      }

      return result;
    } catch (error) {
      logger.error('Failed to get paginated doctors', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve doctors', {
        code: 'DOCTOR_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get doctor dashboard statistics
   */
  async getDoctorDashboardStats(doctorId: string, clinicId: string): Promise<DoctorDashboardStats> {
    // Validate inputs
    const validatedId = z.uuid().parse(doctorId);
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.DOCTOR_DASHBOARD(validatedId, validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as DoctorDashboardStats;
      }

      // Validate doctor belongs to clinic
      const doctor = await doctorRepo.findDoctorById(this.db, validatedId, validatedClinicId);
      if (!doctor) {
        throw new NotFoundError('Doctor', validatedId);
      }

      const todayStart = startOfDay(new Date());

      const { appointments, totalPatients, availableDoctors } = await doctorRepo.getDashboardCounts(
        this.db,
        validatedId,
        validatedClinicId,
        todayStart
      );

      const { appointmentCounts: rawCounts, monthlyData } = processAppointments(appointments);
      const appointmentCounts = {
        scheduled: rawCounts.SCHEDULED ?? 0,
        completed: rawCounts.COMPLETED ?? 0,
        cancelled: rawCounts.CANCELLED ?? 0,
        pending: rawCounts.PENDING ?? 0
      };
      const recentAppointments = appointments.slice(0, 5).map(apt => ({
        id: apt.id,
        appointmentDate: apt.appointmentDate,
        patient: apt.patient
          ? {
              id: apt.patient.id,
              firstName: apt.patient.firstName,
              lastName: apt.patient.lastName
            }
          : null,
        status: apt.status || 'UNKNOWN'
      }));

      const stats: DoctorDashboardStats = {
        totalPatients,
        availableDoctors,
        totalAppointments: appointments.length,
        appointmentCounts,
        recentAppointments,
        monthlyData
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, stats, CACHE_TTL.DASHBOARD);
      }

      return stats;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get doctor dashboard stats', { error, doctorId: validatedId });
      throw new AppError('Failed to retrieve dashboard statistics', {
        code: 'DASHBOARD_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== MUTATIONS ====================

  /**
   * Create or update a doctor
   */
  async upsertDoctor(input: CreateDoctorInput | UpdateDoctorInput, clinicId: string, userId: string) {
    // Validate inputs
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedUserId = z.uuid().parse(userId);

    // Determine if create or update
    const isUpdate = 'id' in input && input.id;

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Business rules
          if (!input.specialty) {
            throw new ValidationError('Specialty is required');
          }

          if (input.availableFromTime && input.availableToTime && input.availableFromTime >= input.availableToTime) {
            throw new ValidationError('Available from time must be before available to time');
          }

          // 2. For updates, verify doctor exists and belongs to clinic
          if (isUpdate) {
            const existing = await doctorRepo.findDoctorById(
              tx as unknown as PrismaClient,
              input.id as string,
              validatedClinicId
            );

            if (!existing) {
              throw new NotFoundError('Doctor', input.id);
            }
          }

          // 3. Prepare doctor data
          const doctorData: Prisma.DoctorCreateInput = {
            id: isUpdate ? (input.id as string) : randomUUID(),
            clinic: { connect: { id: validatedClinicId } },
            user: userId ? { connect: { id: validatedUserId } } : undefined,
            name: input.name ?? '',
            email: input.email,
            phone: input.phone,
            specialty: input.specialty,
            img: input.img,
            colorCode: input.colorCode,
            availableFromTime: input.availableFromTime,
            availableToTime: input.availableToTime,
            appointmentPrice: new Prisma.Decimal(toNumber(input.appointmentPrice) || 0),
            isActive: input.isActive ?? true,
            status: input.status || 'ACTIVE'
          };

          // 4. Upsert doctor
          let doctor;
          if (isUpdate) {
            doctor = await doctorRepo.updateDoctor(
              tx as unknown as PrismaClient,
              input.id as string,
              validatedClinicId,
              doctorData
            );
          } else {
            doctor = await doctorRepo.createDoctor(tx as unknown as PrismaClient, {
              ...doctorData,
              id: doctorData.id as string,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }

          // 5. Handle working days if provided
          const workingDays = 'workingDays' in input ? (input.workingDays as doctorRepo.WorkingDayInput[]) : undefined;
          if (workingDays && Array.isArray(workingDays) && workingDays.length > 0) {
            // Validate working days
            for (const day of workingDays) {
              WorkingDaySchema.parse(day);
            }

            // Delete existing working days
            await doctorRepo.deleteWorkingDays(tx as unknown as PrismaClient, doctor.id as string);

            // Create new working days
            await doctorRepo.createWorkingDays(
              tx as unknown as PrismaClient,
              workingDays.map(day => ({
                id: randomUUID(),
                doctorId: doctor.id,
                clinicId: validatedClinicId as string,
                day: day.day,
                startTime: day.startTime,
                endTime: day.endTime
              }))
            );
          }

          logger.info(isUpdate ? 'Doctor updated' : 'Doctor created', {
            doctorId: doctor.id,
            clinicId: validatedClinicId
          });

          return doctor;
        } catch (error) {
          logger.error('Failed to upsert doctor', { error, input });
          throw error;
        }
      })
      .then(async doctor => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validatedClinicId);
          await cacheService.invalidate(CACHE_KEYS.DOCTORS(validatedClinicId));
          if (isUpdate) {
            await cacheService.invalidate(CACHE_KEYS.DOCTOR(input.id as string, validatedClinicId));
          }
        }

        return doctor;
      });
  }

  /**
   * Delete a doctor (soft delete if has appointments)
   */
  async deleteDoctor(id: string, clinicId: string, _userId: string) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Validate access and existence
          const doctor = await doctorRepo.findDoctorById(tx as unknown as PrismaClient, validatedId, validatedClinicId);

          if (!doctor) {
            throw new NotFoundError('Doctor', validatedId);
          }

          // 2. Check if doctor has upcoming appointments
          const upcomingCount = await doctorRepo.countDoctorUpcomingAppointments(
            tx as unknown as PrismaClient,
            validatedId,
            new Date()
          );

          let result;
          if (upcomingCount > 0) {
            // Business rule: Soft delete if has upcoming appointments
            result = await doctorRepo.softDeleteDoctor(tx as unknown as PrismaClient, validatedId, validatedClinicId, {
              isDeleted: true,
              deletedAt: new Date()
            });

            logger.info('Doctor soft deleted (archived)', {
              doctorId: validatedId,
              upcomingCount
            });

            return {
              success: true,
              action: 'archived',
              message: `Doctor archived. ${upcomingCount} upcoming appointments will need reassignment.`,
              data: result
            };
          }

          // 3. Hard delete if no dependencies
          result = await doctorRepo.deleteDoctor(tx as unknown as PrismaClient, validatedId, validatedClinicId);

          logger.info('Doctor permanently deleted', { doctorId: validatedId });

          return {
            success: true,
            action: 'deleted',
            message: 'Doctor permanently deleted.',
            data: result
          };
        } catch (error) {
          logger.error('Failed to delete doctor', { error, id: validatedId });
          throw error;
        }
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validatedClinicId);
          await cacheService.invalidate(
            CACHE_KEYS.DOCTORS(validatedClinicId),
            CACHE_KEYS.DOCTOR(validatedId, validatedClinicId),
            CACHE_KEYS.ADMIN_DASHBOARD(validatedClinicId)
          );
        }

        return result;
      });
  }

  /**
   * Update doctor working days
   */
  async updateWorkingDays(doctorId: string, clinicId: string, workingDays: doctorRepo.WorkingDayInput[]) {
    // Validate inputs
    const validatedId = z.uuid().parse(doctorId);
    const validatedClinicId = z.uuid().parse(clinicId);

    // Validate working days
    for (const day of workingDays) {
      WorkingDaySchema.parse(day);
    }

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify doctor exists
          const doctor = await doctorRepo.findDoctorById(tx as unknown as PrismaClient, validatedId, validatedClinicId);

          if (!doctor) {
            throw new NotFoundError('Doctor', validatedId);
          }

          // Delete existing working days
          await doctorRepo.deleteWorkingDays(tx as unknown as PrismaClient, validatedId);

          // Create new working days
          const created = await doctorRepo.createWorkingDays(
            tx as unknown as PrismaClient,
            workingDays.map(day => ({
              id: randomUUID(),
              doctorId: validatedId,
              clinicId: validatedClinicId,
              day: day.day,
              startTime: day.startTime,
              endTime: day.endTime
            }))
          );

          logger.info('Doctor working days updated', { doctorId: validatedId });

          return created;
        } catch (error) {
          logger.error('Failed to update working days', { error, doctorId: validatedId });
          throw error;
        }
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await cacheService.invalidateClinicCaches(validatedClinicId);
          await cacheService.invalidate(CACHE_KEYS.DOCTOR(validatedId, validatedClinicId));
        }

        return result;
      });
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Validate that a doctor belongs to a clinic
   */
  private async validateDoctorBelongsToClinic(doctorId: string, clinicId: string) {
    const doctor = await doctorRepo.findDoctorById(this.db, doctorId, clinicId);
    if (!doctor) {
      throw new NotFoundError('Doctor', doctorId);
    }
    return doctor;
  }

  /**
   * Get doctor appointments for a specific date
   */
  private async getDoctorAppointmentsForDate(_doctorId: string, _clinicId: string, date: Date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // This would need to be implemented in appointment repo
    // For now, return empty array
    return [];
  }
}

const TIMEZONE = 'Africa/Cairo';

// Export singleton instance
export const doctorService = new DoctorService();

export async function getDoctorAvailableTimes(doctorId: string, date: string) {
  const doctor = await db.doctor.findFirst({ where: { id: doctorId } });

  if (!doctor) {
    throw new ApiError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');
  }

  const selectedDate = parseISO(date);
  const selectedDayOfWeek = selectedDate.getDay(); // 0 = Sunday ... 6 = Saturday

  // Ensure availableFromWeekDay and availableToWeekDay are not null before comparison
  if (doctor.availableToWeekDay === null || doctor.availableToWeekDay === null) {
    return [];
  }
  const doctorIsAvailable =
    selectedDayOfWeek >= doctor.availableToWeekDay && selectedDayOfWeek <= doctor.availableToWeekDay; // This line is now safe
  if (!doctorIsAvailable) {
    return [];
  }

  const appointments = await db.appointment.findMany({ where: { doctorId } });

  // Filter appointments on the selected date
  const appointmentsOnDate = appointments
    .filter((a: { appointmentDate: Date }) => isSameDay(a.appointmentDate, selectedDate))
    .map((a: { appointmentDate: Date }) =>
      formatTz(toZonedTime(a.appointmentDate, TIMEZONE), 'HH:mm:ss', {
        timeZone: TIMEZONE
      })
    );

  const slots = generateTimeSlots();

  const doctorFrom = set(new Date(), {
    hours: Number(doctor.availableFromTime?.split(':')[0]),
    minutes: Number(doctor.availableFromTime?.split(':')[1]),
    seconds: 0,
    milliseconds: 0
  });

  const doctorTo = set(new Date(), {
    hours: Number(doctor.availableToTime?.split(':')[0]),
    minutes: Number(doctor.availableToTime?.split(':')[1]),
    seconds: 0,
    milliseconds: 0
  });

  const validSlots = slots.filter(time => {
    const slot = set(new Date(), {
      hours: Number(time.split(':')[0]),
      minutes: Number(time.split(':')[1]),
      seconds: 0,
      milliseconds: 0
    });
    return slot >= doctorFrom && slot <= doctorTo;
  });

  const today = formatTz(toZonedTime(new Date(), TIMEZONE), 'yyyy-MM-dd', {
    timeZone: TIMEZONE
  });
  const now = toZonedTime(new Date(), TIMEZONE);

  return validSlots.map(time => {
    let available = !appointmentsOnDate.includes(time);

    if (date === today) {
      const slotTime = set(now, {
        hours: Number(time.split(':')[0]),
        minutes: Number(time.split(':')[1]),
        seconds: 0,
        milliseconds: 0
      });
      if (isBefore(slotTime, now)) {
        available = false;
      }
    }

    return { value: time, available, label: time.slice(0, 5) };
  });
} // Export service class for testing
export default DoctorService;
