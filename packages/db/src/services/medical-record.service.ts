import { randomUUID } from 'node:crypto';

import logger from '@naroto/logger';
import redis from '@naroto/redis';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';

import prisma from '../client';
import { medicalRecordRepo, validationRepo } from '../repositories';

export class MedicalRecordService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';
  constructor(private readonly db: typeof prisma = prisma) {}
  async getMedicalRecordByPatient(patientId: string, clinicId: string) {
    try {
      // Validate patient exists
      const patient = await validationRepo.checkPatientExists(this.db, patientId, clinicId);
      if (!patient) {
        return null;
      }

      const record = await medicalRecordRepo.findMedicalRecordsByPatient(this.db, patientId);
      return record;
    } catch (error) {
      logger.error('Failed to get medical record by patient', { error, patientId });
      throw new Error('Failed to retrieve medical record');
    }
  }
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

  async getMedicalRecordsByPatient(
    patientId: string,
    clinicId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      // Validate patient exists
      const patient = await validationRepo.checkPatientExists(this.db, patientId, clinicId);
      if (!patient) {
        return { records: [], total: 0 };
      }

      const records = await medicalRecordRepo.findMedicalRecordsByPatient(this.db, patientId, options);
      const total = await medicalRecordRepo.countMedicalRecordsByPatient(this.db, patientId);

      return { records, total };
    } catch (error) {
      logger.error('Failed to get patient medical records', { error, patientId });
      throw new Error('Failed to retrieve medical records');
    }
  }

  async getMedicalRecordsByClinic(
    clinicId: string,
    options?: {
      search?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    try {
      const records = await medicalRecordRepo.findMedicalRecordsByClinic(this.db, clinicId, options);
      return records;
    } catch (error) {
      logger.error('Failed to get clinic medical records', { error, clinicId });
      throw new Error('Failed to retrieve medical records');
    }
  }

  async countMedicalRecordsByClinic(clinicId: string, search?: string): Promise<number> {
    try {
      const count = await medicalRecordRepo.countMedicalRecordsByClinic(this.db, clinicId, search);
      return count;
    } catch (error) {
      logger.error('Failed to count medical records', { error, clinicId });
      throw new Error('Failed to count medical records');
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
}
export const medicalRecordService = new MedicalRecordService();
export default MedicalRecordService;
