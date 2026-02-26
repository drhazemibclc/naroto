import { appointmentService } from '@naroto/db/services/appointment.service';
import { patientService } from '@naroto/db/services/patient.service';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

const globalSearchSchema = z.object({
  query: z.string().min(2),
  limit: z.number().min(1).max(20).default(10)
});

export const searchRouter = createTRPCRouter({
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
    const patients = await patientService.searchPatients({
      query,
      clinicId,
      searchBy: 'name',
      limit
    });

    const appointmentsResult = await appointmentService.searchAppointment(query, clinicId, limit);

    return {
      patients: (Array.isArray(patients) ? patients : []).map((p: { firstName: string; lastName: string }) => ({
        ...p,
        fullName: `${p.firstName} ${p.lastName}`
      })),
      appointments: appointmentsResult.appointments.map(a => ({
        id: a.id,
        // the backend returns `date` & `patientName`, so rename them here
        appointmentDate: a.date,
        patient: a.patientName ?? 'Unknown'
      }))
    };
  })
});
