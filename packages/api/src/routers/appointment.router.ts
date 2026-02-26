/**
 * 🟣 APPOINTMENT MODULE - tRPC ROUTER
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
import { appointmentService } from '@naroto/db/services/appointment.service';
// Import schemas from @naroto/db/zodSchemas
import {
  AllAppointmentsInputSchema,
  AppointmentByIdSchema,
  AppointmentCreateSchema,
  AppointmentDeleteSchema,
  AppointmentStatsInputSchema,
  AppointmentUpdateSchema,
  AppointmentUpdateStatusSchema,
  AvailableTimesInputSchema,
  type CreateAppointmentInput,
  GetForMonthInputSchema,
  type UpdateAppointmentInput,
  type UpdateAppointmentStatusInput
} from '@naroto/db/zodSchemas/appointment.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

export const appointmentRouter: AnyRouter = createTRPCRouter({
  // ==================== QUERIES (READ) ====================

  /**
   * Get single appointment by ID
   * Service handles caching internally
   */
  getById: protectedProcedure.input(AppointmentByIdSchema).query(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Clinic ID not found'
      });
    }

    try {
      // Call service directly - caching is handled inside the service
      return await appointmentService.getAppointmentById(input.id, clinicId);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch appointment'
      });
    }
  }),

  /**
   * Get today's appointments for clinic
   * Service handles caching internally
   */
  getToday: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Clinic ID not found'
      });
    }

    try {
      return await appointmentService.getTodayAppointments(clinicId);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : "Failed to fetch today's appointments"
      });
    }
  }),

  /**
   * Get month calendar appointments
   * Service handles caching internally
   */
  getForMonth: protectedProcedure.input(GetForMonthInputSchema).query(async ({ input }) => {
    try {
      const date = new Date(input.startDate);
      return await appointmentService.getMonthAppointments(input.clinicId, date.getFullYear(), date.getMonth());
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch month appointments'
      });
    }
  }),

  /**
   * Get patient appointments
   * Service handles caching internally
   */
  getPatientAppointments: protectedProcedure.input(AllAppointmentsInputSchema).query(async ({ input }) => {
    try {
      if (!input.patientId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Patient ID is required'
        });
      }

      return await appointmentService.getPatientAppointments(input.patientId, input.clinicId, {
        limit: input.take,
        includePast: true
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch patient appointments'
      });
    }
  }),

  /**
   * Get doctor appointments for a specific date
   * Service handles caching internally
   */
  getDoctorAppointments: protectedProcedure
    .input(
      z.object({
        doctorId: z.uuid(),
        clinicId: z.uuid(),
        date: z.coerce.date().optional()
      })
    )
    .query(async ({ input }) => {
      try {
        const { doctorId, clinicId, date } = input;
        return await appointmentService.getDoctorAppointments(doctorId, date || new Date(), clinicId);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch doctor appointments'
        });
      }
    }),

  /**
   * Get appointment statistics
   * Service handles caching internally
   */
  getStats: protectedProcedure.input(AppointmentStatsInputSchema).query(async ({ input }) => {
    try {
      const { clinicId, fromDate, toDate } = input;
      return await appointmentService.getAppointmentStats(clinicId, fromDate, toDate);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch appointment stats'
      });
    }
  }),

  /**
   * Get available time slots for a doctor
   * Service handles caching internally (short TTL for realtime)
   */
  getAvailableTimes: protectedProcedure.input(AvailableTimesInputSchema).query(async ({ input }) => {
    try {
      const { doctorId, appointmentDate } = input;
      return await appointmentService.getAvailableTimes(doctorId, appointmentDate);
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch available times'
      });
    }
  }),

  // ==================== MUTATIONS (WRITE) ====================

  /**
   * Create new appointment
   * Service handles cache invalidation internally
   */
  create: protectedProcedure.input(AppointmentCreateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await appointmentService.createAppointment(input as CreateAppointmentInput, clinicId);

      return {
        success: true,
        message: 'Appointment created successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create appointment'
      });
    }
  }),

  /**
   * Update appointment
   * Service handles cache invalidation internally
   */
  update: protectedProcedure.input(AppointmentUpdateSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await appointmentService.updateAppointment(input as UpdateAppointmentInput, clinicId);

      return {
        success: true,
        message: 'Appointment updated successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update appointment'
      });
    }
  }),

  /**
   * Update appointment status
   * Service handles cache invalidation internally
   */
  updateStatus: protectedProcedure.input(AppointmentUpdateStatusSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      const result = await appointmentService.updateAppointmentStatus(input as UpdateAppointmentStatusInput, clinicId);

      return {
        success: true,
        message: 'Appointment status updated successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update appointment status'
      });
    }
  }),

  /**
   * Delete appointment (soft delete)
   * Service handles cache invalidation internally
   */
  delete: protectedProcedure.input(AppointmentDeleteSchema).mutation(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found'
        });
      }

      await appointmentService.deleteAppointment(input.id, clinicId);

      return {
        success: true,
        message: 'Appointment deleted successfully'
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete appointment'
      });
    }
  })
});
