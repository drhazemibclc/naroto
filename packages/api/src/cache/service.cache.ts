/**
 * 🟢 SERVICE MODULE - CACHE LAYER
 *
 * RESPONSIBILITIES:
 * - ONLY 'use cache' directives
 * - NO Prisma/database imports
 * - NO business logic
 * - Calls SERVICE layer (NOT query layer directly)
 * - Proper cache tags and profiles
 */

'use cache';

import type { ServiceFilters } from '@naroto/db/zodSchemas/service.schema';
import { cacheLife, cacheTag } from 'next/cache';

import { serviceService } from '../services/service.service';
import { CACHE_PROFILES } from './utils/profiles';
import { CACHE_TAGS } from './utils/tags';

// ==================== GET BY ID ====================

export async function getCachedServiceById(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.service.byId(id));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return serviceService.getServiceById(id, clinicId);
}

// ==================== GET BY CLINIC ====================

export async function getCachedServicesByClinic(clinicId: string, _userId: string, filters?: Partial<ServiceFilters>) {
  'use cache';

  cacheTag(CACHE_TAGS.service.byClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalMedium);

  return serviceService.getServicesByClinic(clinicId, filters);
}

// ==================== GET BY CATEGORY ====================

export async function getCachedServicesByCategory(clinicId: string, category: string, _userId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.service.byCategory(clinicId, category));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return serviceService.getServicesByCategory(clinicId, category);
}

// ==================== GET WITH FILTERS ====================

export async function getCachedServicesWithFilters(filters: ServiceFilters, userId: string) {
  'use cache';

  // Generate a stable cache key from filters
  const _cacheKey = `services:${JSON.stringify(filters)}`;
  cacheTag(CACHE_TAGS.service.filtered(filters));

  if (filters.clinicId) {
    cacheTag(CACHE_TAGS.service.byClinic(filters.clinicId));
    cacheTag(CACHE_TAGS.clinic.dashboard(filters.clinicId));
  }

  cacheLife(CACHE_PROFILES.medicalShort);

  // Pass the userId to the service
  return serviceService.getServicesWithFilters(filters, userId);
}

// ==================== GET STATS ====================

export async function getCachedServiceStats(clinicId: string, userId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.service.stats(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalMedium);

  // Pass the userId to the service
  return serviceService.getServiceStats(clinicId, userId);
}
