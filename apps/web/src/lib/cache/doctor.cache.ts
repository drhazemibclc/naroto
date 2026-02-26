// modules/doctor/doctor.cache.ts
'use cache';

import { doctorService } from '@naroto/db/services/doctor.service';
import { cacheLife, cacheTag } from 'next/cache';

import { CACHE_PROFILES } from './utils/profiles';
import { CACHE_TAGS } from './utils/tags';

/**
 * 🟢 CACHE LAYER
 * - ONLY 'use cache' directives
 * - NO Prisma imports
 * - Calls SERVICE layer, not QUERY layer
 * - Complete hierarchical tags
 */

export async function getCachedDoctors(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.doctor.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.medicalMedium); // 1 hour stale, 2 hour revalidate

  return doctorService.getDoctorsByClinic(clinicId);
}

export async function getCachedDoctorById(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.doctor.byId(id));
  cacheTag(CACHE_TAGS.doctor.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort); // 5 min stale, 10 min revalidate

  return doctorService.getDoctorById(id, clinicId);
}

export async function getCachedTodaySchedule(clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.appointment.today(clinicId));
  cacheTag(CACHE_TAGS.doctor.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.realtime); // 10 sec stale, 30 sec revalidate

  return doctorService.getTodaySchedule(clinicId);
}

export async function getCachedAvailableDoctors(clinicId: string, date?: Date) {
  'use cache';

  cacheTag(CACHE_TAGS.doctor.byClinic(clinicId));
  cacheTag(CACHE_TAGS.workingDays.byClinic(clinicId));
  cacheTag(date ? CACHE_TAGS.appointment.byDate(date.toISOString().split('T')[0] ?? '') : '');
  cacheLife(CACHE_PROFILES.medicalShort);

  return doctorService.getAvailableDoctors(clinicId, date);
}

export async function getCachedDoctorWithAppointments(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.doctor.byId(id));
  cacheTag(CACHE_TAGS.doctor.appointments(id));
  cacheTag(CACHE_TAGS.doctor.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return doctorService.getDoctorWithAppointments(id, clinicId);
}

export async function getCachedDoctorDashboardStats(doctorId: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.doctor.performance(doctorId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheTag(CACHE_TAGS.appointment.byDoctor(doctorId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return doctorService.getDoctorDashboardStats(doctorId, clinicId);
}

export async function getCachedDoctorWorkingDays(doctorId: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.doctor.workingDays(doctorId));
  cacheTag(CACHE_TAGS.doctor.byId(doctorId));
  cacheLife(CACHE_PROFILES.medicalMedium);

  return doctorService.getDoctorWorkingDays(doctorId, clinicId);
}

export async function getCachedPaginatedDoctors(params: {
  clinicId: string;
  search?: string;
  page: number;
  limit: number;
}) {
  'use cache';

  cacheTag(CACHE_TAGS.doctor.byClinic(params.clinicId));
  if (params.search) {
    cacheTag(`doctors:search:${params.search}`);
  }
  cacheLife(CACHE_PROFILES.medicalShort);

  return doctorService.getPaginatedDoctors(params);
}
