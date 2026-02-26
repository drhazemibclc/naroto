'use cache';

import { systemQueries } from '@naroto/db/queries/system.query';
import type { ChartType, Gender } from '@naroto/db/types';
import { cacheLife, cacheTag } from 'next/cache';

import { CACHE_PROFILES } from './utils/profiles';
import { CACHE_TAGS } from './utils/tags';

/**
 * 🟢 CACHE LAYER - WHO Growth Standards
 * These are reference data that rarely change
 */

export async function getCachedWHOGrowthStandards(gender: Gender, chartType: ChartType) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.whoByGender(gender));
  cacheTag(CACHE_TAGS.growth.whoByType(chartType));
  cacheLife(CACHE_PROFILES.max); // 30 days - reference data

  return systemQueries.getWHOGrowthStandards(gender, chartType);
}

export async function getCachedAllWHOGrowthStandards() {
  'use cache';

  cacheTag(CACHE_TAGS.growth.whoAll);
  cacheLife(CACHE_PROFILES.max); // 30 days

  return systemQueries.getAllWHOGrowthStandards();
}

export async function getCachedGrowthStandardByAge(gender: Gender, chartType: ChartType, ageDays: number) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.whoByGender(gender));
  cacheTag(CACHE_TAGS.growth.whoByType(chartType));
  cacheTag(CACHE_TAGS.growth.whoByAge(ageDays));
  cacheLife(CACHE_PROFILES.max);

  return systemQueries.getGrowthStandardByAge(gender, chartType, ageDays);
}

export async function getCachedClosestGrowthStandards(gender: Gender, chartType: ChartType, ageDays: number) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.whoByGender(gender));
  cacheTag(CACHE_TAGS.growth.whoByType(chartType));
  cacheTag(CACHE_TAGS.growth.whoInterpolation(ageDays));
  cacheLife(CACHE_PROFILES.max);

  return systemQueries.getClosestGrowthStandards(gender, chartType, ageDays);
}

/**
 * 🟢 CACHE LAYER - Drug Database
 */

export async function getCachedAllDrugs() {
  'use cache';

  cacheTag(CACHE_TAGS.drug.all);
  cacheLife(CACHE_PROFILES.medicalLong); // 7 days

  return systemQueries.getAllDrugs();
}

export async function getCachedDrugByName(name: string) {
  'use cache';

  cacheTag(CACHE_TAGS.drug.byName(name));
  cacheTag(CACHE_TAGS.drug.all);
  cacheLife(CACHE_PROFILES.medicalLong);

  return systemQueries.getDrugByName(name);
}

export async function getCachedDrugById(id: string) {
  'use cache';

  cacheTag(CACHE_TAGS.drug.byId(id));
  cacheTag(CACHE_TAGS.drug.all);
  cacheLife(CACHE_PROFILES.medicalLong);

  return systemQueries.getDrugById(id);
}

export async function getCachedDrugSearch(query: string, limit = 20) {
  'use cache: remote'; // CDN-cacheable

  cacheTag(CACHE_TAGS.drug.search(query));
  cacheLife(CACHE_PROFILES.medicalMedium); // 1 hour

  return systemQueries.searchDrugs(query, limit);
}

export async function getCachedDoseGuidelines(drugId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.drug.guidelines(drugId));
  cacheTag(CACHE_TAGS.drug.byId(drugId));
  cacheLife(CACHE_PROFILES.medicalLong);

  return systemQueries.getDoseGuidelines(drugId);
}

/**
 * 🟢 CACHE LAYER - Vaccine Schedule
 */

export async function getCachedVaccineSchedule() {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.schedule);
  cacheLife(CACHE_PROFILES.medicalLong); // 7 days

  return systemQueries.getVaccineSchedule();
}

export async function getCachedVaccineByName(name: string) {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.byName(name));
  cacheTag(CACHE_TAGS.vaccination.schedule);
  cacheLife(CACHE_PROFILES.medicalLong);

  return systemQueries.getVaccineByName(name);
}
