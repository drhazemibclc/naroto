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
 * - NO Next.js cache imports
 */

// Import service from @naroto/db/services
import { growthService } from '@naroto/db/services/growth.service';
// Import schemas from @naroto/db/zodSchemas
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
  type UpdateGrowthRecordInput,
  VelocityCalculationSchema,
  ZScoreCalculationSchema,
  ZScoreChartSchema
} from '@naroto/db/zodSchemas/growth.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

export const growthRouter: AnyRouter = createTRPCRouter({
  // ==================== QUERY PROCEDURES ====================

  /**
   * Get growth record by ID
   * Service handles caching internally
   */
  getGrowthRecordById: protectedProcedure.input(GrowthRecordByIdSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const record = await growthService.getGrowthRecordById(input.id);

      if (!record) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Growth record not found'
        });
      }

      // Verify clinic access
      if (record.patient?.clinicId !== clinicId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return record;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch growth record'
      });
    }
  }),

  /**
   * Get growth records by patient
   * Service handles caching internally
   */
  getGrowthRecordsByPatient: protectedProcedure.input(GrowthRecordsByPatientSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      if (input.clinicId !== clinicId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return await growthService.getGrowthRecordsByPatient(input.patientId, {
        limit: input.limit || 100,
        offset: input.offset || 0
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch growth records'
      });
    }
  }),

  /**
   * Get latest growth record for patient
   */
  getLatestGrowthRecord: protectedProcedure
    .input(z.object({ patientId: z.string().uuid(), clinicId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        if (input.clinicId !== clinicId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        return await growthService.getLatestGrowthRecord(input.patientId, clinicId);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch latest growth record'
        });
      }
    }),

  /**
   * Get patient measurements
   */
  getPatientMeasurements: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        clinicId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50)
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        if (input.clinicId !== clinicId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        return await growthService.getPatientMeasurements(input.patientId, clinicId, input.limit);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch patient measurements'
        });
      }
    }),

  /**
   * Get growth summary for patient
   */
  getGrowthSummary: protectedProcedure
    .input(z.object({ patientId: z.string().uuid(), clinicId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        if (input.clinicId !== clinicId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        return await growthService.getGrowthSummary(input.patientId, clinicId);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch growth summary'
        });
      }
    }),

  /**
   * Get clinic growth overview
   */
  getClinicGrowthOverview: protectedProcedure
    .input(z.object({ clinicId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        if (input.clinicId !== clinicId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        return await growthService.getClinicGrowthOverview(clinicId);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch clinic growth overview'
        });
      }
    }),

  /**
   * Get recent growth records
   */
  recent: protectedProcedure
    .input(z.object({ clinicId: z.string().uuid(), limit: z.number().min(1).max(20).default(5) }))
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        if (input.clinicId !== clinicId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        return await growthService.getRecentGrowthRecords(clinicId, input.limit);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch recent growth records'
        });
      }
    }),

  // ==================== WHO STANDARDS PROCEDURES ====================

  /**
   * Get WHO growth standards
   */
  getWHOStandards: protectedProcedure.input(GrowthStandardsSchema).query(async ({ input }) => {
    try {
      return await growthService.getWHOStandards(input);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch WHO standards'
      });
    }
  }),

  // ==================== CALCULATION PROCEDURES ====================

  /**
   * Calculate growth percentile
   */
  calculatePercentile: protectedProcedure.input(GrowthPercentileSchema).query(async ({ input }) => {
    try {
      return await growthService.calculatePercentile(input);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to calculate percentile'
      });
    }
  }),

  /**
   * Get growth trends
   */
  getGrowthTrends: protectedProcedure.input(GrowthTrendsSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      if (input.clinicId !== clinicId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return await growthService.getGrowthTrends(input);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch growth trends'
      });
    }
  }),

  /**
   * Calculate growth velocity
   */
  calculateVelocity: protectedProcedure.input(VelocityCalculationSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      if (input.clinicId !== clinicId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return await growthService.calculateVelocity(input);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to calculate velocity'
      });
    }
  }),

  /**
   * Compare growth measurements
   */
  compareGrowth: protectedProcedure.input(GrowthComparisonSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      if (input.clinicId !== clinicId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return await growthService.compareGrowth(input);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to compare growth'
      });
    }
  }),

  /**
   * Calculate Z-score
   */
  calculateZScore: protectedProcedure.input(ZScoreCalculationSchema).query(async ({ input }) => {
    try {
      return await growthService.calculateZScores(input.ageDays, input.weight, input.gender);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to calculate Z-score'
      });
    }
  }),

  /**
   * Calculate multiple Z-scores
   */
  calculateMultipleZScores: protectedProcedure.input(MultipleZScoreSchema).query(async ({ input }) => {
    try {
      return await growthService.calculateMultipleZScores(input.measurements);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to calculate multiple Z-scores'
      });
    }
  }),

  /**
   * Get growth projection
   */
  getGrowthProjection: protectedProcedure.input(GrowthProjectionSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      if (input.clinicId !== clinicId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return await growthService.getGrowthProjection(
        input.patientId,
        clinicId,
        input.measurementType,
        input.projectionMonths
      );
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get growth projection'
      });
    }
  }),

  // ==================== CHART PROCEDURES ====================

  /**
   * Get Z-score chart data
   */
  getZScoreChartData: protectedProcedure.input(ZScoreChartSchema).query(async ({ input }) => {
    try {
      return await growthService.getZScoreChartData(input.gender, input.measurementType);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch Z-score chart data'
      });
    }
  }),

  /**
   * Get patient Z-score chart
   */
  getPatientZScoreChart: protectedProcedure.input(PatientZScoreChartSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      if (input.clinicId !== clinicId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      return await growthService.getPatientZScoreChart(input.patientId, clinicId, input.measurementType);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch patient Z-score chart'
      });
    }
  }),

  /**
   * Get Z-score areas
   */
  getZScoreAreas: protectedProcedure.input(ZScoreChartSchema).query(async ({ input }) => {
    try {
      return await growthService.getZScoreAreas(input.gender, input.measurementType);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch Z-score areas'
      });
    }
  }),

  // ==================== MUTATION PROCEDURES ====================

  /**
   * Create growth record
   * Service handles cache invalidation internally
   */
  createGrowthRecord: protectedProcedure.input(GrowthRecordCreateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      const _userId = ctx.user.id;

      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      if (input.clinicId !== clinicId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      const result = await growthService.createGrowthRecord(input);

      return {
        success: true,
        message: 'Growth record created successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create growth record'
      });
    }
  }),

  /**
   * Update growth record
   * Service handles cache invalidation internally
   */
  updateGrowthRecord: protectedProcedure.input(GrowthRecordUpdateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      const userId = ctx.user.id;

      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      // Verify access
      const record = await growthService.getGrowthRecordById(input.id ?? '');
      if (record.patient?.clinicId !== clinicId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      const result = await growthService.updateGrowthRecord(input.id ?? '', input as UpdateGrowthRecordInput, userId);

      return {
        success: true,
        message: 'Growth record updated successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update growth record'
      });
    }
  }),

  /**
   * Delete growth record
   * Service handles cache invalidation internally
   */
  deleteGrowthRecord: protectedProcedure.input(DeleteGrowthRecordSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      const userId = ctx.user.id;

      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      // Verify access
      const record = await growthService.getGrowthRecordById(input.id);
      if (record.patient?.clinicId !== clinicId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      const result = await growthService.deleteGrowthRecord(input.id, userId);

      return {
        success: true,
        message: 'Growth record deleted successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete growth record'
      });
    }
  })
});
