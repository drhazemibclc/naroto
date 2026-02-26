import type { Prisma } from '../../generated/browser';
import type { PrismaClient } from '../../generated/client';

/**
 * 🔷 VITAL SIGNS REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

// ==================== READ OPERATIONS ====================

export async function findVitalSignsById(db: PrismaClient, id: string) {
  return db.vitalSigns.findUnique({
    where: { id },
    include: {
      medical: {
        include: {
          patient: {
            select: {
              id: true,
              clinicId: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true
            }
          }
        }
      }
    }
  });
}

export async function findVitalSignsByMedicalRecord(db: PrismaClient, medicalId: string, options?: { limit?: number }) {
  return db.vitalSigns.findMany({
    where: { medicalId },
    orderBy: { recordedAt: 'desc' },
    take: options?.limit,
    include: {
      growthRecords: true
    }
  });
}

export async function findVitalSignsByPatient(
  db: PrismaClient,
  patientId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
) {
  const where: Prisma.VitalSignsWhereInput = {
    patientId
  };

  if (options?.startDate || options?.endDate) {
    where.recordedAt = {};
    if (options.startDate) {
      where.recordedAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.recordedAt.lte = options.endDate;
    }
  }

  return db.vitalSigns.findMany({
    where,
    orderBy: { recordedAt: 'desc' },
    take: options?.limit,
    include: {
      medical: {
        select: {
          id: true,
          appointmentId: true,
          doctorId: true
        }
      },
      growthRecords: true
    }
  });
}

export async function findLatestVitalSignsByPatient(db: PrismaClient, patientId: string) {
  return db.vitalSigns.findFirst({
    where: { patientId },
    orderBy: { recordedAt: 'desc' }
  });
}

// ==================== CREATE OPERATIONS ====================

export async function createVitalSigns(
  db: PrismaClient,
  data: {
    id: string;
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
    ageDays?: number;
    ageMonths?: number;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return db.vitalSigns.create({
    data,
    include: {
      medical: {
        select: {
          patientId: true,
          clinicId: true,
          patient: {
            select: {
              clinicId: true
            }
          }
        }
      }
    }
  });
}

// ==================== UPDATE OPERATIONS ====================

export async function updateVitalSigns(
  db: PrismaClient,
  id: string,
  data: {
    systolic?: number;
    diastolic?: number;
    bodyTemperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    notes?: string;
    updatedAt: Date;
  }
) {
  return db.vitalSigns.update({
    where: { id },
    data,
    include: {
      medical: {
        select: {
          patientId: true,
          clinicId: true
        }
      }
    }
  });
}

// ==================== DELETE OPERATIONS ====================

export async function deleteVitalSigns(db: PrismaClient, id: string) {
  return db.vitalSigns.delete({
    where: { id }
  });
}
