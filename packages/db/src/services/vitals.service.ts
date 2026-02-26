import { randomUUID } from 'node:crypto';

import logger from '@naroto/logger';
import redis from '@naroto/redis';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';

import prisma from '../client';
import { medicalRecordRepo, validationRepo, vitalSignsRepo } from '../repositories';

export class VitalService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';
  constructor(private readonly db: typeof prisma = prisma) {}

  async getVitalSignsById(id: string, clinicId: string) {
    const cacheKey = `${CACHE_KEYS.VITAL_SIGNS}${id}`;

    try {
      if (this.CACHE_ENABLED) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit for vital signs', { id });
          return JSON.parse(cached);
        }
      }

      const vitalSigns = await vitalSignsRepo.findVitalSignsById(this.db, id);

      if (!vitalSigns || vitalSigns.medical?.patient?.clinicId !== clinicId) {
        return null;
      }

      if (this.CACHE_ENABLED && vitalSigns) {
        await redis.setex(cacheKey, CACHE_TTL.VITAL_SIGNS, JSON.stringify(vitalSigns));
      }

      return vitalSigns;
    } catch (error) {
      logger.error('Failed to get vital signs', { error, id });
      throw new Error('Failed to retrieve vital signs');
    }
  }

  async getVitalSignsByMedicalRecord(medicalId: string, clinicId: string) {
    try {
      // Get the medical record first to verify clinic access
      const medicalRecord = await medicalRecordRepo.findMedicalRecordById(this.db, medicalId);
      if (!medicalRecord || medicalRecord.patient?.clinicId !== clinicId) {
        return [];
      }

      const vitalSigns = await vitalSignsRepo.findVitalSignsByMedicalRecord(this.db, medicalId);
      return vitalSigns;
    } catch (error) {
      logger.error('Failed to get vital signs by medical record', { error, medicalId });
      throw new Error('Failed to retrieve vital signs');
    }
  }

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

  async updateVitalSigns(
    id: string,
    clinicId: string,
    data: {
      systolic?: number;
      diastolic?: number;
      bodyTemperature?: number;
      heartRate?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
      notes?: string;
    }
  ) {
    try {
      // Verify ownership
      const existing = await vitalSignsRepo.findVitalSignsById(this.db, id);
      if (!existing || existing.medical?.patient?.clinicId !== clinicId) {
        throw new Error('Vital signs not found');
      }

      const updated = await vitalSignsRepo.updateVitalSigns(this.db, id, {
        ...data,
        updatedAt: new Date()
      });

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await redis.del(`${CACHE_KEYS.VITAL_SIGNS}${id}`);
        await redis.del(`${CACHE_KEYS.PATIENT_VITALS}${existing.medical?.patientId}`);
      }

      logger.info('Vital signs updated', { vitalSignsId: id });
      return updated;
    } catch (error) {
      logger.error('Failed to update vital signs', { error, id });
      throw error;
    }
  }
}

export const vitalService = new VitalService();
export default VitalService;
