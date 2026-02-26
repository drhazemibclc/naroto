import { clinicService } from '@naroto/db/services/clinic.service';
import { adminService, doctorService } from '@naroto/db/services/index';
import { DeleteInputSchema, StaffAuthSchema } from '@naroto/db/zodSchemas/admin.schema';
import { CreateNewDoctorInputSchema } from '@naroto/db/zodSchemas/doctor.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure, createTRPCRouter } from '..';
// ✅ Import the service directly, remove web cache imports

export const adminRouter: AnyRouter = createTRPCRouter({
  // ==================== QUERIES (READ) ====================

  getDashboardStats: adminProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Clinic ID not found' });

    try {
      // ✅ Call service directly. Redis caching should happen inside this method.
      return await adminService.getAdminDashboardStats(clinicId);
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch stats' });
    }
  }),

  getClinicCounts: adminProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return await clinicService.countUserClinics(clinicId);
  }),

  getServices: adminProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return await adminService.getServices(clinicId);
  }),

  getServiceById: adminProcedure.input(z.object({ id: z.string(), clinicId: z.string() })).query(async ({ input }) => {
    return await adminService.getServiceById(input.id, input.clinicId);
  }),

  getStaffList: adminProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return await adminService.getStaffList(clinicId);
  }),

  getDoctorList: adminProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return await adminService.getDoctorList(clinicId);
  }),

  getTodaySchedule: adminProcedure.query(async ({ ctx }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return await doctorService.getTodaySchedule(clinicId);
  }),

  getRecentActivity: adminProcedure
    .input(z.object({ clinicId: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      return await adminService.getRecentActivity(ctx.user.id, input.clinicId, input.limit);
    }),

  // ==================== MUTATIONS (WRITE) ====================
  // (Mutations remain largely the same as they already called adminService)

  createNewStaff: adminProcedure.input(StaffAuthSchema).mutation(async ({ ctx, input }) => {
    const clinicId = ctx.session?.user.clinic?.id;
    if (!clinicId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const result = await adminService.createStaff({ ...input, clinicId });
    return { success: true, staff: result };
  }),

  /**
   * 🟣 Create New Doctor
   */
  createNewDoctor: adminProcedure.input(CreateNewDoctorInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const userId = ctx.user.id;

      // ✅ Pass the raw input directly - the service handles the mapping and validation
      const doctor = await adminService.createDoctor(input, userId);

      return {
        success: true,
        message: 'Doctor added successfully',
        doctor
      };
    } catch (error) {
      console.error('Error in createNewDoctor:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create doctor'
      });
    }
  }),

  deleteService: adminProcedure.input(DeleteInputSchema).mutation(async ({ input }) => {
    await adminService.deleteService(input);
    return { success: true };
  })
});
