/**
 * 🟣 VACCINATION MODULE - tRPC ROUTER
 *
 * RESPONSIBILITIES:
 * - tRPC procedure definitions
 * - Permission checks
 * - Input validation via schema
 * - Delegates to cache layer
 * - NO business logic
 * - NO database calls
 */

import {
  calculateDueVaccinesSchema,
  ImmunizationCreateSchema,
  ImmunizationUpdateSchema,
  OverdueCountSchema,
  OverdueVaccinationsSchema,
  ScheduleVaccinationSchema,
  UpcomingCountSchema,
  UpcomingVaccinationsSchema,
  VaccinationByClinicSchema,
  VaccinationByIdSchema,
  VaccinationByPatientSchema,
  VaccineScheduleFilterSchema
} from '@naroto/db/zodSchemas/vac.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  completeImmunizationAction,
  delayImmunizationAction,
  deleteImmunizationAction,
  recordImmunizationAction,
  scheduleDueVaccinationsAction,
  scheduleVaccinationAction,
  updateImmunizationAction,
  updateImmunizationStatusAction
} from '../../../../apps/web/src/actions/vac.action';
import { getCachedVaccineSchedule } from '../../../../apps/web/src/lib/cache/system.cache';
import {
  getCachedCalculatedDueVaccines,
  getCachedDueVaccinations,
  getCachedImmunizationById,
  getCachedImmunizationsByClinic,
  getCachedImmunizationsByPatient,
  getCachedOverdueVaccinationCount,
  getCachedOverdueVaccinations,
  getCachedPatientImmunizationRecord,
  getCachedPatientVaccinationSummary,
  getCachedUpcomingVaccinationCount,
  getCachedUpcomingVaccinations,
  getCachedVaccinationCountByStatus,
  getCachedVaccineScheduleByAge
} from '../../../../apps/web/src/lib/cache/vac.cache';
import { createTRPCRouter, protectedProcedure } from '..';

export const vaccinationRouter: AnyRouter = createTRPCRouter({
  // ==================== QUERY PROCEDURES ====================

  getImmunizationById: protectedProcedure.input(VaccinationByIdSchema).query(async ({ ctx, input }) => {
    return getCachedImmunizationById(input.id, ctx.clinicId ?? '');
  }),

  getImmunizationsByPatient: protectedProcedure.input(VaccinationByPatientSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedImmunizationsByPatient(input.patientId, input.clinicId, {
      includeCompleted: input.includeCompleted,
      limit: input.limit,
      offset: input.offset
    });
  }),

  getImmunizationsByClinic: protectedProcedure.input(VaccinationByClinicSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedImmunizationsByClinic(input.clinicId, {
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      limit: input.limit,
      offset: input.offset
    });
  }),

  getUpcomingVaccinations: protectedProcedure.input(UpcomingVaccinationsSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedUpcomingVaccinations(input.clinicId, {
      daysAhead: input.daysAhead,
      limit: input.limit
    });
  }),

  getOverdueVaccinations: protectedProcedure.input(OverdueVaccinationsSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedOverdueVaccinations(input.clinicId, {
      daysOverdue: input.daysOverdue,
      limit: input.limit
    });
  }),

  // ==================== COUNT PROCEDURES ====================

  getUpcomingVaccinationCount: protectedProcedure.input(UpcomingCountSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedUpcomingVaccinationCount(input.clinicId, input.daysAhead);
  }),

  getOverdueVaccinationCount: protectedProcedure.input(OverdueCountSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedOverdueVaccinationCount(input.clinicId, input.daysOverdue);
  }),

  getVaccinationCountByStatus: protectedProcedure
    .input(
      z.object({
        clinicId: z.uuid(),
        status: z.enum(['COMPLETED', 'PENDING', 'DELAYED', 'EXEMPTED'])
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return getCachedVaccinationCountByStatus(input.clinicId, input.status);
    }),

  // ==================== VACCINE SCHEDULE PROCEDURES ====================

  getVaccineSchedule: protectedProcedure.input(VaccineScheduleFilterSchema.optional()).query(async () => {
    return getCachedVaccineSchedule();
  }),

  getVaccineScheduleByAge: protectedProcedure
    .input(z.object({ ageMonths: z.number().int().min(0).max(240) }))
    .query(async ({ input }) => {
      return getCachedVaccineScheduleByAge(input.ageMonths);
    }),

  // ==================== PATIENT SUMMARY PROCEDURES ====================

  getPatientVaccinationSummary: protectedProcedure
    .input(
      z.object({
        patientId: z.uuid(),
        clinicId: z.uuid()
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return getCachedPatientVaccinationSummary(input.patientId, input.clinicId);
    }),

  getDueVaccinations: protectedProcedure
    .input(
      z.object({
        patientId: z.uuid(),
        clinicId: z.uuid()
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return getCachedDueVaccinations(input.patientId, input.clinicId);
    }),

  // ==================== MUTATION PROCEDURES ====================

  recordImmunization: protectedProcedure.input(ImmunizationCreateSchema).mutation(async ({ ctx, input }) => {
    if (input.clinicId && input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return recordImmunizationAction(input);
  }),

  scheduleVaccination: protectedProcedure.input(ScheduleVaccinationSchema).mutation(async ({ ctx, input }) => {
    if (input.clinicId && input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return scheduleVaccinationAction(input);
  }),

  updateImmunization: protectedProcedure.input(ImmunizationUpdateSchema).mutation(async ({ input }) => {
    return updateImmunizationAction(input);
  }),

  updateImmunizationStatus: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        status: z.enum(['COMPLETED', 'PENDING', 'DELAYED', 'EXEMPTED'])
      })
    )
    .mutation(async ({ input }) => {
      return updateImmunizationStatusAction(input.id, input.status);
    }),

  completeImmunization: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
    return completeImmunizationAction(input.id);
  }),

  delayImmunization: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        notes: z.string().optional()
      })
    )
    .mutation(async ({ input }) => {
      return delayImmunizationAction(input.id, input.notes);
    }),

  scheduleDueVaccinations: protectedProcedure
    .input(
      z.object({
        patientId: z.uuid(),
        clinicId: z.uuid()
      })
    )
    .mutation(async ({ input }) => {
      return scheduleDueVaccinationsAction(input.patientId, input.clinicId);
    }),

  /**
   * POST: Calculate due vaccines for a patient
   */
  calculateDueVaccines: protectedProcedure.input(calculateDueVaccinesSchema).query(async ({ ctx, input }) => {
    // Security check
    if (input.clinicId && input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    // Logic is encapsulated in the Service/Query layer to keep router clean
    return getCachedCalculatedDueVaccines(input.patientId, {
      patientAgeDays: input.patientAgeDays,
      completedVaccines: input.completedVaccines
    });
  }),

  // ==================== RECORD PROCEDURES ====================

  /**
   * GET: Patient immunization record
   */
  getPatientImmunizations: protectedProcedure
    .input(
      z.object({
        patientId: z.uuid(),
        clinicId: z.uuid()
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      // Delegate to service layer for data fetching + inclusion of patient info
      return getCachedPatientImmunizationRecord(input.clinicId, input.patientId);
    }),

  // ==================== MUTATION PROCEDURES ====================

  /**
   * DELETE: Soft delete immunization record
   */
  deleteImmunization: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        clinicId: z.uuid(),
        patientId: z.uuid()
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Authorization
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      // 2. Delegate to Server Action for mutation and revalidation
      // This follows your pattern: recordImmunizationAction -> deleteImmunizationAction
      return deleteImmunizationAction({
        id: input.id,
        clinicId: input.clinicId,
        patientId: input.patientId
      });
    })
});
