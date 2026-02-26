/**
 * 🟠 GROWTH MODULE - ACTION LAYER
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

import { growthService } from '@naroto/api/services/growth.service';
import { getSession } from '@naroto/api/utils/index';
import {
  type CreateGrowthRecordInput,
  DeleteGrowthRecordSchema,
  GrowthRecordCreateSchema,
  GrowthRecordUpdateSchema,
  type UpdateGrowthRecordInput
} from '@naroto/db/zodSchemas/growth.schema';
import { revalidatePath } from 'next/cache';

// ==================== CREATE ACTIONS ====================

export async function createGrowthRecordAction(input: unknown) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = GrowthRecordCreateSchema.parse(input);

  const result = await growthService.createGrowthRecord(validated as CreateGrowthRecordInput);

  // Revalidate UI paths
  revalidatePath(`/dashboard/patients/${validated.patientId}`);
  revalidatePath('/dashboard/growth');

  return {
    success: true,
    data: result
  };
}

// ==================== UPDATE ACTIONS ====================

export async function updateGrowthRecordAction(id: string, input: unknown) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = GrowthRecordUpdateSchema.parse(input);

  const result = await growthService.updateGrowthRecord(id, validated as UpdateGrowthRecordInput, session.user.id);

  revalidatePath(`/dashboard/patients/${result.patientId}`);
  revalidatePath('/dashboard/growth');

  return {
    success: true,
    data: result
  };
}

// ==================== DELETE ACTIONS ====================

export async function deleteGrowthRecordAction(input: unknown) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = DeleteGrowthRecordSchema.parse(input);

  await growthService.deleteGrowthRecord(validated.id, session.user.id);

  revalidatePath(`/dashboard/patients/${validated.patientId}`);
  revalidatePath('/dashboard/growth');

  return {
    success: true,
    message: 'Growth record deleted successfully'
  };
}

// ==================== INVALIDATION ACTIONS ====================

export async function invalidateGrowthCacheAction(params: { patientId: string; clinicId: string }) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  await growthService.invalidatePatientGrowthCache(params.patientId, params.clinicId);

  return { success: true };
}
