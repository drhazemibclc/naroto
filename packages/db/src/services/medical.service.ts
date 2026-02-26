import { randomUUID } from 'node:crypto';

import logger from '@naroto/logger';
import redis from '@naroto/redis';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';

import type { PrismaClient } from '../../generated/client';
import prisma from '../client';
// Import repositories
import * as diagnosisRepo from '../repositories/diagnosis.repo';
import * as labTestRepo from '../repositories/lab-test.repo';
import * as medicalRecordRepo from '../repositories/medical-record.repo';
import * as prescriptionRepo from '../repositories/prescription.repo';
import * as validationRepo from '../repositories/validation.repo';
import * as vitalSignsRepo from '../repositories/vital-signs.repo';
import type { LabStatus } from '../types';

/**
 * 🔵 MEDICAL SERVICE
 * - Business logic coordination
 * - Date calculations
 * - Caching (ioredis)
 * - Logging (pino)
 * - Error handling
 * - Transaction management
 */

export class MedicalService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';
  constructor(private readonly db: typeof prisma = prisma) {}

  // ==================== DIAGNOSIS SERVICES ====================

  async getDiagnosisById(id: string, clinicId: string) {
    const cacheKey = `${CACHE_KEYS.DIAGNOSIS}${id}`;

    try {
      // Try cache first
      if (this.CACHE_ENABLED) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit for diagnosis', { id });
          return JSON.parse(cached);
        }
      }

      // Query repository
      const diagnosis = await diagnosisRepo.findDiagnosisById(this.db, id);

      if (!diagnosis || diagnosis.patient?.clinicId !== clinicId) {
        return null;
      }

      // Cache the result
      if (this.CACHE_ENABLED && diagnosis) {
        await redis.setex(cacheKey, CACHE_TTL.DIAGNOSIS, JSON.stringify(diagnosis));
      }

      return diagnosis;
    } catch (error) {
      logger.error('Failed to get diagnosis', { error, id });
      throw new Error('Failed to retrieve diagnosis');
    }
  }

  async getPatientDiagnoses(
    patientId: string,
    clinicId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      type?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      // Validate patient exists
      const patient = await validationRepo.checkPatientExists(this.db, patientId, clinicId);
      if (!patient) {
        return { diagnoses: [], total: 0 };
      }

      // Query repository
      const diagnoses = await diagnosisRepo.findDiagnosesByPatient(this.db, patientId, options);
      const total = await diagnosisRepo.countDiagnosesByPatient(this.db, patientId);

      return { diagnoses, total };
    } catch (error) {
      logger.error('Failed to get patient diagnoses', { error, patientId });
      throw new Error('Failed to retrieve diagnoses');
    }
  }

  async createDiagnosis(data: {
    patientId: string;
    doctorId: string;
    appointmentId?: string | null;
    clinicId: string;
    type?: string | null;
    symptoms: string;
    diagnosis: string;
    treatment?: string | null;
    notes?: string | null;
    followUpPlan?: string | null;
    date: Date;
  }) {
    try {
      // Validate entities exist
      const [patient, medicalRecord] = await Promise.all([
        validationRepo.checkPatientExists(this.db, data.patientId, data.clinicId),
        medicalRecordRepo.findMedicalRecordsByPatient(this.db, data.patientId, { limit: 1 })
      ]);

      if (!patient) {
        throw new Error('Patient not found');
      }

      const medicalId = medicalRecord[0]?.id;
      if (!medicalId) {
        throw new Error('No medical record found for patient');
      }

      const now = new Date();
      const diagnosis = await diagnosisRepo.createDiagnosis(this.db, {
        id: randomUUID(),
        ...data,
        medicalId,
        createdAt: now,
        updatedAt: now
      });

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await redis.del(`${CACHE_KEYS.DIAGNOSIS}${diagnosis.id}`);
        await redis.del(`${CACHE_KEYS.PATIENT_DIAGNOSES}${data.patientId}`);
      }

      logger.info('Diagnosis created', { diagnosisId: diagnosis.id, patientId: data.patientId });
      return diagnosis;
    } catch (error) {
      logger.error('Failed to create diagnosis', { error, data });
      throw error;
    }
  }

  async updateDiagnosis(
    id: string,
    clinicId: string,
    data: {
      diagnosis?: string;
      type?: string | null;
      symptoms?: string;
      treatment?: string | null;
      notes?: string | null;
      followUpPlan?: string | null;
    }
  ) {
    try {
      // Verify ownership
      const existing = await diagnosisRepo.findDiagnosisById(this.db, id);
      if (!existing || existing.patient?.clinicId !== clinicId) {
        throw new Error('Diagnosis not found');
      }

      const updated = await diagnosisRepo.updateDiagnosis(this.db, id, {
        ...data,
        updatedAt: new Date()
      });

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await redis.del(`${CACHE_KEYS.DIAGNOSIS}${id}`);
        await redis.del(`${CACHE_KEYS.PATIENT_DIAGNOSES}${existing.patientId}`);
      }

      logger.info('Diagnosis updated', { diagnosisId: id });
      return updated;
    } catch (error) {
      logger.error('Failed to update diagnosis', { error, id });
      throw error;
    }
  }

  async deleteDiagnosis(id: string, clinicId: string) {
    try {
      // Verify ownership
      const existing = await diagnosisRepo.findDiagnosisById(this.db, id);
      if (!existing || existing.patient?.clinicId !== clinicId) {
        throw new Error('Diagnosis not found');
      }

      const now = new Date();
      await diagnosisRepo.softDeleteDiagnosis(this.db, id, {
        isDeleted: true,
        deletedAt: now,
        updatedAt: now
      });

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await redis.del(`${CACHE_KEYS.DIAGNOSIS}${id}`);
        await redis.del(`${CACHE_KEYS.PATIENT_DIAGNOSES}${existing.patientId}`);
      }

      logger.info('Diagnosis deleted', { diagnosisId: id });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete diagnosis', { error, id });
      throw error;
    }
  }

  // ==================== MEDICAL RECORD SERVICES ====================

  async getMedicalRecordById(id: string, clinicId: string) {
    const cacheKey = `${CACHE_KEYS.MEDICAL_RECORD}${id}`;

    try {
      if (this.CACHE_ENABLED) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit for medical record', { id });
          return JSON.parse(cached);
        }
      }

      const record = await medicalRecordRepo.findMedicalRecordById(this.db, id);

      if (!record || record.patient?.clinicId !== clinicId) {
        return null;
      }

      if (this.CACHE_ENABLED && record) {
        await redis.setex(cacheKey, CACHE_TTL.MEDICAL_RECORD, JSON.stringify(record));
      }

      return record;
    } catch (error) {
      logger.error('Failed to get medical record', { error, id });
      throw new Error('Failed to retrieve medical record');
    }
  }

  async createMedicalRecord(data: { clinicId: string; patientId: string; doctorId: string; appointmentId: string }) {
    try {
      // Validate patient exists
      const patient = await validationRepo.checkPatientExists(this.db, data.patientId, data.clinicId);
      if (!patient) {
        throw new Error('Patient not found');
      }

      const now = new Date();
      const record = await medicalRecordRepo.createMedicalRecord(this.db, {
        id: randomUUID(),
        ...data,
        createdAt: now,
        updatedAt: now
      });

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await redis.del(`${CACHE_KEYS.PATIENT_MEDICAL_RECORDS}${data.patientId}`);
      }

      logger.info('Medical record created', { recordId: record.id, patientId: data.patientId });
      return record;
    } catch (error) {
      logger.error('Failed to create medical record', { error, data });
      throw error;
    }
  }

  // ==================== LAB TEST SERVICES ====================

  async getLabTestById(id: string, clinicId: string) {
    const cacheKey = `${CACHE_KEYS.LAB_TEST}${id}`;

    try {
      if (this.CACHE_ENABLED) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit for lab test', { id });
          return JSON.parse(cached);
        }
      }

      const labTest = await labTestRepo.findLabTestById(this.db, id);

      if (!labTest || labTest.medicalRecord?.patient?.clinicId !== clinicId) {
        return null;
      }

      if (this.CACHE_ENABLED && labTest) {
        await redis.setex(cacheKey, CACHE_TTL.LAB_TEST, JSON.stringify(labTest));
      }

      return labTest;
    } catch (error) {
      logger.error('Failed to get lab test', { error, id });
      throw new Error('Failed to retrieve lab test');
    }
  }

  async getPatientLabTests(
    patientId: string,
    clinicId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      status?: LabStatus;
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      // Validate patient exists
      const patient = await validationRepo.checkPatientExists(this.db, patientId, clinicId);
      if (!patient) {
        return { labTests: [], total: 0 };
      }

      const labTests = await labTestRepo.findLabTestsByPatient(this.db, patientId, options);

      return { labTests, total: labTests.length };
    } catch (error) {
      logger.error('Failed to get patient lab tests', { error, patientId });
      throw new Error('Failed to retrieve lab tests');
    }
  }

  async createLabTest(data: {
    recordId: string;
    serviceId: string;
    testDate: Date;
    result: string;
    status: LabStatus;
    notes?: string | null;
    orderedBy?: string | null;
    performedBy?: string | null;
    sampleType?: string | null;
    sampleCollectionDate?: Date | null;
    reportDate?: Date | null;
    referenceRange?: string | null;
    units?: string | null;
    clinicId: string;
  }) {
    try {
      // Validate medical record exists
      const record = await medicalRecordRepo.checkMedicalRecordExists(this.db, data.recordId, data.clinicId);
      if (!record) {
        throw new Error('Medical record not found');
      }

      const now = new Date();
      const labTest = await labTestRepo.createLabTest(this.db, {
        id: randomUUID(),
        ...data,
        createdAt: now,
        updatedAt: now
      });

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await redis.del(`${CACHE_KEYS.PATIENT_LAB_TESTS}${record.patientId}`);
      }

      logger.info('Lab test created', { labTestId: labTest.id, recordId: data.recordId });
      return labTest;
    } catch (error) {
      logger.error('Failed to create lab test', { error, data });
      throw error;
    }
  }

  // ==================== VITAL SIGNS SERVICES ====================

  async getPatientVitalSigns(
    patientId: string,
    clinicId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ) {
    try {
      // Validate patient exists
      const patient = await validationRepo.checkPatientExists(this.db, patientId, clinicId);
      if (!patient) {
        return { vitals: [], latest: null };
      }

      const vitals = await vitalSignsRepo.findVitalSignsByPatient(this.db, patientId, options);
      const latest = await vitalSignsRepo.findLatestVitalSignsByPatient(this.db, patientId);

      return { vitals, latest };
    } catch (error) {
      logger.error('Failed to get patient vitals', { error, patientId });
      throw new Error('Failed to retrieve vital signs');
    }
  }

  async createVitalSigns(data: {
    medicalId: string;
    patientId: string;
    recordedAt: Date;
    systolic?: number;
    diastolic?: number;
    bodyTemperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    gender?: 'MALE' | 'FEMALE';
    notes?: string;
    clinicId: string;
  }) {
    try {
      // Validate medical record exists
      const record = await medicalRecordRepo.checkMedicalRecordExists(this.db, data.medicalId, data.clinicId);
      if (!record) {
        throw new Error('Medical record not found');
      }

      // Calculate age in days/months if patient has date of birth
      let ageDays: number | undefined;
      let ageMonths: number | undefined;

      if (record.patient?.dateOfBirth) {
        const today = new Date();
        const dob = new Date(record.patient.dateOfBirth);
        const diffTime = Math.abs(today.getTime() - dob.getTime());
        ageDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        ageMonths = Math.floor(ageDays / 30.44); // Approximate months
      }

      const now = new Date();
      const vitals = await vitalSignsRepo.createVitalSigns(this.db, {
        id: randomUUID(),
        ...data,
        ageDays,
        ageMonths,
        createdAt: now,
        updatedAt: now
      });

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await redis.del(`${CACHE_KEYS.PATIENT_VITALS}${data.patientId}`);
      }

      logger.info('Vital signs created', { vitalsId: vitals.id, patientId: data.patientId });
      return vitals;
    } catch (error) {
      logger.error('Failed to create vital signs', { error, data });
      throw error;
    }
  }

  // ==================== PRESCRIPTION SERVICES ====================

  async getPatientActivePrescriptions(patientId: string, clinicId: string) {
    try {
      // Validate patient exists
      const patient = await validationRepo.checkPatientExists(this.db, patientId, clinicId);
      if (!patient) {
        return [];
      }

      const prescriptions = await prescriptionRepo.findActivePrescriptionsByPatient(this.db, patientId, new Date());

      return prescriptions;
    } catch (error) {
      logger.error('Failed to get active prescriptions', { error, patientId });
      throw new Error('Failed to retrieve prescriptions');
    }
  }

  // ==================== COMPREHENSIVE PATIENT MEDICAL DATA ====================

  async getPatientMedicalSummary(patientId: string, clinicId: string) {
    try {
      // Validate patient exists
      const patient = await validationRepo.checkPatientExists(this.db, patientId, clinicId);
      if (!patient) {
        return null;
      }

      // Run queries in parallel
      const [diagnoses, medicalRecords, labTests, vitals, prescriptions] = await Promise.all([
        diagnosisRepo.findDiagnosesByPatient(this.db, patientId, { limit: 10 }),
        medicalRecordRepo.findMedicalRecordsByPatient(this.db, patientId, { limit: 5 }),
        labTestRepo.findLabTestsByPatient(this.db, patientId, { limit: 10 }),
        vitalSignsRepo.findVitalSignsByPatient(this.db, patientId, { limit: 20 }),
        prescriptionRepo.findActivePrescriptionsByPatient(this.db, patientId, new Date())
      ]);

      // Calculate summary statistics
      // const now = new Date();
      // const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const summary = {
        patient: {
          id: patientId,
          age: patient.dateOfBirth ? this.calculateAge(patient.dateOfBirth) : null
        },
        stats: {
          totalDiagnoses: diagnoses.length,
          totalRecords: medicalRecords.length,
          totalLabTests: labTests.length,
          activePrescriptions: prescriptions.length
        },
        recentData: {
          diagnoses: diagnoses.slice(0, 3),
          labTests: labTests.slice(0, 3),
          vitals: vitals.slice(0, 5),
          upcomingAppointments: [] // Would be fetched from appointment service
        }
      };

      return summary;
    } catch (error) {
      logger.error('Failed to get patient medical summary', { error, patientId });
      throw new Error('Failed to retrieve medical summary');
    }
  }

  // ==================== HELPER METHODS ====================

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }

    return age;
  }

  // ==================== TRANSACTION EXAMPLE ====================

  async createCompleteMedicalEncounter(data: {
    patientId: string;
    doctorId: string;
    appointmentId: string;
    clinicId: string;
    diagnosis: {
      symptoms: string;
      diagnosis: string;
      treatment?: string;
    };
    vitals?: {
      systolic?: number;
      diastolic?: number;
      temperature?: number;
      heartRate?: number;
    };
    prescriptions?: Array<{
      medicationName: string;
      dosage: string;
      duration: string;
    }>;
  }) {
    return this.db.$transaction(async tx => {
      try {
        // 1. Create medical record
        const now = new Date();
        const medicalRecord = await medicalRecordRepo.createMedicalRecord(tx as unknown as PrismaClient, {
          id: randomUUID(),
          clinicId: data.clinicId,
          patientId: data.patientId,
          doctorId: data.doctorId,
          appointmentId: data.appointmentId,
          createdAt: now,
          updatedAt: now
        });

        // 2. Create diagnosis
        const diagnosis = await diagnosisRepo.createDiagnosis(tx as unknown as PrismaClient, {
          id: randomUUID(),
          patientId: data.patientId,
          doctorId: data.doctorId,
          medicalId: medicalRecord.id,
          appointmentId: data.appointmentId,
          clinicId: data.clinicId,
          symptoms: data.diagnosis.symptoms,
          diagnosis: data.diagnosis.diagnosis,
          treatment: data.diagnosis.treatment,
          date: now,
          createdAt: now,
          updatedAt: now
        });

        // 3. Create vitals if provided
        if (data.vitals) {
          await vitalSignsRepo.createVitalSigns(tx as unknown as PrismaClient, {
            id: randomUUID(),
            medicalId: medicalRecord.id,
            patientId: data.patientId,
            recordedAt: now,
            systolic: data.vitals.systolic,
            diastolic: data.vitals.diastolic,
            bodyTemperature: data.vitals.temperature,
            heartRate: data.vitals.heartRate,
            createdAt: now,
            updatedAt: now
          });
        }

        // 4. Create prescriptions if provided
        // This would use prescription repository

        // Invalidate caches
        if (this.CACHE_ENABLED) {
          await Promise.all([
            redis.del(`${CACHE_KEYS.PATIENT_DIAGNOSES}${data.patientId}`),
            redis.del(`${CACHE_KEYS.PATIENT_MEDICAL_RECORDS}${data.patientId}`),
            redis.del(`${CACHE_KEYS.PATIENT_VITALS}${data.patientId}`)
          ]);
        }

        logger.info('Complete medical encounter created', {
          patientId: data.patientId,
          recordId: medicalRecord.id,
          diagnosisId: diagnosis.id
        });

        return {
          medicalRecord,
          diagnosis
        };
      } catch (error) {
        logger.error('Failed to create medical encounter', { error, data });
        throw error;
      }
    });
  }
}

// Export singleton instance
export const medicalService = new MedicalService();

// Export service class for testing/dependency injection
export default MedicalService;
