// src/modules/patient/patient.actions.ts
'use server';

import { patientService } from '@naroto/api/services/patient.service';
import { getSession } from '@naroto/api/utils/index';
import {
  CreatePatientSchema,
  DeletePatientSchema,
  UpdatePatientSchema,
  UpsertPatientSchema
} from '@naroto/db/zodSchemas/patient.schema';
import { revalidatePath } from 'next/cache';

/**
 * 🟠 ACTION LAYER
 * - ONLY auth and validation
 * - NO business logic
 * - NO database calls
 * - Delegates to service layer
 */
export async function createPatientAction(input: unknown) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = CreatePatientSchema.parse(input);

  // 3. Delegate to service
  const patient = await patientService.createPatient(
    { ...validated, clinicId: session.user.clinic?.id ?? '' },
    session.user.id
  );

  // 4. Revalidate UI paths
  revalidatePath('/dashboard/patients');
  revalidatePath('/dashboard');

  return { success: true, data: patient };
}

export async function updatePatientAction(id: string, input: unknown) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = UpdatePatientSchema.parse(input);

  // 3. Delegate to service
  const patient = await patientService.updatePatient(id, validated, session.user.id);

  // 4. Revalidate UI paths
  revalidatePath(`/dashboard/patients/${id}`);
  revalidatePath('/dashboard/patients');

  return { success: true, data: patient };
}

export async function deletePatientAction(id: string) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  DeletePatientSchema.parse({ id });

  // 3. Delegate to service
  await patientService.deletePatient(id, session.user.id);

  // 4. Revalidate UI paths
  revalidatePath('/dashboard/patients');
  revalidatePath('/dashboard');

  return { success: true };
}

export async function upsertPatientAction(input: unknown) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = UpsertPatientSchema.parse(input);

  // 3. Delegate to service
  const patient = await patientService.createPatient(
    { ...validated, clinicId: session.user.clinic?.id ?? '' },
    session.user.id
  );

  // 4. Revalidate UI paths
  revalidatePath('/dashboard/patients');

  return { success: true, data: patient };
}
