'use cache';

import { cacheLife, cacheTag } from 'next/cache';

import { clinicService, dashboardService } from '../services/clinic.service';
import { CACHE_TAGS } from './utils/tags';

/**
 * 🟢 PURE CACHE LAYER
 * - ONLY 'use cache' directives
 * - NO Prisma imports
 * - Calls SERVICE layer
 */
export async function getCachedClinicById(id: string) {
  'use cache';

  cacheTag(CACHE_TAGS.clinic.byId(id));
  cacheLife('hours');

  return clinicService.getClinicById(id);
}

export async function getCachedUserClinicAccess(clinicId: string, userId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.clinic.members(clinicId));
  cacheTag(CACHE_TAGS.user.byId(userId));
  cacheLife('minutes');

  return clinicService.getClinicWithUserAccess(clinicId, userId);
}

export async function getCachedClinicWorkingHours(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.clinic.settings(clinicId));
  cacheLife('hours');

  return clinicService.getClinicWorkingHours(clinicId);
}

export async function getCachedFeatures() {
  'use cache';

  cacheTag(CACHE_TAGS.clinic.features('default'));
  cacheLife('days');

  return clinicService.getFeatures();
}

export async function getCachedClinicStats() {
  'use cache';

  cacheTag('clinic:stats:global');
  cacheLife('hours');

  return clinicService.getClinicStats();
}

export async function getCachedDashboardStats(clinicId: string, from: Date, to: Date) {
  'use cache';

  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheTag(CACHE_TAGS.appointment.byDateRange(from.toISOString(), to.toISOString()));
  cacheLife('minutes'); // 5 minutes default for dashboard

  return dashboardService.getDashboardStats(clinicId, from, to);
}

export async function getCachedGeneralStats() {
  'use cache';

  cacheTag(CACHE_TAGS.clinic.stats);
  cacheLife('hours'); // 1 hour for global stats

  return dashboardService.getGeneralStats();
}

export async function getCachedMedicalRecordsSummary(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.record.byClinic(clinicId));
  cacheLife('minutes');

  return dashboardService.getMedicalRecordsSummary(clinicId);
}

export async function getCachedRecentAppointments(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.appointment.today(clinicId));
  cacheLife('seconds'); // Real-time data

  return dashboardService.getRecentAppointments(clinicId);
}

export async function getCachedTodaySchedule(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.doctor.byClinic(clinicId));
  cacheTag(CACHE_TAGS.workingDays.byClinic(clinicId));
  cacheLife('seconds'); // Real-time data

  return dashboardService.getTodaySchedule(clinicId);
}

export async function getCachedUpcomingImmunizations(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.immunization.byClinic(clinicId));
  cacheLife('hours'); // 1 hour

  return dashboardService.getUpcomingImmunizations(clinicId);
}

export async function getCachedMonthlyPerformance(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife('hours'); // 1 hour

  return dashboardService.getMonthlyPerformance(clinicId);
}
