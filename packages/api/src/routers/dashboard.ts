import {
  calculateAgeInMonths,
  calculateGrowthChecksPending,
  calculateImmunizationsCompleted,
  calculateImmunizationsDue,
  calculateMonthlyRevenue
} from '@naroto/db/utils/vaccine';
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
  getStats: protectedProcedure.input(getStatsSchema).query(async ({ ctx, input }) => {
    const { clinicId } = input;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    try {
      // Parallel queries with deduplication
      const [
        totalPatients,
        activePatients,
        newPatientsThisMonth,
        newPatientsLastMonth,
        todayAppointments,
        yesterdayAppointments,
        completedAppointments,
        immunizationsDue,
        lastMonthImmunizations,
        growthChecksPending,
        activeDoctors,
        monthlyRevenue,
        lastMonthRevenue
      ] = await Promise.all([
        // Patient counts
        ctx.db.patient.count({ where: { clinicId, isDeleted: false } }),
        ctx.db.patient.count({ where: { clinicId, isDeleted: false, status: 'ACTIVE' } }),
        ctx.db.patient.count({
          where: {
            clinicId,
            isDeleted: false,
            createdAt: { gte: startOfMonth }
          }
        }),
        ctx.db.patient.count({
          where: {
            clinicId,
            isDeleted: false,
            createdAt: { gte: startOfLastMonth, lt: startOfMonth }
          }
        }),

        // Appointment counts
        ctx.db.appointment.count({
          where: {
            clinicId,
            isDeleted: false,
            appointmentDate: { gte: today }
          }
        }),
        ctx.db.appointment.count({
          where: {
            clinicId,
            isDeleted: false,
            appointmentDate: {
              gte: new Date(today.getTime() - 24 * 60 * 60 * 1000),
              lt: today
            }
          }
        }),
        ctx.db.appointment.count({
          where: {
            clinicId,
            isDeleted: false,
            status: 'COMPLETED'
          }
        }),

        // Immunization stats
        await calculateImmunizationsDue(clinicId),
        await calculateImmunizationsCompleted(clinicId, startOfLastMonth, startOfMonth),
        await calculateGrowthChecksPending(clinicId),

        // Doctor stats
        ctx.db.doctor.count({
          where: {
            clinicId,
            isDeleted: false,
            isActive: true
          }
        }),

        // Revenue stats
        calculateMonthlyRevenue(clinicId, startOfMonth),
        calculateMonthlyRevenue(clinicId, startOfLastMonth, startOfMonth)
      ]);

      // Calculate trends
      const patientTrend =
        newPatientsLastMonth > 0
          ? (((newPatientsThisMonth - newPatientsLastMonth) / newPatientsLastMonth) * 100).toFixed(1)
          : '0';

      const appointmentTrend =
        yesterdayAppointments > 0
          ? (((todayAppointments - yesterdayAppointments) / yesterdayAppointments) * 100).toFixed(1)
          : '0';

      const immunizationTrend =
        lastMonthImmunizations > 0
          ? (((immunizationsDue - lastMonthImmunizations) / lastMonthImmunizations) * 100).toFixed(1)
          : '0';

      const revenueGrowth =
        lastMonthRevenue > 0 ? (((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1) : '0';

      return {
        totalPatients,
        activePatients,
        newPatientsThisMonth,
        patientTrend: Number(patientTrend),

        todayAppointments,
        completedAppointments,
        appointmentTrend: Number(appointmentTrend),

        immunizationsDue,
        immunizationTrend: Number(immunizationTrend),

        growthChecksPending,
        growthTrend: growthChecksPending.toString(),

        activeDoctors,

        monthlyRevenue,
        revenueGrowth: Number(revenueGrowth)
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch dashboard statistics'
      });
    }
  }),

  /**
   * Get recent patients
   */
  recent: protectedProcedure.input(recentPatientsSchema).query(async ({ ctx, input }) => {
    const { clinicId, limit } = input;

    const patients = await ctx.db.patient.findMany({
      where: { clinicId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        phone: true,
        email: true,
        image: true,
        status: true,
        createdAt: true,
        appointments: {
          take: 1,
          orderBy: { appointmentDate: 'desc' },
          select: { appointmentDate: true }
        }
      }
    });

    return patients.map((patient: { dateOfBirth: Date; appointments: { appointmentDate: Date }[] }) => ({
      ...patient,
      ageMonths: calculateAgeInMonths(patient.dateOfBirth),
      lastVisit: patient.appointments[0]?.appointmentDate || null
    }));
  })
});
