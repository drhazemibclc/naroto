import {
  clinicCreateSchema,
  clinicGetByIdSchema,
  clinicGetOneSchema,
  DashboardStatsInputSchema,
  MedicalRecordsSummaryInputSchema,
  reviewSchema
} from '@naroto/db/zodSchemas/clinic.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, protectedProcedure } from '..';
import { clinicService, dashboardService } from '../services/clinic.service';

export const clinicRouter: AnyRouter = createTRPCRouter({
  // ==================== QUERIES ====================

  getOne: protectedProcedure.input(clinicGetOneSchema).query(async ({ input, ctx }) => {
    return clinicService.getClinicWithUserAccess(input.id, ctx.user.id ?? '');
  }),

  getById: protectedProcedure.input(clinicGetByIdSchema).query(async ({ input }) => {
    return clinicService.getClinicById(input.id);
  }),

  // ==================== MUTATIONS ====================

  createClinic: protectedProcedure.input(clinicCreateSchema).mutation(async ({ input, ctx }) => {
    return clinicService.createClinic(input, ctx.user.id ?? '');
  }),

  createReview: protectedProcedure.input(reviewSchema).mutation(async ({ input }) => {
    if (!input.clinicId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Clinic ID is required'
      });
    }

    return clinicService.createReview({
      ...input,
      clinicId: input.clinicId
    });
  }),
  getDashboard: protectedProcedure.input(DashboardStatsInputSchema).query(async ({ input, ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User must be associated with a clinic.'
      });
    }

    return dashboardService.getDashboardStats(clinicId, input.from, input.to);
  }),

  getStats: protectedProcedure.query(async () => {
    return dashboardService.getGeneralStats();
  }),

  getMedicalRecordsSummary: protectedProcedure.input(MedicalRecordsSummaryInputSchema).query(async ({ input, ctx }) => {
    await clinicService.getClinicWithUserAccess(input.clinicId, ctx.user.id ?? '');

    return dashboardService.getMedicalRecordsSummary(input.clinicId);
  }),

  getRecentAppointments: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User must be associated with a clinic.'
      });
    }

    return dashboardService.getRecentAppointments(clinicId);
  }),

  getTodaySchedule: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User must be associated with a clinic.'
      });
    }

    return dashboardService.getTodaySchedule(clinicId);
  }),

  getUpcomingImmunizations: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User must be associated with a clinic.'
      });
    }

    return dashboardService.getUpcomingImmunizations(clinicId);
  }),

  getMonthlyPerformance: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User must be associated with a clinic.'
      });
    }

    return dashboardService.getMonthlyPerformance(clinicId);
  })
});
