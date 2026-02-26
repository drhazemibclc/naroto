// src/modules/appointment/appointment.actions.ts
'use server';

import { appointmentService } from '@naroto/api/services/appointment.service';
import { getSession } from '@naroto/api/utils/index';
import {
  AppointmentCreateSchema,
  AppointmentDeleteSchema,
  AppointmentUpdateStatusSchema
} from '@naroto/db/zodSchemas/appointment.schema';
import { revalidatePath } from 'next/cache';

export async function createAppointmentAction(input: unknown) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = AppointmentCreateSchema.parse(input);

  const appointment = await appointmentService.createAppointment(validated, session.user.id);

  revalidatePath('/dashboard/appointments');
  revalidatePath('/dashboard/calendar');

  return { success: true, data: appointment };
}

export async function updateAppointmentStatusAction(input: unknown) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = AppointmentUpdateStatusSchema.parse(input);

  const appointment = await appointmentService.updateAppointmentStatus(validated, session.user.id);

  revalidatePath('/dashboard/appointments');

  return { success: true, data: appointment };
}

export async function deleteAppointmentAction(input: unknown) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = AppointmentDeleteSchema.parse(input);

  await appointmentService.deleteAppointment(validated.id, validated.clinicId, session.user.id);

  revalidatePath('/dashboard/appointments');
  revalidatePath('/dashboard/calendar');

  return { success: true };
}
