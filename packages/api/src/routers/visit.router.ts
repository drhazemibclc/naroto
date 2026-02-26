/**
 * 🟣 VISIT MODULE - tRPC ROUTER
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
  VisitByIdSchema,
  VisitByPatientSchema,
  VisitCountMonthSchema,
  VisitCountTodaySchema,
  VisitCreateSchema,
  VisitRecentSchema,
  VisitTodaySchema,
  VisitUpdateSchema
} from '@naroto/db/zodSchemas/index';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  cancelVisitAction,
  completeVisitAction,
  createVisitAction,
  rescheduleVisitAction,
  updateVisitAction,
  updateVisitStatusAction
} from '../../../../apps/web/src/actions/visit.action';
import {
  getCachedDoctorSchedule,
  getCachedMonthVisitCount,
  getCachedRecentVisits,
  getCachedTodayVisitCount,
  getCachedTodayVisits,
  getCachedUpcomingVisits,
  getCachedVisitById,
  getCachedVisitCountByStatus,
  getCachedVisitsByPatient
} from '../cache/visit.cache';
import { createTRPCRouter, protectedProcedure } from '../index';

export const visitRouter = createTRPCRouter({
  // ==================== QUERY PROCEDURES ====================
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(50).optional(),
        page: z.number().optional(),
        orderBy: z.object({ visitDate: z.enum(['asc', 'desc']) }).optional()
      })
    )
    .query(async ({ input, ctx }) => {
      const { limit = 50, page = 1, orderBy } = input;

      const visits = await ctx.db.appointment.findMany({
        where: {
          clinicId: ctx.clinicId ?? ''
        },
        orderBy: orderBy ? { appointmentDate: orderBy.visitDate } : { appointmentDate: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        select: {
          appointmentDate: true,
          id: true,
          status: true,
          patient: true,
          doctor: true,
          service: true
        }
      });

      return visits;
    }),
  getVisitById: protectedProcedure.input(VisitByIdSchema).query(async ({ ctx, input }) => {
    return getCachedVisitById(input.id, ctx.clinicId ?? '');
  }),

  getVisitsByPatient: protectedProcedure.input(VisitByPatientSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedVisitsByPatient(input.patientId, input.clinicId, { limit: input.limit, offset: input.offset });
  }),

  getRecentVisits: protectedProcedure.input(VisitRecentSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedRecentVisits(input.clinicId, input.limit);
  }),

  getTodayVisits: protectedProcedure.input(VisitTodaySchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedTodayVisits(input.clinicId);
  }),

  getUpcomingVisits: protectedProcedure
    .input(
      z.object({
        clinicId: z.uuid(),
        limit: z.number().min(1).max(50).optional(),
        doctorId: z.uuid().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return getCachedUpcomingVisits(input.clinicId, {
        limit: input.limit,
        doctorId: input.doctorId
      });
    }),

  // ==================== COUNT PROCEDURES ====================

  getTodayVisitCount: protectedProcedure.input(VisitCountTodaySchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedTodayVisitCount(input.clinicId);
  }),

  getMonthVisitCount: protectedProcedure.input(VisitCountMonthSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedMonthVisitCount(input.clinicId);
  }),

  getVisitCountByStatus: protectedProcedure
    .input(
      z.object({
        clinicId: z.uuid(),
        status: z.enum(['PENDING', 'SCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'])
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return getCachedVisitCountByStatus(input.clinicId, input.status);
    }),

  // ==================== SCHEDULE PROCEDURES ====================

  getDoctorSchedule: protectedProcedure
    .input(
      z.object({
        doctorId: z.uuid(),
        clinicId: z.uuid(),
        date: z.date().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return getCachedDoctorSchedule(input.doctorId, input.clinicId, input.date);
    }),

  // ==================== MUTATION PROCEDURES ====================

  createVisit: protectedProcedure.input(VisitCreateSchema).mutation(async ({ ctx, input }) => {
    if (input.clinicId && input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return createVisitAction(input);
  }),

  updateVisit: protectedProcedure.input(VisitUpdateSchema).mutation(async ({ input }) => {
    return updateVisitAction(input.id, input);
  }),

  updateVisitStatus: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        status: z.enum(['PENDING', 'SCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'])
      })
    )
    .mutation(async ({ input }) => {
      return updateVisitStatusAction(input.id, input.status);
    }),

  cancelVisit: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
    return cancelVisitAction(input.id);
  }),

  completeVisit: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
    return completeVisitAction(input.id);
  }),

  rescheduleVisit: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        appointmentDate: z.date(),
        time: z
          .string()
          .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
          .optional()
      })
    )
    .mutation(async ({ input }) => {
      return rescheduleVisitAction(input.id, input.appointmentDate, input.time);
    })
});
