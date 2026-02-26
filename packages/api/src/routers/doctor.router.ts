// modules/doctor/doctor.router.ts

import { CreateDoctorSchema, DoctorByIdSchema, DoctorListSchema } from '@naroto/db/zodSchemas/doctor.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';
import { getCachedDoctorById, getCachedTodaySchedule } from '../cache/admin.cache';
import {
  getCachedAvailableDoctors,
  getCachedDoctorDashboardStats,
  getCachedDoctors,
  getCachedDoctorWithAppointments,
  getCachedPaginatedDoctors
} from '../cache/doctor.cache';
import { doctorService } from '../services/doctor.service';

export const doctorRouter: AnyRouter = createTRPCRouter({
  // ==================== QUERIES ====================

  list: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No clinic ID' });

    return getCachedDoctors(clinicId);
  }),

  getById: protectedProcedure.input(DoctorByIdSchema).query(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No clinic ID' });

    return getCachedDoctorById(input.id, clinicId);
  }),

  getWithAppointments: protectedProcedure.input(DoctorByIdSchema).query(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No clinic ID' });

    return getCachedDoctorWithAppointments(input.id, clinicId);
  }),

  getAvailable: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No clinic ID' });

    return getCachedAvailableDoctors(clinicId);
  }),

  getTodaySchedule: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No clinic ID' });

    return getCachedTodaySchedule(clinicId);
  }),

  getPaginated: protectedProcedure.input(DoctorListSchema).query(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No clinic ID' });

    return getCachedPaginatedDoctors({
      clinicId,
      search: input.search,
      page: input.page,
      limit: input.limit
    });
  }),

  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    const id = ctx.user.id;

    if (!(clinicId && id)) throw new TRPCError({ code: 'UNAUTHORIZED' });

    // Get doctor ID from user ID
    const doctor = await doctorService.getDoctorById(id, clinicId);
    if (!doctor) throw new TRPCError({ code: 'FORBIDDEN' });

    return getCachedDoctorDashboardStats(doctor.id, clinicId);
  }),

  // ==================== MUTATIONS ====================

  upsert: protectedProcedure.input(CreateDoctorSchema).mutation(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    const userId = ctx.user.id;

    if (!(clinicId && userId)) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return doctorService.upsertDoctor(input, clinicId, userId);
  }),

  delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    const userId = ctx.user.id;

    if (!(clinicId && userId)) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return doctorService.deleteDoctor(input.id, clinicId, userId);
  })
});
