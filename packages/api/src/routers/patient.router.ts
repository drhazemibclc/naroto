// src/modules/patient/patient.router.ts

import {
  CreatePatientSchema,
  DeletePatientSchema,
  GetAllPatientsSchema,
  GetPatientByIdSchema,
  UpdatePatientSchema,
  UpsertPatientSchema
} from '@naroto/db/zodSchemas/patient.schema';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure, createTRPCRouter, protectedProcedure } from '..';
import { upsertPatientAction } from '../../../../apps/web/src/actions/patient.action';
import { getCachedPatientById } from '../cache/admin.cache';
import { getCachedAvailableDoctors } from '../cache/doctor.cache';
import {
  getCachedPatientCount,
  getCachedPatientDashboardStats,
  getCachedPatientsByClinic,
  getCachedRecentPatients
} from '../cache/patient.cache';
import { patientService } from '../services/patient.service';

export const patientRouter = createTRPCRouter({
  // ==================== QUERIES ====================

  getById: protectedProcedure.input(GetPatientByIdSchema.shape.id).query(async ({ ctx, input }) => {
    const clinicId = ctx.user?.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return getCachedPatientById(input, clinicId);
  }),

  getFullDataById: protectedProcedure.input(GetPatientByIdSchema.shape.id).query(async ({ input }) => {
    return patientService.getPatientFullDataById(input);
  }),

  getDashboardStats: protectedProcedure.input(GetPatientByIdSchema.shape.id).query(async ({ ctx, input }) => {
    const clinicId = ctx.user?.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return getCachedPatientDashboardStats(input, clinicId);
  }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.user?.clinic?.id;
    if (!clinicId) return { success: true, patients: [] };

    const patients = await getCachedPatientsByClinic(clinicId);
    return { success: true, patients };
  }),
  getRecentPatients: protectedProcedure
    .input(z.object({ clinicId: z.uuid() })) // 1. Add validation schema
    .query(async ({ ctx, input }) => {
      // 2. Destructure input here
      // 3. Security Check
      if (input.clinicId !== ctx.session?.user.clinic?.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      // 4. Call Cached Service
      return getCachedRecentPatients(input.clinicId);
    }),
  getAllPatients: protectedProcedure.input(GetAllPatientsSchema).query(async ({ ctx, input }) => {
    const clinicId = ctx.user?.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return patientService.getAllPatientsPaginated({
      ...input,
      clinicId
    });
  }),

  getCount: protectedProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.user?.clinic?.id;
    if (!clinicId) return 0;

    return getCachedPatientCount(clinicId);
  }),

  getAvailableDoctors: protectedProcedure.input(z.object({ day: z.date() })).query(async ({ ctx, input }) => {
    const clinicId = ctx.user?.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return getCachedAvailableDoctors(clinicId, input.day);
  }),

  // ==================== MUTATIONS ====================

  create: protectedProcedure.input(CreatePatientSchema).mutation(async ({ ctx, input }) => {
    const clinicId = ctx.user?.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return patientService.createPatient({ ...input, clinicId }, ctx.user.id);
  }),

  update: protectedProcedure
    .input(z.object({ id: z.uuid(), data: UpdatePatientSchema }))
    .mutation(async ({ ctx, input }) => {
      return patientService.updatePatient(input.id, input.data, ctx.user.id);
    }),

  delete: protectedProcedure.input(DeletePatientSchema.shape.id).mutation(async ({ ctx, input }) => {
    return patientService.deletePatient(input, ctx.user.id);
  }),

  upsert: protectedProcedure.input(UpsertPatientSchema).mutation(async ({ input }) => {
    return upsertPatientAction(input);
  }),

  // ==================== ADMIN PROCEDURES ====================

  list: adminProcedure
    .input(GetAllPatientsSchema.extend({ clinicId: z.uuid().optional() }))
    .query(async ({ input }) => {
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
    })
});
