import { adminService } from '@naroto/db/services/admin.service';
import { patientService } from '@naroto/db/services/patient.service';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

const getStatsSchema = z.object({
  clinicId: z.string()
});

const recentPatientsSchema = z.object({
  clinicId: z.string(),
  limit: z.number().min(1).max(50).default(5)
});

export const dashboardRouter = createTRPCRouter({
  /**
   * Get dashboard statistics
   */
  getStats: protectedProcedure.input(getStatsSchema).query(async ({ input }) => {
    try {
      // ✅ All complex trend logic and Prisma queries moved to Service
      return await adminService.getAdminDashboardStats(input.clinicId);
    } catch (error) {
      console.error('Error in getStats:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch dashboard statistics'
      });
    }
  }),
  /**
   * Get recent patients
   */
  recent: protectedProcedure.input(recentPatientsSchema).query(async ({ input }) => {
    try {
      // ✅ Clean, delegated call
      return await patientService.getRecentPatients(input.clinicId, input.limit);
    } catch (error) {
      console.error('Error in recent patients query:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch recent patients'
      });
    }
  })
});
