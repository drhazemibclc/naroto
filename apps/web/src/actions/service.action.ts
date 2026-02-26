/**
 * 🟠 SERVICE MODULE - ACTION LAYER
 *
 * RESPONSIBILITIES:
 * - Server Actions for mutations
 * - Authentication only
 * - Zod validation only
 * - NO business logic
 * - Delegates to service layer
 */

'use server';

import { getSession } from '@naroto/api/utils/index';
import { serviceService } from '@naroto/db/services/service.services';
import {
  bulkUpdateStatusSchema,
  type CreateServiceInput,
  ServiceCreateSchema,
  serviceDeleteSchema,
  serviceIdSchema,
  updateServiceSchema
} from '@naroto/db/zodSchemas/service.schema';
import { revalidatePath, revalidateTag } from 'next/cache';

import { CACHE_TAGS } from '@/lib/cache/utils/tags';

/**
 * 🟠 ACTION LAYER
 * - ONLY auth and validation
 * - NO business logic
 * - NO database calls
 * - Delegates to service layer
 */

// ==================== CREATE ACTIONS ====================

export async function createServiceAction(input: unknown) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = ServiceCreateSchema.parse(input);

  // 3. Delegate to service (add clinicId from session if not provided)
  const result = await serviceService.create({
    ...validated,
    clinicId: validated.clinicId || session.user.clinic?.id
  } as CreateServiceInput);

  // 4. Revalidate UI paths
  revalidatePath('/dashboard/services');

  // some service return types don’t include `clinicId` in their definition,
  // so extract it with a cast/guard before using it.
  const clinicId = (result as { clinicId?: string | null }).clinicId;
  if (clinicId) {
    revalidatePath(`/dashboard/clinics/${clinicId}/services`);
    revalidateTag(CACHE_TAGS.service.byClinic(clinicId), 'max');
    revalidateTag(CACHE_TAGS.clinic.dashboard(clinicId), 'max');
  }

  return {
    success: true,
    data: result
  };
}

// ==================== UPDATE ACTIONS ====================

export async function updateServiceAction(id: string, input: unknown) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = updateServiceSchema.parse({ input, id });

  // 3. Delegate to service
  const result = await serviceService.update(id, validated);

  // 4. Revalidate UI paths
  revalidatePath('/dashboard/services');
  revalidatePath(`/dashboard/services/${id}`);
  revalidateTag(CACHE_TAGS.service.byId(id), 'max');

  if (result.clinicId) {
    revalidateTag(CACHE_TAGS.service.byClinic(result.clinicId), 'max');
    revalidateTag(CACHE_TAGS.clinic.dashboard(result.clinicId), 'max');
  }

  return {
    success: true,
    data: result
  };
}

// ==================== DELETE ACTIONS ====================

export async function deleteServiceAction(id: string, reason?: string) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = serviceDeleteSchema.parse({
    id,
    reason: reason || `Deleted by ${session.user.name || session.user.id}`
  });

  // 3. Delegate to service
  const result = await serviceService.delete(validated.id, session.user.id);

  // 4. Revalidate UI paths
  revalidatePath('/dashboard/services');
  revalidateTag(CACHE_TAGS.service.byId(id), 'max');

  if (result.clinicId) {
    revalidateTag(CACHE_TAGS.service.byClinic(result.clinicId), 'max');
    revalidateTag(CACHE_TAGS.clinic.dashboard(result.clinicId), 'max');
  }

  return {
    success: true,
    data: result
  };
}

export async function restoreServiceAction(id: string) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = serviceIdSchema.parse({ id });

  // 3. Delegate to service
  const result = await serviceService.restoreService(validated.id, session.user.id);

  // 4. Revalidate UI paths
  revalidatePath('/dashboard/services');
  revalidatePath('/dashboard/services/deleted');
  revalidateTag(CACHE_TAGS.service.byId(id), 'max');

  if (result.clinicId) {
    revalidateTag(CACHE_TAGS.service.byClinic(result.clinicId), 'max');
    revalidateTag(CACHE_TAGS.clinic.dashboard(result.clinicId), 'max');
  }

  return {
    success: true,
    data: result
  };
}

export async function permanentlyDeleteServiceAction(id: string) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = serviceIdSchema.parse({ id });

  // 3. Delegate to service
  const result = await serviceService.permanentlyDeleteService(validated.id, session.user.id);

  // 4. Revalidate UI paths
  revalidatePath('/dashboard/services/deleted');
  revalidateTag(CACHE_TAGS.service.byId(id), 'max');

  return {
    success: true,
    data: result
  };
}

// ==================== BULK ACTIONS ====================

export async function bulkUpdateServiceStatusAction(ids: string[], status: 'ACTIVE' | 'INACTIVE') {
  // 1. Auth
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = bulkUpdateStatusSchema.parse({ ids, status });

  // 3. Delegate to service
  const result = await serviceService.bulkUpdateServiceStatus(validated.ids, validated.status, session.user.id);

  // 4. Revalidate UI paths
  for (const id of ids) {
    revalidateTag(CACHE_TAGS.service.byId(id), 'max');
  }
  revalidatePath('/dashboard/services');

  return {
    success: true,
    data: result
  };
}
