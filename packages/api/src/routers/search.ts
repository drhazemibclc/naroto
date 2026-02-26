import type { AnyRouter } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

const globalSearchSchema = z.object({
  query: z.string().min(2),
  limit: z.number().min(1).max(20).default(10)
});

export const searchRouter: AnyRouter = createTRPCRouter({
  /**
   * Global search across patients, appointments, etc.
   */
  global: protectedProcedure.input(globalSearchSchema).query(async ({ ctx, input }) => {
    const { query, limit } = input;
    const clinicId = ctx.headers?.get('x-clinic-id');

    if (!clinicId) {
      return { patients: [], appointments: [] };
    }

    // Search patients
    const patients = await ctx.db.patient.findMany({
      where: {
        clinicId,
        isDeleted: false,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } }
        ]
      },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phone: true,
        email: true
      }
    });

    // Search appointments
    const appointments = await ctx.db.appointment.findMany({
      where: {
        clinicId,
        isDeleted: false,
        patient: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } }
          ]
        }
      },
      take: limit,
      select: {
        id: true,
        appointmentDate: true,
        patient: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return {
      patients: patients.map((p: { firstName: string; lastName: string }) => ({
        ...p,
        fullName: `${p.firstName} ${p.lastName}`
      })),
      appointments: appointments.map(
        (a: { id: string; appointmentDate: Date; patient: { firstName: string; lastName: string } }) => ({
          id: a.id,
          date: a.appointmentDate,
          patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Unknown'
        })
      )
    };
  })
});
