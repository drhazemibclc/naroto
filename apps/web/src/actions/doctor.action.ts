// modules/doctor/doctor.actions.ts
'use server';

import { doctorService } from '@naroto/api/services/doctor.service';
import { getSession } from '@naroto/api/utils/index';
import { CreateDoctorSchema, DeleteDoctorSchema } from '@naroto/db/zodSchemas/doctor.schema';
import { revalidatePath } from 'next/cache';

/**
 * 🟠 ACTION LAYER
 * - Auth only
 * - Validation only
 * - NO business logic
 * - NO database calls
 * - Delegates to service
 */

export async function upsertDoctorAction(input: unknown) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user?.clinic?.id) {
    throw new Error('Unauthorized: No clinic access');
  }

  // 2. Validation
  const validated = CreateDoctorSchema.parse(input);

  // 3. Delegate to service
  const doctor = await doctorService.upsertDoctor(validated, session.user.clinic.id, session.user.id);

  // 4. UI revalidation (cache invalidation already handled in service)
  revalidatePath('/dashboard/doctors');
  if (validated.id) {
    revalidatePath(`/dashboard/doctors/${validated.id}`);
  }

  return { success: true, data: doctor };
}

export async function deleteDoctorAction(input: unknown) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user?.clinic?.id) {
    throw new Error('Unauthorized: No clinic access');
  }

  // 2. Validation
  const validated = DeleteDoctorSchema.parse(input);

  // 3. Delegate to service
  const result = await doctorService.deleteDoctor(validated.id, session.user.clinic.id, session.user.id);

  // 4. UI revalidation
  revalidatePath('/dashboard/doctors');
  revalidatePath('/dashboard/admin');

  return result;
}

export async function getDoctorByIdAction(id: string) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user?.clinic?.id) {
    throw new Error('Unauthorized: No clinic access');
  }

  // 2. Delegate to cached service
  const { getCachedDoctorById } = await import('@naroto/api/cache/doctor.cache');
  const doctor = await getCachedDoctorById(id, session.user.clinic.id);

  return { success: true, data: doctor };
}
