/**
 * 🟢 VISIT MODULE - CACHE LAYER
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

import { visitService } from '@naroto/db/services/visit.service';
import type { AppointmentStatus } from '@naroto/db/types';
import { cacheLife, cacheTag } from 'next/cache';

import { CACHE_PROFILES } from './utils/profiles';
import { CACHE_TAGS } from './utils/tags';

// ==================== VISIT DETAILS CACHE ====================

export async function getCachedVisitById(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.visit.byId(id));
  cacheTag(CACHE_TAGS.visit.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return visitService.getVisitById(id, clinicId);
}
export async function getUpcomingVaccination(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.visit.upcoming(clinicId));
  cacheTag(CACHE_TAGS.visit.byClinic(clinicId));
}

export async function getCachedVisitsByPatient(
  patientId: string,
  clinicId: string,
  options?: { limit?: number; offset?: number }
) {
  'use cache';

  cacheTag(CACHE_TAGS.visit.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.appointments(patientId));
  cacheTag(CACHE_TAGS.visit.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return visitService.getVisitsByPatient(patientId, clinicId, options);
}

// ==================== DASHBOARD CACHE ====================

export async function getCachedRecentVisits(clinicId: string, limit = 5) {
  'use cache';

  cacheTag(CACHE_TAGS.visit.recent(clinicId));
  cacheTag(CACHE_TAGS.visit.byClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return visitService.getRecentVisits(clinicId, limit);
}

export async function getCachedTodayVisits(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.visit.today(clinicId));
  cacheTag(CACHE_TAGS.visit.byClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.realtime);

  return visitService.getTodayVisits(clinicId);
}

export async function getCachedUpcomingVisits(clinicId: string, options?: { limit?: number; doctorId?: string }) {
  'use cache';

  cacheTag(CACHE_TAGS.visit.upcoming(clinicId));
  cacheTag(CACHE_TAGS.visit.byClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));

  if (options?.doctorId) {
    cacheTag(CACHE_TAGS.visit.byDoctor(options.doctorId));
  }

  cacheLife(CACHE_PROFILES.realtime);

  return visitService.getUpcomingVisits(clinicId, options);
}

// ==================== COUNT CACHE ====================

export async function getCachedTodayVisitCount(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.visit.today(clinicId));
  cacheTag(CACHE_TAGS.visit.counts(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.realtime);

  return visitService.getTodayVisitCount(clinicId);
}

export async function getCachedMonthVisitCount(clinicId: string) {
  'use cache';

  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  cacheTag(CACHE_TAGS.visit.month(clinicId, monthKey));
  cacheTag(CACHE_TAGS.visit.counts(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return visitService.getMonthVisitCount(clinicId);
}

export async function getCachedVisitCountByStatus(clinicId: string, status: AppointmentStatus) {
  'use cache';

  cacheTag(CACHE_TAGS.visit.byStatus(clinicId, status));
  cacheTag(CACHE_TAGS.visit.counts(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return visitService.getVisitCountByStatus(clinicId, status);
}

// ==================== SCHEDULE CACHE ====================

export async function getCachedDoctorSchedule(doctorId: string, clinicId: string, date?: Date) {
  'use cache';

  const dateKey = date ? date.toISOString().split('T')[0] : 'today';
  cacheTag(CACHE_TAGS.visit.doctorSchedule(doctorId, dateKey ?? ''));
  cacheTag(CACHE_TAGS.visit.byDoctor(doctorId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.realtime);

  return visitService.getUpcomingVisits(clinicId, { doctorId });
}
