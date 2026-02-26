/**
 * 🟢 GROWTH MODULE - CACHE LAYER
 *
 * RESPONSIBILITIES:
 * - ONLY 'use cache' directives
 * - NO Prisma/database imports
 * - NO business logic
 * - Calls SERVICE layer (NOT query layer directly)
 * - Proper cache tags and profiles
 *
 * PATTERN: Cache-First with Hierarchical Tags
 */

'use cache';

import { growthService } from '@naroto/db/services/growth.service';
import type {
  GrowthComparisonInput,
  GrowthPercentileInput,
  GrowthStandardsInput,
  GrowthTrendsInput,
  VelocityCalculationInput
} from '@naroto/db/zodSchemas/growth.schema';
import { cacheLife, cacheTag } from 'next/cache';

import { CACHE_PROFILES } from './utils/profiles';
import { CACHE_TAGS } from './utils/tags';

// ==================== GROWTH RECORDS CACHE ====================

export async function getCachedGrowthRecordById(id: string) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.byId(id));
  cacheLife(CACHE_PROFILES.medicalShort);

  return growthService.getGrowthRecordById(id);
}

export async function getCachedGrowthRecordsByPatient(
  patientId: string,
  clinicId: string,
  options?: { limit?: number; offset?: number }
) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.growth(patientId));
  cacheTag(CACHE_TAGS.growth.patientAllGrowth(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return growthService.getGrowthRecordsByPatient(clinicId, options);
}

export async function getCachedLatestGrowthRecord(patientId: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.growth(patientId));
  cacheLife(CACHE_PROFILES.realtime);

  return growthService.getLatestGrowthRecord(patientId, clinicId);
}

export async function getCachedRecentGrowthRecords(clinicId: string, limit = 20) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.recentByClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return growthService.getRecentGrowthRecords(clinicId, limit);
}

// ==================== PATIENT MEASUREMENTS CACHE ====================

export async function getCachedPatientMeasurements(patientId: string, clinicId: string, limit = 50) {
  'use cache';

  cacheTag(CACHE_TAGS.patient.growth(patientId));
  cacheTag(CACHE_TAGS.growth.byPatient(patientId));
  cacheTag(CACHE_TAGS.growth.patientAllGrowth(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return growthService.getPatientMeasurements(patientId, clinicId, limit);
}

// ==================== WHO STANDARDS CACHE ====================

export async function getCachedWHOStandards(input: GrowthStandardsInput) {
  'use cache';

  const { gender, measurementType } = input;

  cacheTag(CACHE_TAGS.growth.standards);
  cacheTag(CACHE_TAGS.growth.standardsByGender(gender));
  cacheTag(CACHE_TAGS.growth.standardsByType(measurementType));
  cacheLife(CACHE_PROFILES.reference); // Long cache - static data

  return growthService.getWHOStandards(input);
}

export async function getCachedWHOStandardsMap() {
  'use cache';

  cacheTag(CACHE_TAGS.growth.standards);
  cacheTag(CACHE_TAGS.growth.standardsMap);
  cacheLife(CACHE_PROFILES.reference);

  return growthService.getWHOStandardsMap();
}

// ==================== Z-SCORE CACHE ====================

export async function getCachedZScores(ageDays: number, weight: number, gender: 'MALE' | 'FEMALE') {
  'use cache';

  cacheTag(CACHE_TAGS.growth.zScore(gender, ageDays));
  cacheTag(CACHE_TAGS.growth.zScoreByGender(gender));
  cacheLife(CACHE_PROFILES.reference);

  return growthService.calculateZScores(ageDays, weight, gender);
}

export async function getCachedMultipleZScores(
  measurements: Array<{
    ageDays: number;
    weight: number;
    gender: 'MALE' | 'FEMALE';
  }>
) {
  'use cache';

  const hash = measurements.map(m => `${m.gender}:${m.ageDays}:${m.weight.toFixed(1)}`).join('|');

  cacheTag(CACHE_TAGS.growth.batchZScores(hash));
  cacheLife(CACHE_PROFILES.reference);

  return growthService.calculateMultipleZScores(measurements);
}

// ==================== PERCENTILE CALCULATIONS CACHE ====================

export async function getCachedPercentile(input: GrowthPercentileInput) {
  'use cache';

  const { patientId } = input;

  cacheTag(CACHE_TAGS.growth.percentileByPatient(patientId));
  cacheTag(CACHE_TAGS.growth.byPatient(patientId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return growthService.calculatePercentile(input);
}

// ==================== GROWTH TRENDS CACHE ====================

export async function getCachedGrowthTrends(input: GrowthTrendsInput) {
  'use cache';

  const { patientId } = input;

  cacheTag(CACHE_TAGS.growth.trendsByPatient(patientId));
  cacheTag(CACHE_TAGS.growth.byPatient(patientId));
  cacheLife(CACHE_PROFILES.medicalMedium);

  return growthService.getGrowthTrends(input);
}

// ==================== VELOCITY CACHE ====================

export async function getCachedVelocity(input: VelocityCalculationInput) {
  'use cache';

  const { patientId } = input;

  cacheTag(CACHE_TAGS.growth.velocityByPatient(patientId));
  cacheTag(CACHE_TAGS.growth.byPatient(patientId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return growthService.calculateVelocity(input);
}

// ==================== COMPARISON CACHE ====================

export async function getCachedGrowthComparison(input: GrowthComparisonInput) {
  'use cache';

  const { patientId } = input;

  cacheTag(CACHE_TAGS.growth.comparisonByPatient(patientId));
  cacheTag(CACHE_TAGS.growth.byPatient(patientId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return growthService.compareGrowth(input);
}

// ==================== SUMMARY CACHE ====================

export async function getCachedGrowthSummary(patientId: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.summaryByPatient(patientId));
  cacheTag(CACHE_TAGS.growth.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.growth(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalMedium);

  return growthService.getGrowthSummary(patientId, clinicId);
}

// ==================== CLINIC OVERVIEW CACHE ====================

export async function getCachedClinicGrowthOverview(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.overviewByClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalLong);

  return growthService.getClinicGrowthOverview(clinicId);
}

// ==================== CHART DATA CACHE ====================

export async function getCachedZScoreChartData(
  gender: 'MALE' | 'FEMALE',
  measurementType: 'Weight' | 'Height' | 'HeadCircumference' = 'Weight'
) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.chartData(gender, measurementType));
  cacheLife(CACHE_PROFILES.reference);

  return growthService.getZScoreChartData(gender, measurementType);
}

export async function getCachedPatientZScoreChart(
  patientId: string,
  clinicId: string,
  measurementType: 'Weight' | 'Height' | 'HeadCircumference' = 'Weight'
) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.patientChartData(patientId, measurementType));
  cacheTag(CACHE_TAGS.growth.byPatient(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return growthService.getPatientZScoreChart(patientId, clinicId, measurementType);
}

// ==================== PROJECTION CACHE ====================

export async function getCachedGrowthProjection(
  patientId: string,
  clinicId: string,
  measurementType: string,
  projectionMonths = 12
) {
  'use cache';

  cacheTag(CACHE_TAGS.growth.projectionByPatient(patientId));
  cacheTag(CACHE_TAGS.growth.byPatient(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalLong);

  return growthService.getGrowthProjection(patientId, clinicId, measurementType, projectionMonths);
}
