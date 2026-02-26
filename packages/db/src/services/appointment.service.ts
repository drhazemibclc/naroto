/**
 * 🔵 APPOINTMENT SERVICE
 * - Business logic for appointments
 * - Orchestrates repository calls
 * - Zod validation for all inputs
 * - Caching with versioning
 * - Comprehensive error handling
 * - Transaction integrity
 */

import { randomUUID } from 'node:crypto';

import { logger } from '@naroto/logger';
import redis from '@naroto/redis';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';
import { isBefore, setHours, setMinutes, setSeconds } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { z } from 'zod';

import type { AppointmentStatus, Prisma, PrismaClient } from '../../generated/client';
import { prisma } from '../client';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../error';
import * as appointmentRepo from '../repositories/appointment.repo';
import * as doctorRepo from '../repositories/doctor.repo';
import * as patientRepo from '../repositories/patient.repo';
import { generateTimeSlots } from '../utils/time';
import {
  AppointmentCreateSchema,
  type AppointmentFilter,
  AppointmentFilterSchema,
  AppointmentUpdateSchema,
  AppointmentUpdateStatusSchema,
  type CreateAppointmentInput,
  type TimeSlot,
  type UpdateAppointmentInput,
  type UpdateAppointmentStatusInput
} from '../zodSchemas/appointment.schema';
import { cacheService } from './cache.service';

const TIMEZONE = 'Africa/Cairo';

// ==================== TYPE DEFINITIONS ====================

export interface AppointmentStats {
  byStatus: Record<AppointmentStatus, number>;
  totalAppointments: number;
  upcomingAppointments: number;
}

export interface DoctorSchedule {
  availableFromTime?: string | null;
  availableToTime?: string | null;
  id: string;
  name: string;
  workingDays?: Array<{ day: string; startTime: string; endTime: string }>;
}

// ==================== SERVICE CLASS ====================

export class AppointmentService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';
  private readonly DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  constructor(private readonly db: typeof prisma = prisma) {}

  // ==================== READ OPERATIONS ====================

  /**
   * Get appointment by ID
   */
  async getAppointmentById(id: string, clinicId?: string) {
    // Validate input
    const validatedId = z.uuid().parse(id);

    const cacheKey = CACHE_KEYS.APPOINTMENT(validatedId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const appointment = await appointmentRepo.findAppointmentById(this.db, validatedId, clinicId ?? '');

      // Verify clinic access if provided
      if (clinicId && appointment?.clinicId !== clinicId) {
        return null;
      }

      if (!appointment) {
        throw new NotFoundError('Appointment', validatedId);
      }

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, appointment, CACHE_TTL.APPOINTMENT);
      }

      return appointment;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get appointment', { error, id: validatedId });
      throw new AppError('Failed to retrieve appointment', {
        code: 'APPOINTMENT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get appointment with medical records
   */
  async getAppointmentWithMedical(id: string, clinicId?: string) {
    const validatedId = z.uuid().parse(id);

    try {
      const appointment = await appointmentRepo.findAppointmentByIdWithMedical(this.db, validatedId, clinicId ?? '');

      if (clinicId && appointment?.clinicId !== clinicId) {
        return null;
      }

      if (!appointment) {
        throw new NotFoundError('Appointment', validatedId);
      }

      return appointment;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get appointment with medical', { error, id: validatedId });
      throw new AppError('Failed to retrieve appointment', {
        code: 'APPOINTMENT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get today's appointments for a clinic
   */
  async getTodayAppointments(clinicId: string) {
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.APPOINTMENT_TODAY(validatedClinicId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const appointments = await appointmentRepo.findTodaySchedule(this.db, validatedClinicId, today);

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, appointments, CACHE_TTL.APPOINTMENT);
      }

      return appointments;
    } catch (error) {
      logger.error('Failed to get today appointments', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve today appointments', {
        code: 'APPOINTMENTS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get appointments for a specific month
   */
  async getMonthAppointments(clinicId: string, year: number, month: number) {
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedYear = z.number().int().min(2000).max(2100).parse(year);
    const validatedMonth = z.number().int().min(0).max(11).parse(month);

    const cacheKey = CACHE_KEYS.APPOINTMENTS_MONTH(validatedClinicId, validatedYear, validatedMonth);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const startDate = new Date(validatedYear, validatedMonth, 1);
      const endDate = new Date(validatedYear, validatedMonth + 1, 0);
      endDate.setHours(23, 59, 59, 999);

      const appointments = await appointmentRepo.findForMonth(this.db, validatedClinicId, startDate, endDate);

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, appointments, CACHE_TTL.APPOINTMENT);
      }

      return appointments;
    } catch (error) {
      logger.error('Failed to get month appointments', { error, clinicId: validatedClinicId, year, month });
      throw new AppError('Failed to retrieve month appointments', {
        code: 'APPOINTMENTS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get patient appointments
   */
  async getPatientAppointments(
    patientId: string,
    clinicId: string,
    options?: { limit?: number; includePast?: boolean }
  ) {
    const validatedPatientId = z.uuid().parse(patientId);
    const validatedClinicId = z.uuid().parse(clinicId);
    try {
      // Verify patient exists
      const patient = await patientRepo.getPatientById(this.db, validatedPatientId, validatedClinicId);
      if (!patient) {
        throw new NotFoundError('Patient', validatedPatientId);
      }

      return await appointmentRepo.findAppointmentsByPatient(this.db, {
        patientId: validatedPatientId,
        clinicId: validatedClinicId,
        ...options
      });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get patient appointments', { error, patientId: validatedPatientId });
      throw new AppError('Failed to retrieve patient appointments', {
        code: 'APPOINTMENTS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get doctor appointments
   */
  async getDoctorAppointments(doctorId: string, date: Date, clinicId: string) {
    const validatedDoctorId = z.uuid().parse(doctorId);

    try {
      // Verify doctor exists
      const doctor = await doctorRepo.findDoctorById(this.db, validatedDoctorId, clinicId);
      if (!doctor) {
        throw new NotFoundError('Doctor', validatedDoctorId);
      }

      if (date) {
        const validatedDate = z.date().parse(date);
        const startOfDay = new Date(validatedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(validatedDate);
        endOfDay.setHours(23, 59, 59, 999);

        return await appointmentRepo.findAppointmentsByDoctor(this.db, {
          doctorId: validatedDoctorId,
          clinicId,
          fromDate: startOfDay,
          toDate: endOfDay
        });
      }

      return await appointmentRepo.findAppointmentsByDoctor(this.db, {
        doctorId: validatedDoctorId,
        clinicId
      });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get doctor appointments', { error, doctorId: validatedDoctorId });
      throw new AppError('Failed to retrieve doctor appointments', {
        code: 'APPOINTMENTS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get appointment statistics
   */
  async getAppointmentStats(clinicId: string, fromDate?: Date, toDate?: Date): Promise<AppointmentStats> {
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey =
      fromDate && toDate
        ? CACHE_KEYS.APPOINTMENT_STAT_RANGE(validatedClinicId, fromDate.toISOString(), toDate.toISOString())
        : CACHE_KEYS.APPOINTMENT_STATS(validatedClinicId);

    try {
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as AppointmentStats;
      }

      const statsData = await appointmentRepo.getAppointmentStats(this.db, validatedClinicId, {
        fromDate,
        toDate
      });

      const byStatus = statsData.byStatus.reduce(
        (acc, item) => {
          if (item.status) {
            acc[item.status as AppointmentStatus] = item.count;
          }
          return acc;
        },
        {} as Record<AppointmentStatus, number>
      );

      const stats: AppointmentStats = {
        totalAppointments: statsData.total,
        byStatus,
        upcomingAppointments: statsData.upcoming
      };

      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, stats, CACHE_TTL.APPOINTMENT_STATS);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get appointment stats', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve appointment statistics', {
        code: 'STATS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== AVAILABLE TIMES BUSINESS LOGIC ====================

  /**
   * Get available time slots for a doctor on a specific date
   */
  async getAvailableTimes(doctorId: string, date: Date): Promise<TimeSlot[]> {
    const validatedDoctorId = z.uuid().parse(doctorId);
    const validatedDate = z.date().parse(date);

    try {
      // 1. Get doctor schedule
      const doctor = await doctorRepo.findDoctorWithSchedule(this.db, validatedDoctorId);

      if (!doctor) {
        throw new NotFoundError('Doctor', validatedDoctorId);
      }

      // 2. Check if doctor is available on this day
      const dayOfWeek = validatedDate.getDay();
      const dayName = this.DAYS_OF_WEEK[dayOfWeek];

      const isWorkingDay = doctor.workingDays?.some(wd => wd.day.toLowerCase() === dayName) ?? false;

      if (!isWorkingDay) {
        return [];
      }

      // 3. Get working hours for this day
      const workingDay = doctor.workingDays?.find(wd => wd.day.toLowerCase() === dayName);
      const fromTime = workingDay?.startTime || doctor.availableFromTime || '09:00';
      const toTime = workingDay?.endTime || doctor.availableToTime || '17:00';

      // 4. Get already booked times
      const bookedAppointments = await appointmentRepo.findBookedTimes(this.db, validatedDoctorId, validatedDate);
      const bookedTimes = new Set(bookedAppointments.map(a => a.time).filter((time): time is string => time !== null));

      // 5. Generate all time slots
      const allSlots = generateTimeSlots();

      // 6. Filter slots within working hours
      const validSlots = allSlots.filter(time => time >= fromTime && time <= toTime);

      // 7. Check availability and add real-time constraints
      const now = new Date();
      const isToday = validatedDate.toDateString() === now.toDateString();

      return validSlots.map(time => {
        let available = !bookedTimes.has(time);

        if (isToday && available) {
          const [hours, minutes] = time.split(':').map(Number);
          const slotTime = new Date(validatedDate);
          slotTime.setHours(hours ?? 0, minutes, 0, 0);

          if (isBefore(slotTime, now)) {
            available = false;
          }
        }

        return {
          value: time,
          available,
          label: `${time}${available ? '' : ' (Unavailable)'}`
        };
      });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get available times', { error, doctorId: validatedDoctorId, date: validatedDate });
      throw new AppError('Failed to retrieve available times', {
        code: 'AVAILABLE_TIMES_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== WRITE OPERATIONS ====================

  /**
   * Create a new appointment
   */
  async createAppointment(input: CreateAppointmentInput, clinicId: string) {
    // Validate input
    const validated = AppointmentCreateSchema.parse(input);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Verify patient exists
          const patient = await patientRepo.getPatientById(
            tx as unknown as PrismaClient,
            validated.patientId,
            clinicId
          );
          if (!patient) {
            throw new NotFoundError('Patient', validated.patientId);
          }

          // 2. Verify doctor exists
          const doctor = await doctorRepo.findDoctorById(tx as unknown as PrismaClient, validated.doctorId, clinicId);
          if (!doctor) {
            throw new NotFoundError('Doctor', validated.doctorId);
          }

          // 3. Check if time is available
          const availableTimes = await this.getAvailableTimes(validated.doctorId, validated.appointmentDate);

          const isSlotAvailable = availableTimes.some(slot => slot.value === validated.time && slot.available);

          if (!isSlotAvailable) {
            throw new ValidationError('Selected time is not available');
          }

          // 4. Check for overlapping appointments
          const appointmentDateTime = this.buildAppointmentDateTime(validated.appointmentDate, validated.time || '');

          const isOverlapping = await appointmentRepo.checkAppointmentOverlap(
            tx as unknown as PrismaClient,
            validated.doctorId,
            validated.clinicId,
            validated.appointmentDate,
            validated.time ?? '00:00',
            validated.duration
          );
          if (isOverlapping) {
            throw new ConflictError('This time slot overlaps with another appointment');
          }

          // 5. Create appointment
          const now = new Date();
          const appointment = await appointmentRepo.createAppointment(tx as unknown as PrismaClient, {
            id: randomUUID(),
            clinicId: patient.clinicId,
            patientId: validated.patientId,
            doctorId: validated.doctorId,
            serviceId: validated.serviceId,
            appointmentDate: appointmentDateTime,
            time: validated.time,
            type: validated.type,
            status: 'SCHEDULED',
            appointmentPrice: validated.appointmentPrice,
            createdAt: now,
            updatedAt: now
          });

          logger.info('Appointment created', {
            appointmentId: appointment.id,
            patientId: validated.patientId,
            doctorId: validated.doctorId
          });

          return appointment;
        } catch (error) {
          logger.error('Failed to create appointment', { error, input: validated });
          throw error;
        }
      })
      .then(async appointment => {
        // AFTER transaction succeeds, invalidate caches
        await this.invalidateAppointmentCaches(validated.clinicId, {
          patientId: validated.patientId,
          doctorId: validated.doctorId,
          appointmentDate: validated.appointmentDate
        });

        return appointment;
      });
  }

  /**
   * Update an appointment
   */
  async updateAppointment(input: UpdateAppointmentInput, clinicId: string) {
    // Validate input
    const validated = AppointmentUpdateSchema.parse(input);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify appointment exists
          const existing = await appointmentRepo.findAppointmentById(
            tx as unknown as PrismaClient,
            validated.id,
            clinicId
          );

          if (!existing) {
            throw new NotFoundError('Appointment', validated.id);
          }

          // If changing doctor or time, check availability
          if (validated.doctorId || validated.appointmentDate || validated.time) {
            const doctorId = validated.doctorId || existing.doctorId;
            const appointmentDate = validated.appointmentDate || existing.appointmentDate;
            const time = validated.time || existing.time;

            if (time) {
              const availableTimes = await this.getAvailableTimes(doctorId, appointmentDate);

              const isSlotAvailable = availableTimes.some(slot => slot.value === time && slot.available);

              if (!isSlotAvailable && doctorId === existing.doctorId) {
                throw new ValidationError('Selected time is not available');
              }
            }

            // Check for overlaps if date/time changed
            if (validated.appointmentDate || validated.time || validated.doctorId) {
              // appointmentDateTime is not needed here (overlap check uses discrete fields)
              // determine numeric duration using validated value or existing record (default 0)
              const durationToCheck = validated.duration ?? existing.duration ?? 0;

              const isOverlapping = await appointmentRepo.checkAppointmentOverlap(
                tx as unknown as PrismaClient,
                doctorId,
                clinicId,
                validated.appointmentDate || existing.appointmentDate,
                validated.time || existing.time || '',
                durationToCheck
              );

              if (isOverlapping) {
                throw new ConflictError('This time slot overlaps with another appointment');
              }
            }
          }

          const now = new Date();
          const updated = await appointmentRepo.updateAppointment(
            tx as unknown as PrismaClient,
            validated.id,
            clinicId,
            {
              ...validated,
              updatedAt: now
            }
          );

          logger.info('Appointment updated', { appointmentId: validated.id });

          return updated;
        } catch (error) {
          logger.error('Failed to update appointment', { error, input: validated });
          throw error;
        }
      })
      .then(async updated => {
        // AFTER transaction succeeds, invalidate caches
        const existing = await appointmentRepo.findAppointmentById(this.db, validated.id, clinicId);
        if (existing) {
          await this.invalidateAppointmentCaches(clinicId, {
            patientId: existing.patientId,
            doctorId: existing.doctorId,
            appointmentDate: existing.appointmentDate
          });
        }

        return updated;
      });
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(input: UpdateAppointmentStatusInput, clinicId: string) {
    // Validate input
    const validated = AppointmentUpdateStatusSchema.parse(input);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify appointment exists
          const existing = await appointmentRepo.findAppointmentById(
            tx as unknown as PrismaClient,
            validated.id,
            clinicId
          );

          if (!existing) {
            throw new NotFoundError('Appointment', validated.id);
          }

          // const now = new Date();
          const updated = await appointmentRepo.updateAppointmentStatus(
            tx as unknown as PrismaClient,
            validated.id,
            clinicId,
            validated.status,
            validated.reason
          );

          logger.info('Appointment status updated', {
            appointmentId: validated.id,
            status: validated.status
          });

          return updated;
        } catch (error) {
          logger.error('Failed to update appointment status', { error, input: validated });
          throw error;
        }
      })
      .then(async updated => {
        // AFTER transaction succeeds, invalidate caches
        const existing = await appointmentRepo.findAppointmentById(this.db, validated.id, clinicId);
        if (existing) {
          await this.invalidateAppointmentCaches(validated.id, {
            patientId: existing.patientId,
            doctorId: existing.doctorId,
            appointmentDate: existing.appointmentDate
          });
        }

        return { success: true, data: updated, error: null };
      });
  }
  async searchAppointment(query: string, clinicId: string, limit = 10) {
    const validatedQuery = z.string().min(2).parse(query);
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedLimit = z.number().int().min(1).max(100).default(10).parse(limit);

    try {
      // Search patients
      const patients = await patientRepo.searchPatients(this.db, {
        clinicId: validatedClinicId,
        query: validatedQuery,
        limit: validatedLimit
      });

      // Search appointments by patient name
      const appointments = await appointmentRepo.searchAppointmentsByPatientName(
        this.db,
        validatedClinicId,
        validatedQuery,
        validatedLimit
      );

      return {
        patients: patients.map(p => ({
          ...p,
          fullName: `${p.firstName} ${p.lastName}`
        })),
        appointments: appointments.map(a => ({
          id: a.id,
          date: a.appointmentDate,
          patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Unknown'
        }))
      };
    } catch (error) {
      logger.error('Failed to search appointments', { error, query: validatedQuery, clinicId: validatedClinicId });
      throw new AppError('Failed to search appointments', {
        code: 'APPOINTMENT_SEARCH_ERROR',
        statusCode: 500
      });
    }
  }
  /**
   * Delete an appointment (soft delete)
   */
  async deleteAppointment(id: string, clinicId: string, userId: string, permanent = false) {
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // Verify appointment exists and belongs to clinic
          const existing = await appointmentRepo.findAppointmentById(
            tx as unknown as PrismaClient,
            validatedId,
            clinicId
          );

          if (!existing || existing.clinicId !== validatedClinicId) {
            throw new NotFoundError('Appointment', validatedId);
          }

          let result;
          if (permanent) {
            result = await appointmentRepo.deletePermanently(tx as unknown as PrismaClient, validatedId);
            logger.info('Appointment permanently deleted', { appointmentId: validatedId });
          } else {
            result = await appointmentRepo.softDeleteAppointment(
              tx as unknown as PrismaClient,
              validatedId,
              validatedClinicId,
              userId
            );
            logger.info('Appointment soft deleted', { appointmentId: validatedId });
          }

          return result;
        } catch (error) {
          logger.error('Failed to delete appointment', { error, id: validatedId });
          throw error;
        }
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches
        const existing = await appointmentRepo.findAppointmentById(this.db, validatedId, clinicId);
        if (existing) {
          await this.invalidateAppointmentCaches(clinicId, {
            patientId: existing.patientId,
            doctorId: existing.doctorId,
            appointmentDate: existing.appointmentDate
          });
        }

        return result;
      });
  }

  async getAppointments(clinicId: string, filter: AppointmentFilter) {
    try {
      const validated = AppointmentFilterSchema.parse(filter);

      const { startDate, endDate, patientId, doctorId, status, type, page = 1, limit = 10 } = validated;

      const offset = (page - 1) * limit;

      const [appointments, total] = await Promise.all([
        appointmentRepo.appointmentQueries.find(this.db, {
          clinicId,
          limit,
          offset,
          fromDate: startDate,
          toDate: endDate,
          status,
          type,
          patientId,
          doctorId
        }),
        appointmentRepo.appointmentQueries.count(this.db, clinicId, {
          startDate,
          endDate,
          status
        })
      ]);

      return {
        items: appointments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get appointments', { error, clinicId, filter });
      throw new AppError('Failed to retrieve appointments', {
        code: 'APPOINTMENTS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  async cancelAppointment(id: string, userId: string, clinicId: string, reason?: string) {
    try {
      const existing = await appointmentRepo.appointmentQueries.findById(this.db, id, clinicId);
      if (!existing) {
        throw new AppError('Failed to retrieve appointments', {
          code: 'APPOINTMENTS_FETCH_ERROR',
          statusCode: 500
        });
      }

      const appointment = await appointmentRepo.appointmentQueries.update(this.db, id, clinicId, {
        status: 'CANCELLED',
        reason,
        updatedAt: new Date()
      });

      // Invalidate caches
      if (this.CACHE_ENABLED) {
        await this.invalidateAppointmentCaches(existing.clinicId, {
          appointmentId: id,
          appointmentDate: existing.appointmentDate,
          patientId: existing.patientId
        });
      }

      logger.info('Appointment cancelled', { appointmentId: id, userId, reason });
      return appointment;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to cancel appointment', { error, clinicId, id });
      throw new AppError('Failed to retrieve appointments', {
        code: 'APPOINTMENTS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  async checkInPatient(id: string, userId: string, clinicId: string) {
    try {
      const existing = await appointmentRepo.appointmentQueries.findById(this.db, id, clinicId);
      if (!existing) {
        throw new AppError('Appointment not found', {
          code: 'APPOINTMENT_NOT_FOUND',
          statusCode: 404
        });
      }

      const appointment = await appointmentRepo.appointmentQueries.update(this.db, id, clinicId, {
        status: 'CHECKED_IN' as AppointmentStatus,

        updatedAt: new Date()
      });

      if (this.CACHE_ENABLED) {
        await this.invalidateAppointmentCaches(existing.clinicId, {
          appointmentId: id,
          appointmentDate: existing.appointmentDate,
          patientId: existing.patientId
        });
      }

      logger.info('Patient checked in', { appointmentId: id, userId });
      return appointment;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to check in patient', { error, id, userId });
      throw new AppError('Failed to check in patient', {
        code: 'PATIENT_CHECK_IN_ERROR',
        statusCode: 500
      });
    }
  }

  async completeAppointment(id: string, userId: string, clinicId: string, notes?: string) {
    try {
      const existing = await appointmentRepo.appointmentQueries.findById(this.db, id, clinicId);
      if (!existing) {
        throw new AppError('Failed to retrieve appointments', {
          code: 'APPOINTMENT_NOT_FOUND',
          statusCode: 404
        });
      }

      const appointment = await appointmentRepo.appointmentQueries.update(this.db, id, clinicId, {
        status: 'COMPLETED',
        appointmentDate: new Date(),

        note: notes,

        updatedAt: new Date()
      });

      if (this.CACHE_ENABLED) {
        await this.invalidateAppointmentCaches(existing.clinicId, {
          appointmentId: id,
          appointmentDate: existing.appointmentDate,
          patientId: existing.patientId,
          doctorId: existing.doctorId
        });
      }

      logger.info('Appointment completed', { appointmentId: id, userId });
      return appointment;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to complete appointment', { error, id, userId });
      throw new AppError('Failed to complete appointment', {
        code: 'APPOINTMENT_COMPLETE_ERROR',
        statusCode: 500
      });
    }
  }
  private async invalidateAppointmentCaches(
    clinicId: string,
    options?: {
      appointmentDate: Date;
      appointmentId?: string;
      patientId?: string;
      doctorId?: string;
    }
  ) {
    const keys: string[] = [];

    // Invalidate specific appointment
    if (options?.appointmentId) {
      keys.push(`${CACHE_KEYS.APPOINTMENT}${options.appointmentId}`);
    }

    // Invalidate list caches
    keys.push(`${CACHE_KEYS.APPOINTMENT_TODAY}${clinicId}`);
    keys.push(`${CACHE_KEYS.APPOINTMENT_STATS}${clinicId}:day`);
    keys.push(`${CACHE_KEYS.APPOINTMENT_STATS}${clinicId}:week`);
    keys.push(`${CACHE_KEYS.APPOINTMENT_STATS}${clinicId}:month`);

    // Invalidate patient appointments if needed
    if (options?.patientId) {
      keys.push(`${CACHE_KEYS.PATIENT_APPOINTMENTS}${options.patientId}`);
    }

    // Invalidate doctor appointments if needed
    if (options?.doctorId) {
      keys.push(`${CACHE_KEYS.DOCTOR_APPOINTMENTS}${options.doctorId}`);
    }

    // Invalidate dashboard stats
    keys.push(`${CACHE_KEYS.DASHBOARD_STATS}${clinicId}`);

    try {
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug('Invalidated appointment caches', { keys });
      }
    } catch (error) {
      logger.error('Failed to invalidate caches', { error, keys });
      // Don't throw - cache invalidation failure shouldn't break the operation
    }
  }
  // ==================== UTILITIES ====================

  /**
   * Build appointment date time from date and time string
   */
  private buildAppointmentDateTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const zonedDate = toZonedTime(date, TIMEZONE);
    return setSeconds(setMinutes(setHours(zonedDate, hours ?? 0), minutes ?? 0), 0);
  }
}

// Export singleton instance
export const appointmentService = new AppointmentService();

// Export service class for testing
export default AppointmentService;
