/**
 * 🟢 MEDICAL MODULE - CACHE LAYER
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

import type { LabStatus } from '@naroto/db/types';
import { cacheLife, cacheTag } from 'next/cache';

import { medicalService } from '../services/medical.service';
import { CACHE_PROFILES } from './utils/profiles';
import { CACHE_TAGS } from './utils/tags';

// ==================== DIAGNOSIS CACHE ====================

export async function getCachedDiagnosisById(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.diagnosis.byId(id));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getDiagnosisById(id, clinicId);
}

export async function getCachedDiagnosesByPatient(
  patientId: string,
  clinicId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    limit?: number;
  }
) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.diagnosis.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.records(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getDiagnosesByPatient(patientId, clinicId, options);
}

export async function getCachedDiagnosesByMedicalRecord(medicalId: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.diagnosis.byMedicalRecord(medicalId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getDiagnosesByMedicalRecord(medicalId, clinicId);
}

export async function getCachedDiagnosesByAppointment(appointmentId: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.diagnosis.byAppointment(appointmentId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getDiagnosesByAppointment(appointmentId, clinicId);
}

export async function getCachedDiagnosesByDoctor(doctorId: string, clinicId: string, limit?: number) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.diagnosis.byDoctor(doctorId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getDiagnosesByDoctor(doctorId, clinicId, limit);
}

// ==================== MEDICAL RECORDS CACHE ====================

export async function getCachedMedicalRecordById(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.record.byId(id));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getMedicalRecordById(id, clinicId);
}

export async function getCachedMedicalRecordsByPatient(
  patientId: string,
  clinicId: string,
  options?: { limit?: number; offset?: number }
) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.record.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.records(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalMedium);

  return medicalService.getMedicalRecordsByPatient(patientId, clinicId, options);
}

export async function getCachedMedicalRecordsByClinic(
  clinicId: string,
  options?: {
    search?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }
) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.record.byClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getMedicalRecordsByClinic(clinicId, options);
}

export async function getCachedMedicalRecordsCount(clinicId: string, search?: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.record.countByClinic(clinicId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getMedicalRecordsCount(clinicId, search);
}

// ==================== LAB TESTS CACHE ====================

export async function getCachedLabTestById(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.lab.byId(id));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getLabTestById(id, clinicId);
}

export async function getCachedLabTestsByMedicalRecord(medicalId: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.lab.byMedicalRecord(medicalId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getLabTestsByMedicalRecord(medicalId, clinicId);
}

export async function getCachedLabTestsByPatient(
  patientId: string,
  clinicId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    status?: LabStatus;
    limit?: number;
  }
) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.lab.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.records(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getLabTestsByPatient(patientId, clinicId, options);
}

export async function getCachedLabTestsByService(
  serviceId: string,
  clinicId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    status?: LabStatus;
    limit?: number;
  }
) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.lab.byService(serviceId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getLabTestsByService(serviceId, clinicId, options);
}

// ==================== PRESCRIPTIONS CACHE ====================

export async function getCachedPrescriptionsByMedicalRecord(
  medicalRecordId: string,
  clinicId: string,
  options?: { limit?: number }
) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.prescription.byMedicalRecord(medicalRecordId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getPrescriptionsByMedicalRecord(medicalRecordId, clinicId, options);
}

export async function getCachedActivePrescriptionsByPatient(patientId: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.prescription.active(patientId));
  cacheTag(CACHE_TAGS.patient.prescriptions(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getActivePrescriptionsByPatient(patientId, clinicId);
}

// ==================== VITAL SIGNS CACHE ====================

export async function getCachedVitalSignsById(id: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.vitalSigns.byId(id));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getVitalSignsById(id, clinicId);
}

export async function getCachedVitalSignsByMedicalRecord(
  medicalId: string,
  clinicId: string,
  options?: { limit?: number }
) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.vitalSigns.byMedicalRecord(medicalId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getVitalSignsByMedicalRecord(medicalId, clinicId, options);
}

export async function getCachedVitalSignsByPatient(
  patientId: string,
  clinicId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.vitalSigns.byPatient(patientId));
  cacheTag(CACHE_TAGS.patient.vitalSigns(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getVitalSignsByPatient(patientId, clinicId, options);
}

export async function getCachedLatestVitalSignsByPatient(patientId: string, clinicId: string) {
  'use cache';

  cacheTag(CACHE_TAGS.medical.vitalSigns.latestByPatient(patientId));
  cacheTag(CACHE_TAGS.patient.vitalSigns(patientId));
  cacheTag(CACHE_TAGS.clinic.dashboard(clinicId));
  cacheLife(CACHE_PROFILES.medicalShort);

  return medicalService.getLatestVitalSignsByPatient(patientId, clinicId);
}
