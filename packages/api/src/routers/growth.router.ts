/**
 * 🟣 GROWTH MODULE - tRPC ROUTER
 *
 * RESPONSIBILITIES:
 * - tRPC procedure definitions
 * - Permission checks
 * - Input validation via schema
 * - Delegates to service layer
 * - NO business logic
 * - NO database calls
 */

import {
  DeleteGrowthRecordSchema,
  GrowthComparisonSchema,
  GrowthPercentileSchema,
  GrowthProjectionSchema,
  GrowthRecordByIdSchema,
  GrowthRecordCreateSchema,
  GrowthRecordsByPatientSchema,
  GrowthRecordUpdateSchema,
  GrowthStandardsSchema,
  GrowthTrendsSchema,
  MultipleZScoreSchema,
  PatientZScoreChartSchema,
  VelocityCalculationSchema,
  ZScoreCalculationSchema,
  ZScoreChartSchema
} from '@naroto/db/zodSchemas/growth.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import type { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';
import { deleteGrowthRecordAction, updateGrowthRecordAction } from '../../../../apps/web/src/actions/growth.action';
import {
  getCachedClinicGrowthOverview,
  getCachedGrowthComparison,
  getCachedGrowthProjection,
  getCachedGrowthRecordById,
  getCachedGrowthRecordsByPatient,
  getCachedGrowthSummary,
  getCachedGrowthTrends,
  getCachedLatestGrowthRecord,
  getCachedMultipleZScores,
  getCachedPatientMeasurements,
  getCachedPatientZScoreChart,
  getCachedPercentile,
  getCachedRecentGrowthRecords,
  getCachedVelocity,
  getCachedWHOStandards,
  getCachedZScoreChartData,
  getCachedZScores
} from '../cache/growth.cache';
import { growthService } from '../services/growth.service';

export const growthRouter: AnyRouter = createTRPCRouter({
  // ==================== QUERY PROCEDURES ====================

  getGrowthRecordById: protectedProcedure.input(GrowthRecordByIdSchema).query(async ({ ctx, input }) => {
    // Verify clinic access
    const record = await getCachedGrowthRecordById(input.id);
    if (!record) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Growth record not found'
      });
    }

    if (record.patient.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return record;
  }),

  getGrowthRecordsByPatient: protectedProcedure.input(GrowthRecordsByPatientSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedGrowthRecordsByPatient(input.patientId, input.clinicId, {
      limit: 100,
      offset: 0
    });
  }),

  getLatestGrowthRecord: protectedProcedure
    .input(z.object({ patientId: z.uuid(), clinicId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return getCachedLatestGrowthRecord(input.patientId, input.clinicId);
    }),

  getPatientMeasurements: protectedProcedure
    .input(
      z.object({
        patientId: z.uuid(),
        clinicId: z.uuid(),
        limit: z.number().min(1).max(100).default(50)
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return getCachedPatientMeasurements(input.patientId, input.clinicId, input.limit);
    }),

  getGrowthSummary: protectedProcedure
    .input(z.object({ patientId: z.uuid(), clinicId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return getCachedGrowthSummary(input.patientId, input.clinicId);
    }),

  getClinicGrowthOverview: protectedProcedure.input(z.object({ clinicId: z.uuid() })).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedClinicGrowthOverview(input.clinicId);
  }),

  recent: protectedProcedure
    .input(z.object({ clinicId: z.uuid(), limit: z.number().min(1).max(20).default(5) }))
    .query(async ({ ctx, input }) => {
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return getCachedRecentGrowthRecords(input.clinicId, input.limit);
    }),

  // ==================== WHO STANDARDS PROCEDURES ====================

  getWHOStandards: protectedProcedure.input(GrowthStandardsSchema).query(async ({ input }) => {
    return getCachedWHOStandards(input);
  }),

  // ==================== CALCULATION PROCEDURES ====================

  calculatePercentile: protectedProcedure.input(GrowthPercentileSchema).query(async ({ input }) => {
    // Verify patient belongs to clinic
    // This is handled in the service layer
    return getCachedPercentile(input);
  }),

  getGrowthTrends: protectedProcedure.input(GrowthTrendsSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedGrowthTrends(input);
  }),

  calculateVelocity: protectedProcedure.input(VelocityCalculationSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedVelocity(input);
  }),

  compareGrowth: protectedProcedure.input(GrowthComparisonSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedGrowthComparison(input);
  }),

  calculateZScore: protectedProcedure.input(ZScoreCalculationSchema).query(async ({ input }) => {
    return getCachedZScores(input.ageDays, input.weight, input.gender);
  }),

  calculateMultipleZScores: protectedProcedure.input(MultipleZScoreSchema).query(async ({ input }) => {
    return getCachedMultipleZScores(input.measurements);
  }),

  getGrowthProjection: protectedProcedure.input(GrowthProjectionSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return getCachedGrowthProjection(input.patientId, input.clinicId, input.measurementType, input.projectionMonths);
  }),

  // ==================== CHART PROCEDURES ====================

  getZScoreChartData: protectedProcedure.input(ZScoreChartSchema).query(async ({ input }) => {
    return getCachedZScoreChartData(input.gender, input.measurementType);
  }),

  getPatientZScoreChart: protectedProcedure.input(PatientZScoreChartSchema).query(async ({ ctx, input }) => {
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }
    return getCachedPatientZScoreChart(input.patientId, input.clinicId, input.measurementType);
  }),

  getZScoreAreas: protectedProcedure.input(ZScoreChartSchema).query(async ({ input }) => {
    return growthService.getZScoreAreas(input.gender, input.measurementType);
  }),

  // ==================== MUTATION PROCEDURES ====================

  // Do this instead of calling createGrowthRecordAction
  createGrowthRecord: protectedProcedure.input(GrowthRecordCreateSchema).mutation(async ({ ctx, input }) => {
    // 1. Auth Check (Good)
    if (input.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    // 2. Call the SERVICE directly
    const result = await growthService.createGrowthRecord(input);

    // 3. Revalidate the Next.js Cache (since you're in Next.js 16)
    // Only import revalidateTag from 'next/cache' here
    revalidateTag(`growth-${input.patientId}`);
    revalidateTag(`clinic-${input.clinicId}`);

    return result;
  }),
  updateGrowthRecord: protectedProcedure.input(GrowthRecordUpdateSchema).mutation(async ({ ctx, input }) => {
    const record = await growthService.getGrowthRecordById(input.id ?? '');
    if (record.patient.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return updateGrowthRecordAction(input.id ?? '', input);
  }),

  deleteGrowthRecord: protectedProcedure.input(DeleteGrowthRecordSchema).mutation(async ({ ctx, input }) => {
    const record = await growthService.getGrowthRecordById(input.id);
    if (record.patient.clinicId !== ctx.session?.user.clinic?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied'
      });
    }

    return deleteGrowthRecordAction(input);
  })
});
