/**
 * 🔵 VISIT SERVICE
 * - Business logic for appointments/visits
 * - Orchestrates repository calls
 * - Zod validation for all inputs
 * - Caching with versioning
 * - Comprehensive error handling
 * - Transaction integrity
 */

import { randomUUID } from 'node:crypto';

import type { AppointmentStatus, Prisma, PrismaClient } from '@generated/client';
import { logger } from '@naroto/logger';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';
import { z } from 'zod';

import { prisma } from '../client';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../error';
import * as doctorRepo from '../repositories/doctor.repo';
import * as patientRepo from '../repositories/patient.repo';
import * as serviceRepo from '../repositories/service.repo';
import * as visitRepo from '../repositories/visit.repo';
import type { Doctor, WorkingDays } from '../types';
import { toNumber } from '../utils';
import {
  type VisitCreateInput,
  VisitCreateSchema,
  type VisitUpdateInput,
  VisitUpdateSchema
} from '../zodSchemas/visit.schema';
import { cacheService } from './cache.service';

// ==================== TYPE DEFINITIONS ====================

export interface VisitWithDetails {
  appointmentDate: Date;
  appointmentPrice?: number | null;
  doctor: {
    id: string;
    name: string | null;
    specialty: string | null;
    email: string | null;
    img: string | null;
    colorCode: string | null;
    workingDays?: WorkingDays[];
  } | null;
  id: string;
  medical?: {
    id: string;
    createdAt: Date;
  } | null;
  notes?: string | null;
  patient: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: Date | null;
    phone: string | null;
    email: string | null;
    image: string | null;
    colorCode: string | null;
  } | null;
  reason?: string | null;
  service?: {
    id: string;
    serviceName: string;
    price: number;
    duration: number | null;
  } | null;
  status: AppointmentStatus;
  time?: string | null;
  type: string;
}

export interface VisitCountsByStatus {
  CANCELLED: number;
  COMPLETED: number;
  IN_PROGRESS: number;
  NO_SHOW: number;
  PENDING: number;
  SCHEDULED: number;
  [key: string]: number;
}

export interface VisitStatistics {
  byDoctor: Array<{
    doctorId: string;
    _count: number;
  }>;
  byStatus: VisitCountsByStatus;
  revenue: number;
  total: number;
}

export interface PaginatedVisitsResult {
  currentPage: number;
  data: VisitWithDetails[];
  limit: number;
  totalPages: number;
  totalRecords: number;
}

// ==================== SERVICE CLASS ====================

export class VisitService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';

  constructor(private readonly db: typeof prisma = prisma) {}

  // ==================== READ OPERATIONS ====================

  /**
   * Get visit by ID
   */
  async getVisitById(id: string, clinicId?: string): Promise<VisitWithDetails | null> {
    // Validate input
    const validatedId = z.uuid().parse(id);

    const cacheKey = CACHE_KEYS.VISIT(validatedId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as VisitWithDetails;
      }

      const visit = await visitRepo.findVisitById(this.db, validatedId);

      // Verify clinic access if provided
      if (clinicId && visit?.patient?.clinicId !== clinicId) {
        return null;
      }

      if (!visit) {
        throw new NotFoundError('Visit', validatedId);
      }

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, visit, CACHE_TTL.VISIT);
      }

      return visit as unknown as VisitWithDetails;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get visit', { error, id: validatedId });
      throw new AppError('Failed to retrieve visit', {
        code: 'VISIT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get visits by patient
   */
  async getVisitsByPatient(
    patientId: string,
    clinicId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      status?: AppointmentStatus | AppointmentStatus[];
    }
  ) {
    // Validate inputs
    const validatedPatientId = z.uuid().parse(patientId);
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.PATIENT_VISITS(validatedPatientId);

    try {
      // Verify patient exists
      await this.verifyPatientAccess(validatedPatientId, validatedClinicId);

      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const visits = await visitRepo.findVisitsByPatient(this.db, validatedPatientId, options);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, visits, CACHE_TTL.VISIT_LIST);
      }

      return visits;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get patient visits', { error, patientId: validatedPatientId });
      throw new AppError('Failed to retrieve patient visits', {
        code: 'VISIT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get visits by clinic with filters
   */
  async getVisitsByClinic(
    clinicId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      status?: AppointmentStatus | AppointmentStatus[];
      doctorId?: string;
      search?: string;
    }
  ) {
    // Validate inputs
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.CLINIC_VISITS(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const visits = await visitRepo.findVisitsByClinic(this.db, validatedClinicId, options);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, visits, CACHE_TTL.VISIT_LIST);
      }

      return visits;
    } catch (error) {
      logger.error('Failed to get clinic visits', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve clinic visits', {
        code: 'VISIT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get recent visits for a clinic
   */
  async getRecentVisits(clinicId: string, limit = 5) {
    // Validate inputs
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedLimit = z.number().int().min(1).max(20).parse(limit);

    const cacheKey = CACHE_KEYS.RECENT_VISITS(validatedClinicId, validatedLimit);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const visits = await visitRepo.findVisitsByClinic(this.db, validatedClinicId, {
        limit: validatedLimit
      });

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, visits, CACHE_TTL.VISIT_LIST);
      }

      return visits;
    } catch (error) {
      logger.error('Failed to get recent visits', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve recent visits', {
        code: 'VISIT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get today's visits for a clinic
   */
  async getTodayVisits(clinicId: string) {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.TODAY_VISITS(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      const visits = await visitRepo.findVisitsByDateRange(this.db, validatedClinicId, startOfDay, endOfDay);

      // Cache result (short TTL for today's visits)
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, visits, CACHE_TTL.TODAY_VISITS);
      }

      return visits;
    } catch (error) {
      logger.error('Failed to get today visits', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve today visits', {
        code: 'VISIT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get upcoming visits for a clinic
   */
  async getUpcomingVisits(clinicId: string, options?: { limit?: number; doctorId?: string }) {
    // Validate inputs
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.UPCOMING_VISITS(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
      }

      const visits = await visitRepo.findUpcomingVisits(this.db, validatedClinicId, options);

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, visits, CACHE_TTL.VISIT_LIST);
      }

      return visits;
    } catch (error) {
      logger.error('Failed to get upcoming visits', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve upcoming visits', {
        code: 'VISIT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get visit count for today
   */
  async getTodayVisitCount(clinicId: string): Promise<number> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);

    const cacheKey = CACHE_KEYS.TODAY_VISIT_COUNT(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as number;
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      const count = await visitRepo.countVisits(this.db, validatedClinicId, {
        startDate: startOfDay,
        endDate: endOfDay
      });

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, count, CACHE_TTL.COUNT);
      }

      return count;
    } catch (error) {
      logger.error('Failed to get today visit count', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve visit count', {
        code: 'COUNT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get month visit count
   */
  async getMonthVisitCount(clinicId: string): Promise<number> {
    // Validate input
    const validatedClinicId = z.uuid().parse(clinicId);
    const now = new Date();
    const cacheKey = CACHE_KEYS.MONTH_VISIT_COUNT(validatedClinicId, now.getFullYear(), now.getMonth() + 1);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as number;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const count = await visitRepo.countVisits(this.db, validatedClinicId, {
        startDate: startOfMonth,
        endDate: endOfMonth
      });

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, count, CACHE_TTL.COUNT);
      }

      return count;
    } catch (error) {
      logger.error('Failed to get month visit count', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve visit count', {
        code: 'COUNT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get visit count by status
   */
  async getVisitCountByStatus(clinicId: string, status: AppointmentStatus): Promise<number> {
    // Validate inputs
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedStatus = z
      .enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'PENDING', 'IN_PROGRESS'])
      .parse(status);

    const cacheKey = CACHE_KEYS.VISIT_COUNT_BY_STATUS(validatedClinicId, validatedStatus);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as number;
      }

      const count = await visitRepo.countVisits(this.db, validatedClinicId, {
        status: validatedStatus as AppointmentStatus
      });

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, count, CACHE_TTL.COUNT);
      }

      return count;
    } catch (error) {
      logger.error('Failed to get visit count by status', {
        error,
        clinicId: validatedClinicId,
        status: validatedStatus
      });
      throw new AppError('Failed to retrieve visit count', {
        code: 'COUNT_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  /**
   * Get visit statistics for date range
   */
  async getVisitStatistics(clinicId: string, startDate: Date, endDate: Date): Promise<VisitStatistics> {
    // Validate inputs
    const validatedClinicId = z.uuid().parse(clinicId);
    const validatedStartDate = z.date().parse(startDate);
    const validatedEndDate = z.date().parse(endDate);

    const cacheKey = CACHE_KEYS.VISIT_STATISTICS(validatedClinicId);

    try {
      // Check cache
      if (this.CACHE_ENABLED) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached as VisitStatistics;
      }

      const stats = await visitRepo.getVisitStatistics(
        this.db,
        validatedClinicId,
        validatedStartDate,
        validatedEndDate
      );

      // Ensure byStatus matches VisitCountsByStatus interface
      const byStatus: VisitCountsByStatus = {
        CANCELLED: stats.byStatus.CANCELLED || 0,
        COMPLETED: stats.byStatus.COMPLETED || 0,
        IN_PROGRESS: stats.byStatus.IN_PROGRESS || 0,
        NO_SHOW: stats.byStatus.NO_SHOW || 0,
        PENDING: stats.byStatus.PENDING || 0,
        SCHEDULED: stats.byStatus.SCHEDULED || 0
      };

      const result: VisitStatistics = {
        ...stats,
        byStatus,
        revenue: toNumber(stats.revenue) || 0
      };

      // Cache result
      if (this.CACHE_ENABLED) {
        await cacheService.set(cacheKey, result, CACHE_TTL.STATS);
      }

      return result;
    } catch (error) {
      logger.error('Failed to get visit statistics', { error, clinicId: validatedClinicId });
      throw new AppError('Failed to retrieve visit statistics', {
        code: 'STATS_FETCH_ERROR',
        statusCode: 500
      });
    }
  }

  // ==================== MUTATION OPERATIONS ====================

  /**
   * Create a new visit
   */
  async createVisit(input: VisitCreateInput & { clinicId: string }, userId: string) {
    // Validate input
    const validated = VisitCreateSchema.extend({
      clinicId: z.uuid()
    }).parse(input);
    const validatedUserId = z.uuid().parse(userId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Validate patient exists and belongs to clinic
          const patient = await patientRepo.getPatientById(
            tx as unknown as PrismaClient,
            validated.patientId,
            validated.clinicId
          );

          if (!patient) {
            throw new NotFoundError('Patient', validated.patientId);
          }

          // 2. Validate doctor exists and belongs to clinic
          const doctor = await doctorRepo.findDoctorById(
            tx as unknown as PrismaClient,
            validated.doctorId,
            validated.clinicId
          );

          if (!doctor) {
            throw new NotFoundError('Doctor', validated.doctorId);
          }

          // 3. Validate service if provided
          if (validated.serviceId) {
            const service = await serviceRepo.findServiceById(
              tx as unknown as PrismaClient,
              validated.serviceId,
              validated.clinicId
            );

            if (!service) {
              throw new NotFoundError('Service', validated.serviceId);
            }
          }

          // 4. Business rule: Check for overlapping appointments
          const duration = validated.duration || 30; // Default 30 minutes
          const overlapping = await visitRepo.findOverlappingVisits(
            tx as unknown as PrismaClient,
            validated.doctorId,
            validated.appointmentDate,
            duration,
            undefined
          );

          if (overlapping) {
            throw new ConflictError('Doctor already has an appointment scheduled at this time');
          }

          // 5. Business rule: Validate working hours if time is provided
          if (validated.time) {
            await this.validateWorkingHours(doctor, validated.time, validated.appointmentDate);
          }

          // 6. Create visit
          const now = new Date();
          const visit = await visitRepo.createVisit(tx as unknown as PrismaClient, {
            id: randomUUID(),
            clinicId: validated.clinicId,
            patientId: validated.patientId,
            doctorId: validated.doctorId,
            // zod schema gives serviceId as { id: string } when present,
            // persistence expects a string or null so extract the id.
            serviceId: validated.serviceId ? validated.serviceId : null,
            appointmentDate: validated.appointmentDate,
            time: validated.time,
            duration: validated.duration,
            type: validated.type || 'CHECKUP',
            reason: validated.reason,
            notes: validated.notes,
            status: validated.status || 'SCHEDULED',
            appointmentPrice: validated.appointmentPrice ? toNumber(validated.appointmentPrice) : null,
            createdById: validatedUserId,
            createdAt: now,
            updatedAt: now
          });

          logger.info('Visit created', {
            visitId: visit.id,
            patientId: validated.patientId,
            doctorId: validated.doctorId,
            clinicId: validated.clinicId
          });

          return visit;
        } catch (error) {
          logger.error('Failed to create visit', { error, input: validated });
          throw error;
        }
      })
      .then(async visit => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          await this.invalidateVisitCaches(visit.id, {
            patientId: validated.patientId,
            doctorId: validated.doctorId,
            clinicId: validated.clinicId,
            date: validated.appointmentDate
          });
        }

        return visit;
      });
  }

  /**
   * Update an existing visit
   */
  async updateVisit(id: string, input: VisitUpdateInput) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validated = VisitUpdateSchema.parse(input);
    // const validatedUserId = z.uuid().parse(userId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Get existing visit
          const existing = await visitRepo.findVisitById(tx as unknown as PrismaClient, validatedId);

          if (!existing) {
            throw new NotFoundError('Visit', validatedId);
          }

          // 2. Verify clinic access (using the clinicId from existing visit)
          // This would typically be done by checking user permissions

          // 3. If changing doctor or date, check for overlaps
          if (validated.doctorId || validated.appointmentDate) {
            const doctorId = validated.doctorId || existing.doctorId;
            const appointmentDate = validated.appointmentDate || existing.appointmentDate;
            const duration = validated.duration || existing.duration || 30;

            const overlapping = await visitRepo.findOverlappingVisits(
              tx as unknown as PrismaClient,
              doctorId,
              appointmentDate,
              duration,
              validatedId
            );

            if (overlapping) {
              throw new ConflictError('Doctor already has an appointment scheduled at this time');
            }
          }

          // 4. If changing time, validate working hours
          if (validated.time && validated.time !== existing.time) {
            const doctor = await doctorRepo.findDoctorById(
              tx as unknown as PrismaClient,
              validated.doctorId || existing.doctorId,
              existing.clinicId
            );

            if (doctor) {
              await this.validateWorkingHours(
                doctor as unknown as Doctor,
                validated.time,
                validated.appointmentDate || existing.appointmentDate
              );
            }
          }

          // 5. Update visit
          const now = new Date();
          const visit = await visitRepo.updateVisit(tx as unknown as PrismaClient, validatedId, {
            doctorId: validated.doctorId,
            // extract string id from the object or fall back to null
            serviceId: validated.serviceId ? validated.serviceId.id : null,
            appointmentDate: validated.appointmentDate,
            time: validated.time,
            duration: validated.duration,
            type: validated.type,
            reason: validated.reason,
            notes: validated.notes,
            status: validated.status,
            appointmentPrice: validated.appointmentPrice ? toNumber(validated.appointmentPrice) : null,
            updatedAt: now
          });

          logger.info('Visit updated', { visitId: validatedId });

          return visit;
        } catch (error) {
          logger.error('Failed to update visit', { error, id: validatedId });
          throw error;
        }
      })
      .then(async visit => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          const existing = await visitRepo.findVisitById(this.db, validatedId);
          if (existing) {
            await this.invalidateVisitCaches(validatedId, {
              patientId: existing.patientId,
              doctorId: existing.doctorId,
              clinicId: existing.clinicId,
              date: existing.appointmentDate
            });
          }
        }

        return visit;
      });
  }

  /**
   * Update visit status
   */
  async updateVisitStatus(id: string, status: AppointmentStatus, reason?: string) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedStatus = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'PENDING']).parse(status);
    // const validatedUserId = z.uuid().parse(userId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Get existing visit
          const existing = await visitRepo.findVisitById(tx as unknown as PrismaClient, validatedId);

          if (!existing) {
            throw new NotFoundError('Visit', validatedId);
          }

          // 2. Validate status transition
          this.validateStatusTransition(existing.status ?? 'CANCELLED', validatedStatus ?? 'COMPLETED');

          // 3. Update status
          const now = new Date();
          // use a minimal, explicit shape matching the repo's partial update
          // payload instead of the full Prisma input type (which includes
          // string|Date unions on some fields).
          const updateData: {
            status: AppointmentStatus;
            updatedAt: Date;
            note?: string | null;
          } = {
            status: validatedStatus,
            updatedAt: now
          };

          // If cancelling, add reason to notes
          if (validatedStatus === 'CANCELLED' && reason) {
            updateData.note = existing.note ? `${existing.note}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
          }

          const visit = await visitRepo.updateVisit(tx as unknown as PrismaClient, validatedId, updateData);

          logger.info('Visit status updated', {
            visitId: validatedId,
            fromStatus: existing.status,
            toStatus: validatedStatus
          });

          return visit;
        } catch (error) {
          logger.error('Failed to update visit status', { error, id: validatedId, status: validatedStatus });
          throw error;
        }
      })
      .then(async visit => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          const existing = await visitRepo.findVisitById(this.db, validatedId);
          if (existing) {
            await this.invalidateVisitCaches(validatedId, {
              patientId: existing.patientId,
              doctorId: existing.doctorId,
              clinicId: existing.clinicId,
              date: existing.appointmentDate
            });

            // Special invalidation for completed visits
            if (validatedStatus === 'COMPLETED') {
              await cacheService.invalidatePatientCaches(existing.patientId, existing.clinicId);
            }
          }
        }

        return visit;
      });
  }

  /**
   * Cancel a visit
   */
  async cancelVisit(id: string, reason?: string) {
    return this.updateVisitStatus(id, 'CANCELLED', reason);
  }

  /**
   * Complete a visit
   */
  async completeVisit(id: string, userId: string) {
    return this.updateVisitStatus(id, 'COMPLETED', userId);
  }

  /**
   * Delete a visit (soft delete)
   */
  async deleteVisit(id: string, clinicId: string, permanent = false) {
    // Validate inputs
    const validatedId = z.uuid().parse(id);
    const validatedClinicId = z.uuid().parse(clinicId);
    // const validatedUserId = z.uuid().parse(userId);

    return this.db
      .$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          // 1. Verify visit exists
          const existing = await visitRepo.findVisitById(tx as unknown as PrismaClient, validatedId);

          if (!existing || existing.clinicId !== validatedClinicId) {
            throw new NotFoundError('Visit', validatedId);
          }

          let result;
          if (permanent) {
            // Check if visit can be permanently deleted (no dependencies)
            if (existing.medical) {
              throw new ValidationError('Cannot permanently delete visit with associated medical records');
            }
            result = (await visitRepo.hardDeleteVisit?.(tx as unknown as PrismaClient, validatedId)) || validatedId;
            logger.info('Visit permanently deleted', { visitId: validatedId });
          } else {
            const now = new Date();
            result = await visitRepo.softDeleteVisit(tx as unknown as PrismaClient, validatedId, {
              isDeleted: true,
              deletedAt: now,
              updatedAt: now
            });
            logger.info('Visit soft deleted', { visitId: validatedId });
          }

          return result;
        } catch (error) {
          logger.error('Failed to delete visit', { error, id: validatedId });
          throw error;
        }
      })
      .then(async result => {
        // AFTER transaction succeeds, invalidate caches
        if (this.CACHE_ENABLED) {
          const existing = await visitRepo.findVisitById(this.db, validatedId);
          if (existing) {
            await this.invalidateVisitCaches(validatedId, {
              patientId: existing.patientId,
              doctorId: existing.doctorId,
              clinicId: existing.clinicId,
              date: existing.appointmentDate
            });
          }
        }

        return result;
      });
  }

  // ==================== HELPER METHODS ====================

  /**
   * Verify patient exists and belongs to clinic
   */
  private async verifyPatientAccess(patientId: string, clinicId: string) {
    const patient = await patientRepo.getPatientById(this.db, patientId, clinicId);
    if (!patient) {
      throw new NotFoundError('Patient', patientId);
    }
    return patient;
  }

  /**
   * Validate doctor working hours
   */
  private async validateWorkingHours(
    doctor: { workingDays?: Pick<WorkingDays, 'day' | 'startTime' | 'endTime'>[] | undefined } | null | undefined,
    time: string,
    date: Date
  ) {
    // Parse time string (HH:MM)
    const [hours, minutes] = time.split(':').map(Number);
    const appointmentTime = (hours ?? 0) * 60 + (minutes ?? 0);

    // Get day of week for the appointment date
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Check if doctor has defined working hours for this day
    const workingDay = doctor?.workingDays?.find(wd => wd.day.toLowerCase() === dayOfWeek);

    if (!workingDay) {
      throw new ValidationError('Doctor is not available on this day');
    }

    const [startH, startM] = workingDay.startTime.split(':').map(Number);
    const [endH, endM] = workingDay.endTime.split(':').map(Number);
    const startTime = (startH ?? 0) * 60 + (startM ?? 0);
    const endTime = (endH ?? 0) * 60 + (endM ?? 0);

    if (appointmentTime < startTime || appointmentTime > endTime) {
      throw new ValidationError(`Appointment time must be between ${workingDay.startTime} and ${workingDay.endTime}`);
    }
  }

  /**
   * Validate status transition
   */
  /**
   * Validates if an appointment can move from one status to another.
   * Prevents logic errors like re-opening a completed or cancelled appointment.
   */
  private validateStatusTransition(currentStatus: AppointmentStatus, newStatus: AppointmentStatus) {
    const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      // Pending can be confirmed (Scheduled) or dropped
      PENDING: ['SCHEDULED', 'CANCELLED'],

      // Scheduled is the active state; can finish, be missed, or be canceled
      SCHEDULED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],

      // Terminal States: Once an appointment is done, cancelled, or missed,
      // it should generally stay in that state for medical audit integrity.
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: []
    };

    // 1. Check if the status exists in our map
    const transitions = allowedTransitions[currentStatus];

    // 2. If no transitions or transition not allowed, throw error
    if (!transitions?.includes(newStatus)) {
      throw new ValidationError(
        `Invalid status transition: Appointments in ${currentStatus} status cannot be changed to ${newStatus}.`
      );
    }
  }

  /**
   * Invalidate all visit-related caches
   */
  private async invalidateVisitCaches(
    visitId: string,
    context: {
      patientId: string;
      doctorId: string;
      clinicId: string;
      date: Date;
    }
  ): Promise<void> {
    if (!this.CACHE_ENABLED) return;

    const dateStr = context.date.toISOString().split('T')[0];

    const keys = [
      CACHE_KEYS.VISIT(visitId),
      CACHE_KEYS.PATIENT_VISITS(context.patientId),
      CACHE_KEYS.DOCTOR_VISITS(context.doctorId, context.clinicId),
      CACHE_KEYS.TODAY_VISITS(context.clinicId),
      CACHE_KEYS.TODAY_VISIT_COUNT(context.clinicId),
      CACHE_KEYS.MONTH_VISIT_COUNT(context.clinicId, context.date.getFullYear(), context.date.getMonth() + 1),
      CACHE_KEYS.UPCOMING_VISITS(context.clinicId),
      CACHE_KEYS.UPCOMING_VISITS(context.clinicId),
      CACHE_KEYS.DOCTOR_SCHEDULE(context.doctorId, dateStr ?? '')
    ];

    await cacheService.invalidate(...keys);
    await cacheService.invalidateClinicCaches(context.clinicId);
  }
}

// Export singleton instance
export const visitService = new VisitService();

// Export service class for testing
export default VisitService;
