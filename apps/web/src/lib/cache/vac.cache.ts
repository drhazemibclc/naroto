/**
 * 🟢 VACCINATION MODULE - CACHE LAYER
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

import type { ImmunizationStatus } from '@naroto/db';
import { vaccinationService } from '@naroto/db/services/vaccination.service';
import { cacheLife, cacheTag } from 'next/cache';

import { CACHE_PROFILES } from './utils/profiles';
import { CACHE_TAGS } from './utils/tags';

// ==================== IMMUNIZATION RECORDS CACHE ====================

export async function getCachedImmunizationById(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.byId(id));
  cacheTag(CACHE_TAGS.vaccination.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService.getImmunizationById(id, clinicId);
}

export async function getCachedImmunizationsByPatient(
  patientId: string,
  clinicId: string,
  options?: { includeCompleted?: boolean; limit?: number; offset?: number }
) {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.immunizations(patientId));
  cacheTag(CACHE_TAGS.vaccination.byClinic(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService.getPatientImmunizations(patientId, clinicId, options);
}

export async function getCachedImmunizationsByClinic(
  clinicId: string,
  options?: {
    status?: ImmunizationStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.byClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService.getClinicImmunizations(clinicId, options);
}

// ==================== UPCOMING & OVERDUE CACHE ====================

export async function getCachedUpcomingVaccinations(
  clinicId: string,
  options?: { daysAhead?: number; limit?: number }
) {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.upcoming(clinicId));
  cacheTag(CACHE_TAGS.vaccination.byClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService.getUpcomingImmunizations(clinicId, options?.daysAhead, options?.limit);
}

export async function getCachedOverdueVaccinations(
  clinicId: string,
  options?: { daysOverdue?: number; limit?: number }
) {
  'use cache';

  // cacheTag(CACHE_TAGS.vaccination.overdue(clinicId));
  cacheTag(CACHE_TAGS.vaccination.byClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService.getOverdueImmunizations(clinicId, options?.daysOverdue, options?.limit);
}

// ==================== COUNT CACHE ====================

export async function getCachedUpcomingVaccinationCount(clinicId: string, daysAhead = 30) {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.upcoming(clinicId));
  cacheTag(CACHE_TAGS.vaccination.counts(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService.getUpcomingImmunizations(clinicId, daysAhead).then(res => res.summary.total);
}

export async function getCachedOverdueVaccinationCount(clinicId: string, daysOverdue = 0) {
  'use cache';

  // cacheTag(CACHE_TAGS.vaccination.overdue(clinicId));
  cacheTag(CACHE_TAGS.vaccination.counts(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService.getOverdueImmunizations(clinicId, daysOverdue).then(res => res.summary.total);
}

export async function getCachedVaccinationCountByStatus(clinicId: string, status: ImmunizationStatus) {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.byStatus(clinicId, status));
  cacheTag(CACHE_TAGS.vaccination.counts(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService
    .getClinicVaccinationStats(clinicId)
    .then(res => (status === 'COMPLETED' ? res.completed : res.pending));
}

// ==================== VACCINE SCHEDULE CACHE ====================

export async function getCachedVaccineSchedule(options?: {
  ageMonths?: number;
  isMandatory?: boolean;
  vaccineName?: string;
  limit?: number;
}) {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.schedule);
  cacheLife(CACHE_PROFILES.reference);

  return vaccinationService.getVaccineSchedule({
    ...options,
    limit: options?.limit ?? 50
  });
}

export async function getCachedVaccineScheduleByAge(ageMonths: number) {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.scheduleByAge(ageMonths));
  cacheLife(CACHE_PROFILES.reference);

  return vaccinationService.getVaccineSchedule({ ageMonths });
}

// ==================== PATIENT SUMMARY CACHE ====================

export async function getCachedPatientVaccinationSummary(patientId: string, clinicId: string) {
  'use cache';

  // cacheTag(CACHE_TAGS.vaccination.summaryByPatient(patientId));
  cacheTag(CACHE_TAGS.patient.immunizations(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService.getPatientImmunizations(patientId, clinicId);
}

export async function getCachedCalculatedDueVaccines(
  patientId: string,
  clinicId: string,
  _input: {
    patientAgeDays: number;
    completedVaccines: Array<{
      vaccineName: string;
      doseNumber: number;
      administrationDate: Date;
    }>;
  }
) {
  'use cache';

  // Invalidate this if the patient's record changes or the global schedule changes
  cacheTag(CACHE_TAGS.vaccination.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.immunizations(patientId));
  cacheTag(CACHE_TAGS.vaccination.schedule);

  // High-intensity calculation, keep in cache for a short medical burst
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService.getDueVaccinesForPatient(patientId, clinicId);
}

/**
 * CACHED: Patient Immunization Record (Full Profile)
 * Combines history with patient metadata
 */
export async function getCachedPatientImmunizationRecord(clinicId: string, patientId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.vaccination.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.immunizations(patientId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return vaccinationService.getPatientImmunizations(patientId, clinicId);
}
