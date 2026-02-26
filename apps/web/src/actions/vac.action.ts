/**
 * 🟠 VACCINATION MODULE - ACTION LAYER
 *
 * RESPONSIBILITIES:
 * - Server Actions for mutations
 * - Authentication only
 * - Zod validation only
 * - NO business logic
 * - NO database calls
 * - Delegates to service layer
 */

'use server';

import { vaccinationService } from '@naroto/api/services/vac.service';
import { getSession } from '@naroto/api/utils/index';
import type { ImmunizationStatus } from '@naroto/db';
import {
  type DeleteImmunizationInput,
  DeleteImmunizationSchema,
  type ImmunizationCreateInput,
  ImmunizationCreateSchema,
  type ImmunizationUpdateInput,
  ImmunizationUpdateSchema,
  type ScheduleVaccinationInput,
  ScheduleVaccinationSchema,
  VaccinationByIdSchema
} from '@naroto/db/zodSchemas/vac.schema';
import { revalidatePath, revalidateTag } from 'next/cache';

// ==================== CREATE ACTIONS ====================

export async function recordImmunizationAction(input: unknown) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = ImmunizationCreateSchema.parse(input);

  const result = await vaccinationService.recordImmunization(validated as ImmunizationCreateInput, session.user.id);

  revalidatePath(`/dashboard/patients/${validated.patientId}/immunizations`);
  revalidatePath('/dashboard/immunizations');
  revalidatePath('/dashboard');

  return {
    success: true,
    data: result
  };
}

export async function scheduleVaccinationAction(input: unknown) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = ScheduleVaccinationSchema.parse(input);

  const result = await vaccinationService.scheduleVaccination(validated as ScheduleVaccinationInput, session.user.id);

  revalidatePath(`/dashboard/patients/${validated.patientId}/immunizations`);
  revalidatePath('/dashboard/immunizations/upcoming');
  revalidatePath('/dashboard');

  return {
    success: true,
    data: result
  };
}

// ==================== UPDATE ACTIONS ====================

export async function updateImmunizationAction(input: ImmunizationUpdateInput) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = ImmunizationUpdateSchema.parse({ ...input });

  const result = await vaccinationService.updateImmunization(
    validated.id,
    validated as ImmunizationUpdateInput,
    session.user.id
  );

  revalidatePath(`/dashboard/patients/${result.patientId}/immunizations`);
  revalidatePath('/dashboard/immunizations');

  return {
    success: true,
    data: result
  };
}

export async function updateImmunizationStatusAction(id: string, status: ImmunizationStatus) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = VaccinationByIdSchema.parse({ id });

  const result = await vaccinationService.updateImmunizationStatus(validated.id, status, session.user.id);

  revalidatePath(`/dashboard/patients/${result.patientId}/immunizations`);
  revalidatePath('/dashboard/immunizations');

  return {
    success: true,
    data: result
  };
}

export async function completeImmunizationAction(id: string) {
  return updateImmunizationStatusAction(id, 'COMPLETED');
}

export async function delayImmunizationAction(id: string, notes?: string) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const result = await vaccinationService.updateImmunization(
    id,
    {
      status: 'DELAYED',
      notes,
      id: ''
    },
    session.user.id
  );

  revalidatePath(`/dashboard/patients/${result.patientId}/immunizations`);
  revalidatePath('/dashboard/immunizations/overdue');

  return {
    success: true,
    data: result
  };
}

// ==================== BULK ACTIONS ====================

export async function scheduleDueVaccinationsAction(patientId: string, clinicId: string) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const dueVaccinations = await vaccinationService.calculateDueVaccinations(patientId, clinicId);

  const results = await Promise.all(
    dueVaccinations.map(v =>
      vaccinationService
        .scheduleVaccination(
          {
            patientId: v.patientId,
            clinicId,
            vaccineName: v.vaccineName,
            dueDate: v.dueDate,
            doseNumber: v.doseNumber,
            notes: 'Auto-scheduled based on vaccine schedule'
          },
          session.user.id
        )
        .catch(e => ({ error: e.message, vaccine: v.vaccineName }))
    )
  );

  revalidatePath(`/dashboard/patients/${patientId}/immunizations`);
  revalidatePath('/dashboard/immunizations/upcoming');

  return {
    success: true,
    scheduled: results.filter(r => !('error' in r)).length,
    failed: results.filter(r => 'error' in r),
    total: dueVaccinations.length
  };
}

// ==================== DELETE ACTIONS ====================

export async function deleteImmunizationAction(input: DeleteImmunizationInput) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  const userId = session.user.id;

  // 1. Validate Input
  const { id, clinicId, patientId } = DeleteImmunizationSchema.parse(input);

  // 2. Delegate to Service
  const result = await vaccinationService.deleteImmunization(userId, id, clinicId);

  // 3. Revalidate
  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath(`/dashboard/clinics/${clinicId}/immunizations`);
  revalidateTag(`vaccination-patient-${patientId}`, 'max');

  return {
    success: true,
    data: result
  };
}

// ==================== UTILITY ACTIONS ====================

/**
 * Triggered when a nurse/doctor wants to manually refresh the
 * "Due Vaccines" calculation for a specific patient.
 */
export async function refreshPatientVaccineStatusAction(patientId: string, _clinicId: string) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // No mutation here, just breaking the cache
  revalidateTag(`vaccination-patient-${patientId}`, 'max');
  revalidatePath(`/dashboard/patients/${patientId}`);

  return { success: true };
}
