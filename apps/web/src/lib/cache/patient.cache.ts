// src/modules/patient/patient.cache.ts
'use cache';

import { cacheLife, cacheTag } from 'next/cache';

import { patientService } from '../services/patient.service';
import { CACHE_PROFILES } from './utils/profiles';
import { CACHE_TAGS } from './utils/tags';

/**
 * 🟢 CACHE LAYER
 * - ONLY 'use cache' directives
 * - NO Prisma imports
 * - NO business logic
 * - Calls SERVICE layer (which calls QUERY layer)
 * - Uses hierarchical cache tags
 */
export async function getCachedPatientById(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.patient.byId(id));
  cacheTag(CACHE_TAGS.patient.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return patientService.getPatientById(id);
}
export async function getCachedRecentPatients(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.patient.recent(clinicId));
  cacheTag(CACHE_TAGS.patient.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return patientService.getRecentPatients(clinicId);
}

export async function getCachedPatientFullData(id: string) {
  'use cache';

  cacheTag(CACHE_TAGS.patient.byId(id));
  cacheLife(CACHE_PROFILES.medicalShort);

  return patientService.getPatientFullDataById(id);
}

export async function getCachedPatientDashboardStats(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.patient.byId(id));
  cacheTag(CACHE_TAGS.patient.appointments(id));
  cacheTag(CACHE_TAGS.patient.records(id));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.realtime); // Dashboard needs real-time data

  return patientService.getPatientDashboardStats(id);
}

export async function getCachedPatientsByClinic(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.patient.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return patientService.getPatientsByClinic(clinicId);
}

export async function getCachedAllPatients(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.patient.byClinic(clinicId));
  cacheTag(CACHE_TAGS.patient.all);
  cacheLife(CACHE_PROFILES.medicalMedium);

  return patientService.getAllPatientsByClinic(clinicId);
}

export async function getCachedPatientCount(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.clinic.counts(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return patientService.getPatientCount(clinicId);
}

export async function getCachedAvailableDoctors(day: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.doctor.workingDays(day));
  cacheTag(CACHE_TAGS.doctor.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.realtime); // Availability changes frequently

  return patientService.getAvailableDoctorsByDay(day, clinicId);
}
