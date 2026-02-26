/**
 * 🟣 SERVICE MODULE - tRPC ROUTER
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
  ServiceCreateSchema,
  ServiceFilterSchema,
  serviceDeleteSchema,
  serviceIdSchema,
  updateServiceSchema
} from '@naroto/db/zodSchemas/service.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';
import {
  createServiceAction,
  deleteServiceAction,
  updateServiceAction
} from '../../../../apps/web/src/actions/admin.action';
import {
  bulkUpdateServiceStatusAction,
  permanentlyDeleteServiceAction,
  restoreServiceAction
} from '../../../../apps/web/src/actions/service.action';
import { getCachedServiceById } from '../cache/admin.cache';
import {
  getCachedServiceStats,
  getCachedServicesByCategory,
  getCachedServicesByClinic,
  getCachedServicesWithFilters
} from '../cache/service.cache';

export const serviceRouter: AnyRouter = createTRPCRouter({
  // ==================== GET PROCEDURES ====================

  getById: protectedProcedure.input(serviceIdSchema).query(async ({ ctx, input }) => {
    if (!ctx.clinicId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Clinic ID is required'
      });
    }
    return getCachedServiceById(input.id, ctx.clinicId);
  }),

  getByClinic: protectedProcedure
    .input(
      z.object({
        clinicId: z.string().optional(),
        filters: ServiceFilterSchema.partial().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const clinicId = input.clinicId || ctx.clinicId;
      if (!clinicId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Clinic ID is required'
        });
      }

      // Pass userId from context
      return getCachedServicesByClinic(clinicId, ctx.user.id, input.filters);
    }),

  getByCategory: protectedProcedure
    .input(
      z.object({
        clinicId: z.string().optional(),
        category: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      const clinicId = input.clinicId || ctx.clinicId;
      if (!clinicId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Clinic ID is required'
        });
      }

      // Pass userId from context
      return getCachedServicesByCategory(clinicId, input.category, ctx.user.id);
    }),

  getWithFilters: protectedProcedure.input(ServiceFilterSchema).query(async ({ ctx, input }) => {
    // Add clinicId from context if not provided
    const filters = {
      ...input,
      clinicId: input.clinicId ?? ''
    };

    if (!filters.clinicId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Clinic ID is required'
      });
    }

    // Pass userId from context
    return getCachedServicesWithFilters(filters, ctx.user.id);
  }),

  getStats: protectedProcedure
    .input(
      z.object({
        clinicId: z.string().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const clinicId = input.clinicId || ctx.clinicId;
      if (!clinicId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Clinic ID is required'
        });
      }

      // Pass userId from context
      return getCachedServiceStats(clinicId, ctx.user.id);
    }),

  // ==================== MUTATION PROCEDURES ====================

  create: protectedProcedure.input(ServiceCreateSchema).mutation(async ({ input }) => {
    return createServiceAction(input);
  }),

  update: protectedProcedure.input(updateServiceSchema).mutation(async ({ input }) => {
    return updateServiceAction(input);
  }),

  delete: protectedProcedure.input(serviceDeleteSchema).mutation(async ({ input }) => {
    return deleteServiceAction(input.id, input.reason);
  }),

  restore: protectedProcedure.input(serviceIdSchema).mutation(async ({ input }) => {
    return restoreServiceAction(input.id);
  }),

  permanentlyDelete: protectedProcedure.input(serviceIdSchema).mutation(async ({ input }) => {
    return permanentlyDeleteServiceAction(input.id);
  }),

  bulkUpdateStatus: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.uuid()),
        status: z.enum(['ACTIVE', 'INACTIVE'])
      })
    )
    .mutation(async ({ input }) => {
      return bulkUpdateServiceStatusAction(input.ids, input.status);
    })
});
