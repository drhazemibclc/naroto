// src/modules/appointment/appointment.router.ts

import {
  AllAppointmentsInputSchema,
  AppointmentByIdSchema,
  AppointmentCreateSchema,
  AppointmentDeleteSchema,
  AppointmentStatsInputSchema,
  AppointmentUpdateSchema,
  AppointmentUpdateStatusSchema,
  AvailableTimesInputSchema,
  GetForMonthInputSchema
} from '@naroto/db/zodSchemas/appointment.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';
import {
  getCachedAppointmentById,
  getCachedAppointmentStats,
  getCachedAvailableTimes,
  getCachedDoctorAppointments,
  getCachedMonthAppointments,
  getCachedPatientAppointments,
  getCachedTodayAppointments
} from '../cache/appointment.cache';
import { appointmentService } from '../services/appointment.service';

export const appointmentRouter: AnyRouter = createTRPCRouter({
  // ==================== QUERIES (READ - CACHED) ====================

  /**
   * Get single appointment by ID
   * Cached: 5 minutes
   */
  getById: protectedProcedure.input(AppointmentByIdSchema).query(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Clinic ID not found'
      });
    }

    return getCachedAppointmentById(input.id, clinicId);
  }),

  /**
   * Get today's appointments for clinic
   * Cached: 10 seconds (realtime)
   */
  getToday: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Clinic ID not found'
      });
    }

    return getCachedTodayAppointments(clinicId);
  }),

  /**
   * Get month calendar appointments
   * Cached: 1 hour
   */
  getForMonth: protectedProcedure.input(GetForMonthInputSchema).query(async ({ input }) => {
    const date = new Date(input.startDate);
    return getCachedMonthAppointments(input.clinicId, date.getFullYear(), date.getMonth());
  }),

  /**
   * Get patient appointments
   * Cached: 5 minutes
   */
  getPatientAppointments: protectedProcedure
    .input(AllAppointmentsInputSchema)
    .query(async ({ input }: { input: z.infer<typeof AllAppointmentsInputSchema> }) => {
      if (!input.patientId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Patient ID is required'
        });
      }

      return getCachedPatientAppointments(input.patientId, input.clinicId, {
        limit: input.take,
        includePast: true
      });
    }),

  /**
   * Get doctor appointments for a specific date
   * Cached: 10 seconds (realtime)
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
      return getCachedDoctorAppointments(input.doctorId, input.clinicId, input.date);
    }),

  /**
   * Get appointment statistics
   * Cached: 5 minutes
   */
  getStats: protectedProcedure.input(AppointmentStatsInputSchema).query(async ({ input }) => {
    return getCachedAppointmentStats(input.clinicId, input.fromDate, input.toDate);
  }),

  /**
   * Get available time slots for a doctor
   * Cached: 10 seconds (realtime)
   */
  getAvailableTimes: protectedProcedure.input(AvailableTimesInputSchema).query(async ({ input }) => {
    return getCachedAvailableTimes(input.doctorId, input.clinicId, input.appointmentDate);
  }),

  // ==================== MUTATIONS (WRITE - NO CACHE) ====================

  /**
   * Create new appointment
   * Invalidates: patient, doctor, clinic appointment caches
   */
  create: protectedProcedure.input(AppointmentCreateSchema).mutation(async ({ ctx, input }) => {
    return appointmentService.createAppointment(input, ctx.user.id);
  }),

  /**
   * Update appointment
   * Invalidates: specific appointment and related caches
   */
  update: protectedProcedure.input(AppointmentUpdateSchema).mutation(async ({ ctx, input }) => {
    return appointmentService.updateAppointment(input, ctx.user.id);
  }),

  /**
   * Update appointment status
   * Invalidates: specific appointment and related caches
   */
  updateStatus: protectedProcedure.input(AppointmentUpdateStatusSchema).mutation(async ({ ctx, input }) => {
    return appointmentService.updateAppointmentStatus(input, ctx.user.id);
  }),

  /**
   * Delete appointment (soft delete)
   * Invalidates: specific appointment and related caches
   */
  delete: protectedProcedure.input(AppointmentDeleteSchema).mutation(async ({ ctx, input }) => {
    await appointmentService.deleteAppointment(input.id, input.clinicId, ctx.user.id);

    return { success: true, message: 'Appointment deleted successfully' };
  })
});
