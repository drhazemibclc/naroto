import type { LabStatus, Prisma, PrismaClient } from '../../generated/client';

/**
 * 🔷 LAB TESTS REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

// ==================== READ OPERATIONS ====================
export async function countLabTestsByService(db: PrismaClient, serviceId: string, clinicId: string) {
  return db.labTest.count({
    where: {
      serviceId,
      medicalRecord: {
        clinicId
      }
    }
  });
}

export async function countLabTestsByPatient(db: PrismaClient, patientId: string) {
  return db.labTest.count({
    where: {
      medicalRecord: {
        patientId,
        isDeleted: false
      }
    }
  });
}
export async function findLabTestById(db: PrismaClient, id: string) {
  return db.labTest.findUnique({
    where: { id },
    include: {
      service: {
        select: {
          id: true,
          serviceName: true,
          description: true,
          price: true
        }
      },
      medicalRecord: {
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              clinicId: true
            }
          }
        }
      }
    }
  });
}

export async function findLabTestsByMedicalRecord(db: PrismaClient, medicalId: string) {
  return db.labTest.findMany({
    where: {
      recordId: medicalId
    },
    include: {
      service: {
        select: {
          id: true,
          serviceName: true,
          description: true
        }
      }
    },
    orderBy: { testDate: 'desc' }
  });
}

export async function findLabTestsByPatient(
  db: PrismaClient,
  patientId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    status?: LabStatus;
    limit?: number;
    offset?: number;
  }
) {
  const where: Prisma.LabTestWhereInput = {
    medicalRecord: {
      patientId,
      isDeleted: false
    }
  };

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.startDate || options?.endDate) {
    where.testDate = {};
    if (options.startDate) {
      where.testDate.gte = options.startDate;
    }
    if (options.endDate) {
      where.testDate.lte = options.endDate;
    }
  }

  return db.labTest.findMany({
    where,
    include: {
      service: {
        select: {
          id: true,
          serviceName: true,
          description: true
        }
      },
      medicalRecord: {
        select: {
          id: true,
          patientId: true
        }
      }
    },
    orderBy: { testDate: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0
  });
}

export async function findLabTestsByService(
  db: PrismaClient,
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
  const where: Prisma.LabTestWhereInput = {
    serviceId,
    medicalRecord: {
      clinicId
    }
  };

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.startDate || options?.endDate) {
    where.testDate = {};
    if (options.startDate) {
      where.testDate.gte = options.startDate;
    }
    if (options.endDate) {
      where.testDate.lte = options.endDate;
    }
  }

  return db.labTest.findMany({
    where,
    include: {
      service: true,
      medicalRecord: {
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    },
    orderBy: { testDate: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0
  });
}

// ==================== CREATE OPERATIONS ====================

export async function createLabTest(
  db: PrismaClient,
  data: {
    id: string;
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
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return db.labTest.create({
    data,
    include: {
      medicalRecord: {
        select: {
          patientId: true,
          clinicId: true
        }
      }
    }
  });
}

// ==================== UPDATE OPERATIONS ====================

export async function updateLabTest(
  db: PrismaClient,
  id: string,
  data: {
    result?: string;
    status?: LabStatus;
    notes?: string | null;
    performedBy?: string | null;
    reportDate?: Date | null;
    referenceRange?: string | null;
    units?: string | null;
    updatedAt: Date;
  }
) {
  return db.labTest.update({
    where: { id },
    data,
    include: {
      medicalRecord: {
        select: {
          patientId: true,
          clinicId: true
        }
      }
    }
  });
}

// ==================== DELETE OPERATIONS ====================

export async function softDeleteLabTest(
  db: PrismaClient,
  id: string,
  data: {
    updatedAt: Date;
  }
) {
  return db.labTest.update({
    where: { id },
    data
  });
}
