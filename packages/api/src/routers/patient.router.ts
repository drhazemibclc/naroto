/**
 * 🟣 PATIENT MODULE - tRPC ROUTER
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

// Import service from @naroto/db/services
import { patientService } from '@naroto/db/services/patient.service';
// Import schemas from @naroto/db/zodSchemas
import {
  type CreatePatientInput,
  CreatePatientSchema,
  DeletePatientSchema,
  GetAllPatientsSchema,
  GetPatientByIdSchema,
  type UpdatePatientInput,
  UpdatePatientSchema,
  type UpsertPatientInput,
  UpsertPatientSchema
} from '@naroto/db/zodSchemas/patient.schema';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure, createTRPCRouter, protectedProcedure } from '..';

export const patientRouter = createTRPCRouter({
  // ==================== QUERIES ====================

  /**
   * Get patient by ID
   * Service handles caching internally
   */
  getById: protectedProcedure.input(GetPatientByIdSchema.shape.id).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      return await patientService.getPatientById(input, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch patient'
      });
    }
  }),

  /**
   * Get patient full data by ID (with appointments, medical records, etc.)
   * Service handles caching internally
   */
  getFullDataById: protectedProcedure.input(GetPatientByIdSchema.shape.id).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      return await patientService.getPatientFullDataById(input, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch patient full data'
      });
    }
  }),

  /**
   * Get patient dashboard statistics
   * Service handles caching internally
   */
  getDashboardStats: protectedProcedure.input(GetPatientByIdSchema.shape.id).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      return await patientService.getPatientDashboardStats(input, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch patient dashboard stats'
      });
    }
  }),

  /**
   * Get all patients for clinic (basic list)
   * Service handles caching internally
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        return { success: true, patients: [] };
      }

      const patients = await patientService.getPatientsByClinic(clinicId);
      return { success: true, patients };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch patients'
      });
    }
  }),

  /**
   * Get recent patients
   * Service handles caching internally
   */
  getRecentPatients: protectedProcedure
    .input(z.object({ clinicId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        // Security check
        if (input.clinicId !== ctx.session?.user.clinic?.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        return await patientService.getRecentPatients(input.clinicId);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch recent patients'
        });
      }
    }),

  /**
   * Get paginated patients with filters
   * Service handles caching internally
   */
  getAllPatients: protectedProcedure.input(GetAllPatientsSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      return await patientService.getAllPatientsPaginated({
        ...input,
        clinicId
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch paginated patients'
      });
    }
  }),

  /**
   * Get patient count
   * Service handles caching internally
   */
  getCount: protectedProcedure.query(async ({ ctx }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        return 0;
      }

      return await patientService.getPatientCount(clinicId);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch patient count'
      });
    }
  }),

  /**
   * Get available doctors for a specific day
   * Service handles caching internally
   */
  getAvailableDoctors: protectedProcedure
    .input(
      z.object({
        clinicId: z.string().uuid(),
        day: z.date()
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Security check
        if (input.clinicId !== ctx.session?.user.clinic?.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied'
          });
        }

        // Get day name from date
        const dayName = input.day.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();

        return await patientService.getAvailableDoctorsByDay(dayName, input.clinicId);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch available doctors'
        });
      }
    }),

  // ==================== MUTATIONS ====================

  /**
   * Create new patient
   * Service handles cache invalidation internally
   */
  create: protectedProcedure.input(CreatePatientSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await patientService.createPatient(
        { ...input, clinicId } as CreatePatientInput & { clinicId: string },
        ctx.user.id
      );

      return {
        success: true,
        message: 'Patient created successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create patient'
      });
    }
  }),

  /**
   * Update patient
   * Service handles cache invalidation internally
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: UpdatePatientSchema
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

        const result = await patientService.updatePatient(input.id, clinicId, input.data as UpdatePatientInput);

        return {
          success: true,
          message: 'Patient updated successfully',
          data: result
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update patient'
        });
      }
    }),

  /**
   * Delete patient (soft delete)
   * Service handles cache invalidation internally
   */
  delete: protectedProcedure.input(DeletePatientSchema.shape.id).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await patientService.deletePatient(input, clinicId);

      return {
        success: true,
        message: 'Patient deleted successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete patient'
      });
    }
  }),

  /**
   * Upsert patient (create or update)
   * Service handles cache invalidation internally
   */
  upsert: protectedProcedure.input(UpsertPatientSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await patientService.upsertPatient(
        { ...input, clinicId } as UpsertPatientInput & { clinicId: string },
        ctx.user.id
      );

      return {
        success: true,
        message: result.id ? 'Patient updated successfully' : 'Patient created successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to upsert patient'
      });
    }
  }),

  // ==================== ADMIN PROCEDURES ====================

  /**
   * Admin: List patients with pagination (cursor-based)
   */
  list: adminProcedure
    .input(GetAllPatientsSchema.extend({ clinicId: z.string().uuid().optional() }))
    .query(async ({ input }) => {
      try {
        const clinicId = input.clinicId ?? '';
        const result = await patientService.getAllPatientsPaginated({
          ...input,
          clinicId
        });

        const totalPages = Math.ceil(result.totalRecords / result.limit);

        return {
          items: result.data,
          nextCursor: result.currentPage < totalPages ? result.currentPage + 1 : undefined,
          total: result.totalRecords
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to list patients'
        });
      }
    })
});
