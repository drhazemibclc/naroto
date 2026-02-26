import { DeleteInputSchema, ServicesSchema, StaffAuthSchema, StatsInputSchema } from '@naroto/db/schemas/admin.schema';
import { CreateNewDoctorInputSchema } from '@naroto/db/zodSchemas/doctor.schema';
import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure, createTRPCRouter } from '..';
import {
  getCachedClinicCounts,
  getCachedDashboardStats,
  getCachedDoctorById,
  getCachedDoctorList,
  getCachedPatientById,
  getCachedRecentActivity,
  getCachedServiceById,
  getCachedServices,
  getCachedServicesWithUsage,
  getCachedStaffById,
  getCachedStaffList,
  getCachedTodaySchedule
} from '../cache/admin.cache';
import { adminService, type NewDoctorInput } from '../services/admin.service';

export const adminRouter: AnyRouter = createTRPCRouter({
  // ==================== QUERIES (READ) ====================

  /**
   * 🟣 Get Dashboard Stats - CACHED
   * Uses getCachedDashboardStats for optimal performance
   */
  getDashboardStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found in session'
        });
      }

      // ✅ Use cached version - no session passed, validation skipped in cache path
      return await getCachedDashboardStats(clinicId);
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch dashboard stats'
      });
    }
  }),

  /**
   * 🟣 Get Clinic Counts - CACHED
   */
  getClinicCounts: adminProcedure.query(async ({ ctx }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found in session'
        });
      }

      return await getCachedClinicCounts(clinicId);
    } catch (error) {
      console.error('Error in getClinicCounts:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch clinic counts'
      });
    }
  }),

  /**
   * 🟣 Get Services List - CACHED
   */
  getServices: adminProcedure.query(async ({ ctx }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found in session'
        });
      }

      return await getCachedServices(clinicId);
    } catch (error) {
      console.error('Error in getServices:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch services'
      });
    }
  }),

  /**
   * 🟣 Get Service By ID - CACHED
   */
  getServiceById: adminProcedure.input(z.object({ id: z.uuid(), clinicId: z.uuid() })).query(async ({ input }) => {
    try {
      const { id, clinicId } = input;
      return await getCachedServiceById(id, clinicId);
    } catch (error) {
      console.error('Error in getServiceById:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch service'
      });
    }
  }),

  /**
   * 🟣 Get Services With Usage - CACHED
   */
  getServicesWithUsage: adminProcedure.query(async ({ ctx }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found in session'
        });
      }

      return await getCachedServicesWithUsage(clinicId);
    } catch (error) {
      console.error('Error in getServicesWithUsage:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch services with usage'
      });
    }
  }),

  /**
   * 🟣 Get Staff List - CACHED
   */
  getStaffList: adminProcedure.query(async ({ ctx }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found in session'
        });
      }

      return await getCachedStaffList(clinicId);
    } catch (error) {
      console.error('Error in getStaffList:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch staff list'
      });
    }
  }),

  /**
   * 🟣 Get Staff By ID - CACHED
   */
  getStaffById: adminProcedure.input(z.object({ id: z.uuid(), clinicId: z.uuid() })).query(async ({ input }) => {
    try {
      const { id, clinicId } = input;
      return await getCachedStaffById(id, clinicId);
    } catch (error) {
      console.error('Error in getStaffById:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch staff member'
      });
    }
  }),

  /**
   * 🟣 Get Doctor List - CACHED
   */
  getDoctorList: adminProcedure.query(async ({ ctx }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found in session'
        });
      }

      return await getCachedDoctorList(clinicId);
    } catch (error) {
      console.error('Error in getDoctorList:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch doctor list'
      });
    }
  }),

  /**
   * 🟣 Get Doctor By ID - CACHED
   */
  getDoctorById: adminProcedure.input(z.object({ id: z.uuid(), clinicId: z.uuid() })).query(async ({ input }) => {
    try {
      const { id, clinicId } = input;
      return await getCachedDoctorById(id, clinicId);
    } catch (error) {
      console.error('Error in getDoctorById:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch doctor'
      });
    }
  }),

  /**
   * 🟣 Get Patient By ID - CACHED
   */
  getPatientById: adminProcedure.input(z.object({ id: z.uuid(), clinicId: z.uuid() })).query(async ({ input }) => {
    try {
      const { id, clinicId } = input;
      return await getCachedPatientById(id, clinicId);
    } catch (error) {
      console.error('Error in getPatientById:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch patient'
      });
    }
  }),

  /**
   * 🟣 Get Today's Schedule - CACHED (Realtime)
   */
  getTodaySchedule: adminProcedure.query(async ({ ctx }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found in session'
        });
      }

      return await getCachedTodaySchedule(clinicId);
    } catch (error) {
      console.error('Error in getTodaySchedule:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: "Failed to fetch today's schedule"
      });
    }
  }),

  /**
   * 🟣 Get Recent Activity - CACHED
   */
  getRecentActivity: adminProcedure
    .input(
      z.object({
        clinicId: z.uuid(),
        limit: z.number().min(1).max(100).default(20)
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.user.id;
        const { clinicId, limit } = input;

        return await getCachedRecentActivity(userId, clinicId, limit);
      } catch (error) {
        console.error('Error in getRecentActivity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recent activity'
        });
      }
    }),

  // ==================== MUTATIONS (WRITE) ====================

  /**
   * 🟣 Create New Staff
   * Delegates to action layer (or direct service with cache invalidation)
   */
  createNewStaff: adminProcedure.input(StaffAuthSchema).mutation(async ({ ctx, input }) => {
    try {
      const userId = ctx.user.id;

      // Delegate to service with userId
      const result = await adminService.createStaff(input, userId);

      return {
        success: true,
        message: 'Staff member added successfully',
        staff: result
      };
    } catch (error) {
      console.error('Error in createNewStaff:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create staff'
      });
    }
  }),

  /**
   * 🟣 Create New Doctor
   */
  createNewDoctor: adminProcedure.input(CreateNewDoctorInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const userId = ctx.user.id;

      const doctor = await adminService.createDoctor(
        {
          ...input,
          isActive: true,
          workingDays: input.workSchedule || []
        } as NewDoctorInput,
        userId
      );

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

  /**
   * 🟣 Add New Service
   */
  addNewService: adminProcedure.input(ServicesSchema).mutation(async ({ ctx, input }) => {
    try {
      const userId = ctx.user.id;

      const service = await adminService.createService(input, userId);

      return {
        success: true,
        message: 'Service added successfully',
        service
      };
    } catch (error) {
      console.error('Error in addNewService:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create service'
      });
    }
  }),

  /**
   * 🟣 Update Service
   */
  updateService: adminProcedure.input(ServicesSchema).mutation(async ({ ctx, input }) => {
    try {
      if (!input.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Service ID is required for update'
        });
      }

      const userId = ctx.user.id;

      const service = await adminService.updateService(input, userId);

      return {
        success: true,
        message: 'Service updated successfully',
        service
      };
    } catch (error) {
      console.error('Error in updateService:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update service'
      });
    }
  }),

  /**
   * 🟣 Delete Service
   */
  deleteService: adminProcedure.input(DeleteInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const userId = ctx.user.id;

      await adminService.deleteService(input.id, input.clinicId, userId);

      return {
        success: true,
        message: 'Service deleted successfully'
      };
    } catch (error) {
      console.error('Error in deleteService:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete service'
      });
    }
  }),

  /**
   * 🟣 Delete Data By ID (Generic)
   */
  deleteDataById: adminProcedure.input(DeleteInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const userId = ctx.user.id;

      await adminService.deleteData(input, userId);

      return {
        success: true,
        message: `${input.deleteType} deleted successfully`
      };
    } catch (error) {
      console.error('Error in deleteDataById:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete data'
      });
    }
  }),

  /**
   * 🟣 Get Dashboard Stats with Date Range
   * This is a separate endpoint for date-range analytics
   */
  getDashboardStatsByDateRange: adminProcedure.input(StatsInputSchema).query(async ({ ctx, input }) => {
    try {
      const clinicId = ctx.session?.user.clinic?.id;
      if (!clinicId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Clinic ID not found in session'
        });
      }

      // This is analytics data - not typically cached
      // Could implement a separate cache with longer TTL
      return await adminService.getDashboardStatsByDateRange(clinicId, input.from, input.to);
    } catch (error) {
      console.error('Error in getDashboardStatsByDateRange:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch dashboard stats by date range'
      });
    }
  })
});
