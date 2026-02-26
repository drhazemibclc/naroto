/**
 * 🔷 MEDICAL RECORDS REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

import type { Prisma, PrismaClient } from '../../generated/client';

// ==================== READ OPERATIONS ====================

export async function findMedicalRecordById(db: PrismaClient, id: string) {
  return db.medicalRecords.findUnique({
    where: {
      id,
      isDeleted: false
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gender: true,
          dateOfBirth: true,
          clinicId: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true
        }
      },
      appointment: {
        select: {
          id: true,
          appointmentDate: true,
          type: true,
          status: true
        }
      },
      encounter: {
        select: {
          id: true,
          diagnosis: true,
          date: true,
          type: true
        },
        orderBy: { date: 'desc' }
      },
      labTest: {
        select: {
          id: true,
          testDate: true,
          result: true,
          status: true,
          service: {
            select: {
              id: true,
              serviceName: true
            }
          }
        },
        orderBy: { testDate: 'desc' }
      },
      prescriptions: {
        select: {
          id: true,
          medicationName: true,
          issuedDate: true,
          status: true,
          doctor: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { issuedDate: 'desc' }
      },
      vitalSigns: {
        select: {
          id: true,
          recordedAt: true,
          systolic: true,
          diastolic: true,
          bodyTemperature: true,
          heartRate: true,
          respiratoryRate: true,
          oxygenSaturation: true
        },
        orderBy: { recordedAt: 'desc' },
        take: 1
      }
    }
  });
}

export async function findMedicalRecordsByPatient(
  db: PrismaClient,
  patientId: string,
  options?: { limit?: number; offset?: number }
) {
  return db.medicalRecords.findMany({
    where: {
      patientId,
      isDeleted: false
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true
        }
      },
      appointment: {
        select: {
          id: true,
          appointmentDate: true
        }
      },
      encounter: {
        select: {
          id: true,
          diagnosis: true,
          date: true
        },
        orderBy: { date: 'desc' },
        take: 1
      }
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0
  });
}

export async function findMedicalRecordsByClinic(
  db: PrismaClient,
  clinicId: string,
  options?: {
    search?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const where: Prisma.MedicalRecordsWhereInput = {
    clinicId,
    isDeleted: false
  };

  if (options?.search) {
    where.OR = [
      {
        patient: {
          firstName: { contains: options.search, mode: 'insensitive' }
        }
      },
      {
        patient: {
          lastName: { contains: options.search, mode: 'insensitive' }
        }
      },
      {
        patientId: { contains: options.search, mode: 'insensitive' }
      }
    ];
  }

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  return db.medicalRecords.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          image: true,
          colorCode: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 20,
    skip: options?.offset || 0
  });
}
export async function countMedicalRecordsByPatient(db: PrismaClient, patientId: string) {
  return db.medicalRecords.count({
    where: {
      patientId,
      isDeleted: false
    }
  });
}
export async function countMedicalRecordsByClinic(db: PrismaClient, clinicId: string, search?: string) {
  const where: Prisma.MedicalRecordsWhereInput = {
    clinicId,
    isDeleted: false
  };

  if (search) {
    where.OR = [
      { patient: { firstName: { contains: search, mode: 'insensitive' } } },
      { patient: { lastName: { contains: search, mode: 'insensitive' } } },
      { patientId: { contains: search, mode: 'insensitive' } }
    ];
  }

  return db.medicalRecords.count({ where });
}

// ==================== CREATE OPERATIONS ====================

export async function createMedicalRecord(
  db: PrismaClient,
  data: {
    id: string;
    clinicId: string;
    patientId: string;
    doctorId: string;
    appointmentId: string;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return db.medicalRecords.create({
    data,
    include: {
      patient: {
        select: {
          id: true,
          clinicId: true
        }
      }
    }
  });
}

// ==================== DELETE OPERATIONS ====================

export async function softDeleteMedicalRecord(
  db: PrismaClient,
  id: string,
  data: {
    isDeleted: boolean;
    deletedAt: Date;
    updatedAt: Date;
  }
) {
  return db.medicalRecords.update({
    where: { id },
    data
  });
}

// ==================== VALIDATION ====================

export async function checkMedicalRecordExists(db: PrismaClient, medicalId: string, clinicId: string) {
  return db.medicalRecords.findFirst({
    where: {
      id: medicalId,
      patient: {
        clinicId
      }
    },
    select: {
      id: true,
      patientId: true,
      clinicId: true,
      patient: {
        select: {
          dateOfBirth: true,
          gender: true
        }
      }
    }
  });
}
