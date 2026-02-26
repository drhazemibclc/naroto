/**
 * 🟣 DOCTOR MODULE - tRPC ROUTER
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
import { doctorService } from '@naroto/db/services/doctor.service';
// Import schemas from @naroto/db/zodSchemas
import {
  type CreateDoctorInput,
  CreateDoctorSchema,
  DoctorByIdSchema,
  DoctorListSchema,
  type UpdateDoctorInput,
  UpdateDoctorInputSchema
} from '@naroto/db/zodSchemas/doctor.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

export const doctorRouter: AnyRouter = createTRPCRouter({
  // ==================== QUERIES ====================

  /**
   * Get list of all doctors in clinic
   * Service handles caching internally
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No clinic ID found in session'
      });
    }

    try {
      return await doctorService.getDoctorsByClinic(clinicId);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch doctors'
      });
    }
  }),

  /**
   * Get doctor by ID
   * Service handles caching internally
   */
  getById: protectedProcedure.input(DoctorByIdSchema).query(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No clinic ID found in session'
      });
    }

    try {
      return await doctorService.getDoctorById(input.id, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch doctor'
      });
    }
  }),

  /**
   * Get doctor with appointments
   * Service handles caching internally
   */
  getWithAppointments: protectedProcedure.input(DoctorByIdSchema).query(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No clinic ID found in session'
      });
    }

    try {
      return await doctorService.getDoctorWithAppointments(input.id, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch doctor with appointments'
      });
    }
  }),

  /**
   * Get available doctors for today
   * Service handles caching internally (short TTL)
   */
  getAvailable: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No clinic ID found in session'
      });
    }

    try {
      return await doctorService.getAvailableDoctors(clinicId);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch available doctors'
      });
    }
  }),

  /**
   * Get today's schedule with appointments
   * Service handles caching internally (short TTL)
   */
  getTodaySchedule: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No clinic ID found in session'
      });
    }

    try {
      return await doctorService.getTodaySchedule(clinicId);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : "Failed to fetch today's schedule"
      });
    }
  }),

  /**
   * Get paginated list of doctors with search
   * Service handles caching internally
   */
  getPaginated: protectedProcedure.input(DoctorListSchema).query(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No clinic ID found in session'
      });
    }

    try {
      return await doctorService.getPaginatedDoctors({
        clinicId,
        search: input.search,
        page: input.page,
        limit: input.limit
      });
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch paginated doctors'
      });
    }
  }),

  /**
   * Get doctor dashboard statistics
   * Service handles caching internally
   */
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    const userId = ctx.user.id;

    if (!(clinicId && userId)) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated or clinic ID missing'
      });
    }

    try {
      // Get doctor ID from user ID
      const doctor = await doctorService.getDoctorById(userId, clinicId);
      if (!doctor || typeof doctor !== 'object' || !('id' in doctor)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Doctor not found for this user'
        });
      }

      return await doctorService.getDoctorDashboardStats(doctor.id as string, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch dashboard stats'
      });
    }
  }),

  /**
   * Get working days for a doctor
   */
  getWorkingDays: protectedProcedure.input(DoctorByIdSchema).query(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No clinic ID found in session'
      });
    }

    try {
      return await doctorService.getDoctorWorkingDays(input.id, clinicId);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch working days'
      });
    }
  }),

  // ==================== MUTATIONS ====================

  /**
   * Create or update a doctor
   * Service handles cache invalidation internally
   */
  upsert: protectedProcedure.input(CreateDoctorSchema).mutation(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    const userId = ctx.user.id;

    if (!(clinicId && userId)) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated or clinic ID missing'
      });
    }

    try {
      const result = await doctorService.upsertDoctor(input as CreateDoctorInput, clinicId, userId);

      return {
        success: true,
        message: input.id ? 'Doctor updated successfully' : 'Doctor created successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to upsert doctor'
      });
    }
  }),

  /**
   * Update doctor (partial update)
   * Service handles cache invalidation internally
   */
  update: protectedProcedure.input(UpdateDoctorInputSchema).mutation(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    const userId = ctx.user.id;

    if (!(clinicId && userId)) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated or clinic ID missing'
      });
    }

    try {
      const result = await doctorService.upsertDoctor(input as UpdateDoctorInput, clinicId, userId);

      return {
        success: true,
        message: 'Doctor updated successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update doctor'
      });
    }
  }),

  /**
   * Delete doctor (soft delete)
   * Service handles cache invalidation internally
   */
  delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    const userId = ctx.user.id;

    if (!(clinicId && userId)) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated or clinic ID missing'
      });
    }

    try {
      const result = await doctorService.deleteDoctor(input.id, clinicId, userId);

      return {
        success: true,
        message: result.action === 'archived' ? 'Doctor archived successfully' : 'Doctor deleted successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete doctor'
      });
    }
  }),

  /**
   * Update doctor working days
   */
  updateWorkingDays: protectedProcedure
    .input(
      z.object({
        doctorId: z.uuid(),
        workingDays: z.array(
          z.object({
            day: z.string(),
            startTime: z.string(),
            endTime: z.string()
          })
        )
      })
    )
    .mutation(async ({ ctx, input }) => {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No clinic ID found in session'
        });
      }

      try {
        const result = await doctorService.updateWorkingDays(input.doctorId, clinicId, input.workingDays);

        return {
          success: true,
          message: 'Working days updated successfully',
          data: result
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update working days'
        });
      }
    })
});
