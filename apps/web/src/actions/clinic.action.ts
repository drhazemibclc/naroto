'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth/utils';

import { cacheHelpers } from '../../lib/cache/helpers';
import { clinicCreateSchema, reviewSchema } from './clinic.schema';
import { clinicService } from './clinic.service';

/**
 * 🟠 THIN ACTION LAYER
 * - Auth only
 * - Validation only
 * - Delegate to service
 * - NO business logic
 * - NO database calls
 */
export async function createClinicAction(input: unknown) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = clinicCreateSchema.parse(input);

  // 3. Delegate to service
  const result = await clinicService.createClinic(validated, session.user.id);

  return result;
}

export async function createReviewAction(input: unknown) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // 2. Validation
  const validated = reviewSchema.parse(input);

  if (!validated.clinicId) {
    throw new Error('Clinic ID is required');
  }

  // 3. Delegate to service
  const review = await clinicService.createReview({
    ...validated,
    clinicId: validated.clinicId
  });

  return { success: true, data: review };
}

export async function getPersonalizedGreetingAction() {
  // 1. Get cookies
  const cookieStore = await cookies();
  const userCookie = cookieStore.get('user_prefs');
  const userPrefs = userCookie ? JSON.parse(userCookie.value) : null;

  // 2. Delegate to service
  return clinicService.getPersonalizedGreeting(userPrefs);
}

export async function invalidateDashboardCacheAction(clinicId: string) {
  // 1. Auth
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // 2. Validate clinic access (delegate to service)
  // This would normally check if user has access to this clinic

  // 3. ✅ CORRECT: Type-safe cache invalidation with Next.js 16+ profile
  cacheHelpers.admin.invalidateDashboard(clinicId);

  // 4. Revalidate UI paths
  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/clinic/${clinicId}`);

  return { success: true };
}
