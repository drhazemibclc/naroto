/**
 * 🟣 SERVICE MODULE - tRPC ROUTER
 *
 * RESPONSIBILITIES:
 * - tRPC procedure definitions
 * - Permission checks (via middleware)
 * - Input validation via schema
 * - Delegates to service layer
 * - NO business logic
 * - NO database calls
 * - NO Next.js cache imports
 */

import type { ServiceCategory, ServiceUpdateInput } from '@naroto/db';
import { serviceService } from '@naroto/db/services/service.services';
import { toNumber } from '@naroto/db/utils/decimal';
import {
  ServiceCreateSchema,
  ServiceFilterSchema,
  type ServiceFilters,
  serviceDeleteSchema,
  serviceIdSchema,
  updateServiceSchema
} from '@naroto/db/zodSchemas/service.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

export const serviceRouter: AnyRouter = createTRPCRouter({
  // ==================== GET PROCEDURES ====================

  /**
   * Get service by ID
   * Service handles caching internally
   */
  getById: protectedProcedure.input(serviceIdSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const service = await serviceService.getById(input.id, clinicId);

      if (!service) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service not found'
        });
      }

      return service;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch service'
      });
    }
  }),

  /**
   * Get services by clinic with filters
   * Service handles caching internally
   */
  getByClinic: protectedProcedure
    .input(
      z.object({
        clinicId: z.string().uuid().optional(),
        filters: ServiceFilterSchema.partial().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = input.clinicId || ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID is required'
          });
        }

        // Build filters with clinic ID
        const filters: ServiceFilters = {
          ...input.filters,
          clinicId,
          includeDeleted: input.filters?.includeDeleted ?? false,
          pagination: {
            limit: input.filters?.pagination?.limit || 20,
            offset: ((input.filters?.pagination?.offset || 1) - 1) * (input.filters?.pagination?.limit || 20)
          }
        };

        return await serviceService.getServices(filters);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch services'
        });
      }
    }),

  /**
   * Get services by category
   * Service handles caching internally
   */
  getByCategory: protectedProcedure
    .input(
      z.object({
        clinicId: z.string().uuid().optional(),
        category: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = input.clinicId || ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID is required'
          });
        }

        const filters: ServiceFilters = {
          clinicId,
          category: input.category as ServiceCategory,
          includeDeleted: false,
          pagination: {
            limit: 100,
            offset: 0
          }
        };

        const result = await serviceService.getServices(filters);
        return result.items;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch services by category'
        });
      }
    }),

  /**
   * Get services with advanced filters
   * Service handles caching internally
   */
  getWithFilters: protectedProcedure.input(ServiceFilterSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID is required'
        });
      }

      const filters: ServiceFilters = {
        ...input,
        clinicId,
        includeDeleted: input.includeDeleted ?? false,
        pagination: {
          limit: input.pagination?.limit || 20,
          offset: ((input.pagination?.offset || 1) - 1) * (input.pagination?.limit || 20)
        }
      };

      return await serviceService.getServices(filters);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch services with filters'
      });
    }
  }),

  /**
   * Get service statistics and analytics
   * Service handles caching internally
   */
  getStats: protectedProcedure
    .input(
      z.object({
        clinicId: z.string().uuid().optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = input.clinicId || ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID is required'
          });
        }

        return await serviceService.getAnalytics(clinicId, {
          from: input.fromDate,
          to: input.toDate
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch service statistics'
        });
      }
    }),

  /**
   * Check service availability
   * Service handles caching internally
   */
  checkAvailability: protectedProcedure
    .input(
      z.object({
        serviceId: z.string().uuid(),
        clinicId: z.string().uuid().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const clinicId = input.clinicId || ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID is required'
          });
        }

        return await serviceService.checkAvailability(input.serviceId, clinicId);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to check service availability'
        });
      }
    }),

  /**
   * Validate service data (client-side)
   * No caching needed for validation
   */
  validate: protectedProcedure
    .input(
      z.object({
        serviceName: z.string().optional(),
        price: z.number().optional(),
        duration: z.number().optional()
      })
    )
    .query(async ({ input }) => {
      try {
        return serviceService.validate(input);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to validate service data'
        });
      }
    }),

  // ==================== MUTATION PROCEDURES ====================

  /**
   * Create a new service
   * Service handles cache invalidation internally
   */
  create: protectedProcedure.input(ServiceCreateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      // const userId = ctx.user.id;

      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await serviceService.create({
        serviceName: input.serviceName,
        description: input.description,
        price: toNumber(input.price),
        category: input.category as ServiceCategory,
        duration: input.duration,
        clinicId,
        icon: input.icon,
        color: input.color
      });

      return {
        success: true,
        message: 'Service created successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create service'
      });
    }
  }),

  /**
   * Update an existing service
   * Service handles cache invalidation internally
   */
  update: protectedProcedure.input(updateServiceSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      // Ensure service belongs to clinic
      const existing = await serviceService.getById(input.id, clinicId);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service not found or does not belong to this clinic'
        });
      }

      const result = await serviceService.update(input.id, input as unknown as ServiceUpdateInput);

      return {
        success: true,
        message: 'Service updated successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update service'
      });
    }
  }),

  /**
   * Delete a service (soft delete by default)
   * Service handles cache invalidation internally
   */
  delete: protectedProcedure.input(serviceDeleteSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      // Verify service belongs to clinic
      const existing = await serviceService.getById(input.id, clinicId);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service not found or does not belong to this clinic'
        });
      }

      const result = await serviceService.delete(input.id, false);

      return {
        success: true,
        message: 'Service deleted successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete service'
      });
    }
  }),

  /**
   * Restore a soft-deleted service
   * Service handles cache invalidation internally
   */
  restore: protectedProcedure.input(serviceIdSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      // Verify service belongs to clinic (will throw if not)
      await serviceService.getById(input.id, clinicId);

      const result = await serviceService.restore(input.id);

      return {
        success: true,
        message: 'Service restored successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to restore service'
      });
    }
  }),

  /**
   * Permanently delete a service (admin only)
   * Service handles cache invalidation internally
   */
  permanentlyDelete: protectedProcedure.input(serviceIdSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      // Verify service belongs to clinic
      const existing = await serviceService.getById(input.id, clinicId);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service not found or does not belong to this clinic'
        });
      }

      const result = await serviceService.delete(input.id, true);

      return {
        success: true,
        message: 'Service permanently deleted',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to permanently delete service'
      });
    }
  }),

  /**
   * Bulk update service status
   * Service handles cache invalidation internally for each service
   */
  bulkUpdateStatus: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()),
        status: z.enum(['ACTIVE', 'INACTIVE'])
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const clinicId = ctx.session?.user.clinic?.id;
        if (!clinicId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clinic ID not found'
          });
        }

        const results = [];
        const errors = [];

        for (const id of input.ids) {
          try {
            // Verify each service belongs to clinic
            const existing = await serviceService.getById(id, clinicId);
            if (!existing) {
              errors.push({ id, error: 'Service not found' });
              continue;
            }

            const result = await serviceService.update(id, { status: input.status });
            results.push(result);
          } catch (error) {
            errors.push({
              id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        return {
          success: results.length > 0,
          message: `Updated ${results.length} services, ${errors.length} failed`,
          data: { results, errors }
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to bulk update services'
        });
      }
    })
});
