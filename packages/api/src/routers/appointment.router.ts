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
  AppointmentDeleteSchema,
  AppointmentFilterSchema,
  AppointmentStatsInputSchema,
  AppointmentUpdateStatusSchema,
  AvailableTimesInputSchema,
  CreateAppointmentSchema,
  GetForMonthInputSchema,
  type UpdateAppointmentInput,
  UpdateAppointmentSchema,
  type UpdateAppointmentStatusInput
} from '@naroto/db/zodSchemas/appointment.schema';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

export const appointmentRouter = createTRPCRouter({
  // ==================== QUERIES (READ) ====================

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    return appointmentService.getAppointmentById(input.id, ctx.session.user.clinic?.id ?? '');
  }),

  list: protectedProcedure.input(AppointmentFilterSchema).query(async ({ input, ctx }) => {
    return appointmentService.getAppointments(ctx.session.user.clinic?.id ?? '', input);
  }),

  today: protectedProcedure.query(async ({ ctx }) => {
    return appointmentService.getTodayAppointments(ctx.session.user.clinic?.id ?? '');
  }),

  stats: protectedProcedure
    .input(z.object({ period: z.enum(['day', 'week', 'month']).optional() }))
    .query(async ({ ctx }) => {
      return appointmentService.getAppointmentStats(ctx.session.user.clinic?.id ?? '');
    }),

  availableSlots: protectedProcedure
    .input(
      z.object({
        doctorId: z.string(),
        date: z.date(),
        duration: z.number().default(30)
      })
    )
    .query(async ({ input, ctx }) => {
      return appointmentService.getAvailableTimes(ctx.session.user.clinic?.id ?? '', input.date);
    }),

  // ==================== MUTATIONS ====================

  create: protectedProcedure.input(CreateAppointmentSchema).mutation(async ({ input, ctx }) => {
    return appointmentService.createAppointment(input, ctx.session.user.id);
  }),

  update: protectedProcedure.input(UpdateAppointmentSchema).mutation(async ({ input, ctx }) => {
    return appointmentService.updateAppointment(input as UpdateAppointmentInput, ctx.session.user.clinic?.id ?? '');
  }),

  cancel: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().optional()
      })
    )
    .mutation(async ({ input, ctx }) => {
      return appointmentService.cancelAppointment(input.id, ctx.session.user.id, input.reason ?? '');
    }),

  checkIn: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    return appointmentService.checkInPatient(input.id, ctx.session.user.id, ctx.session.user.clinic?.id ?? '');
  }),

  complete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().optional()
      })
    )
    .mutation(async ({ input, ctx }) => {
      return appointmentService.completeAppointment(
        input.id,
        ctx.session.user.id,
        ctx.session.user.clinic?.id ?? '',
        input.notes
      );
    }),

  /**
   * Get single appointment by ID
   * Service handles caching internally
   */
  // getById: protectedProcedure.input(AppointmentByIdSchema).query(async ({ ctx, input }) => {
  //   const clinicId = ctx.session?.user.clinic?.id;
  //   if (!clinicId) {
  //     throw new TRPCError({
  //       code: 'UNAUTHORIZED',
  //       message: 'Clinic ID not found'
  //     });
  //   }

  //   try {
  //     // Call service directly - caching is handled inside the service
  //     return await appointmentService.getAppointmentById(input.id, clinicId);
  //   } catch (error) {
  //     throw new TRPCError({
  //       code: 'INTERNAL_SERVER_ERROR',
  //       message: error instanceof Error ? error.message : 'Failed to fetch appointment'
  //     });
  //   }
  // }),

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
  // create: protectedProcedure.input(AppointmentCreateSchema).mutation(async ({ ctx, input }) => {
  //   try {
  //     const clinicId = ctx.session?.user.clinic?.id;
  //     if (!clinicId) {
  //       throw new TRPCError({
  //         code: 'UNAUTHORIZED',
  //         message: 'Clinic ID not found'
  //       });
  //     }

  //     const result = await appointmentService.createAppointment(input as CreateAppointmentInput, clinicId);

  //     return {
  //       success: true,
  //       message: 'Appointment created successfully',
  //       data: result
  //     };
  //   } catch (error) {
  //     if (error instanceof TRPCError) throw error;
  //     throw new TRPCError({
  //       code: 'INTERNAL_SERVER_ERROR',
  //       message: error instanceof Error ? error.message : 'Failed to create appointment'
  //     });
  //   }
  // }),

  // /**
  //  * Update appointment
  //  * Service handles cache invalidation internally
  //  */
  // update: protectedProcedure.input(AppointmentUpdateSchema).mutation(async ({ ctx, input }) => {
  //   try {
  //     const clinicId = ctx.session?.user.clinic?.id;
  //     if (!clinicId) {
  //       throw new TRPCError({
  //         code: 'UNAUTHORIZED',
  //         message: 'Clinic ID not found'
  //       });
  //     }

  //     const result = await appointmentService.updateAppointment(input as UpdateAppointmentInput, clinicId);

  //     return {
  //       success: true,
  //       message: 'Appointment updated successfully',
  //       data: result
  //     };
  //   } catch (error) {
  //     if (error instanceof TRPCError) throw error;
  //     throw new TRPCError({
  //       code: 'INTERNAL_SERVER_ERROR',
  //       message: error instanceof Error ? error.message : 'Failed to update appointment'
  //     });
  //   }
  // }),

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

      await appointmentService.deleteAppointment(input.id, clinicId, ctx.session.user.id);

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
