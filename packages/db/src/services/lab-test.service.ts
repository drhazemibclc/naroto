import { randomUUID } from 'node:crypto';

import logger from '@naroto/logger';
import redis from '@naroto/redis';
import { CACHE_KEYS, CACHE_TTL } from '@naroto/redis/cache-keys';

import prisma from '../client';
import { labTestRepo, medicalRecordRepo, validationRepo } from '../repositories';
import type { LabStatus } from '../types';

export class LabTestService {
  private readonly CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';
  constructor(private readonly db: typeof prisma = prisma) {}

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

  async getLabTestsByMedicalRecord(medicalId: string, clinicId: string) {
    try {
      // Get the medical record first to verify clinic access
      const medicalRecord = await medicalRecordRepo.findMedicalRecordById(this.db, medicalId);
      if (!medicalRecord || medicalRecord.patient?.clinicId !== clinicId) {
        return [];
      }

      const labTests = await labTestRepo.findLabTestsByMedicalRecord(this.db, medicalId);
      return labTests;
    } catch (error) {
      logger.error('Failed to get lab tests by medical record', { error, medicalId });
      throw new Error('Failed to retrieve lab tests');
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
      const total = await labTestRepo.countLabTestsByPatient(this.db, patientId);

      return { labTests, total };
    } catch (error) {
      logger.error('Failed to get patient lab tests', { error, patientId });
      throw new Error('Failed to retrieve lab tests');
    }
  }

  async getLabTestsByService(
    serviceId: string,
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
      const labTests = await labTestRepo.findLabTestsByService(this.db, serviceId, clinicId, options);
      const total = await labTestRepo.countLabTestsByService(this.db, serviceId, clinicId);

      return { labTests, total };
    } catch (error) {
      logger.error('Failed to get lab tests by service', { error, serviceId });
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

  async updateLabTest(
    id: string,
    clinicId: string,
    data: {
      result?: string;
      status?: LabStatus;
      notes?: string | null;
      performedBy?: string | null;
      reportDate?: Date | null;
      referenceRange?: string | null;
      units?: string | null;
    }
  ) {
    try {
      // Verify ownership
      const existing = await labTestRepo.findLabTestById(this.db, id);
      if (!existing || existing.medicalRecord?.patient?.clinicId !== clinicId) {
        throw new Error('Lab test not found');
      }

      const updated = await labTestRepo.updateLabTest(this.db, id, {
        ...data,
        updatedAt: new Date()
      });

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await redis.del(`${CACHE_KEYS.LAB_TEST}${id}`);
        await redis.del(`${CACHE_KEYS.PATIENT_LAB_TESTS}${existing.medicalRecord?.patientId}`);
      }

      logger.info('Lab test updated', { labTestId: id });
      return updated;
    } catch (error) {
      logger.error('Failed to update lab test', { error, id });
      throw error;
    }
  }

  async deleteLabTest(id: string, clinicId: string) {
    try {
      // Verify ownership
      const existing = await labTestRepo.findLabTestById(this.db, id);
      if (!existing || existing.medicalRecord?.patient?.clinicId !== clinicId) {
        throw new Error('Lab test not found');
      }

      await labTestRepo.softDeleteLabTest(this.db, id, {
        updatedAt: new Date()
      });

      // Invalidate cache
      if (this.CACHE_ENABLED) {
        await redis.del(`${CACHE_KEYS.LAB_TEST}${id}`);
        await redis.del(`${CACHE_KEYS.PATIENT_LAB_TESTS}${existing.medicalRecord?.patientId}`);
      }

      logger.info('Lab test deleted', { labTestId: id });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete lab test', { error, id });
      throw error;
    }
  }
}

// Export singleton instance
export const labTestService = new LabTestService();

// Export service class for testing/dependency injection
export default LabTestService;
