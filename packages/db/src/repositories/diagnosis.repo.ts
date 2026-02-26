import type { Prisma, PrismaClient } from '@generated/client';

/**
 * 🔷 DIAGNOSIS REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 * - NO error handling
 */

// ==================== READ OPERATIONS ====================

export async function findDiagnosisById(db: PrismaClient, id: string) {
  return db.diagnosis.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          clinicId: true
        }
      },
      doctor: {
        select: {
          id: true,
          name: true,
          specialty: true,
          email: true
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
      medical: {
        select: {
          id: true,
          createdAt: true
        }
      }
    }
  });
}

export async function findDiagnosesByPatient(
  db: PrismaClient,
  patientId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    limit?: number;
    offset?: number;
  }
) {
  const where: Prisma.DiagnosisWhereInput = {
    patientId,
    isDeleted: false
  };

  if (options?.type) {
    where.type = options.type;
  }

  if (options?.startDate || options?.endDate) {
    where.date = {};
    if (options.startDate) {
      where.date.gte = options.startDate;
    }
    if (options.endDate) {
      where.date.lte = options.endDate;
    }
  }

  return db.diagnosis.findMany({
    where,
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
      }
    },
    orderBy: { date: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0
  });
}

export async function findDiagnosesByMedicalRecord(db: PrismaClient, medicalId: string) {
  return db.diagnosis.findMany({
    where: {
      medicalId,
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
      }
    },
    orderBy: { date: 'desc' }
  });
}

export async function findDiagnosesByAppointment(db: PrismaClient, appointmentId: string) {
  return db.diagnosis.findMany({
    where: {
      appointmentId,
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
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { date: 'desc' }
  });
}

export async function findDiagnosesByDoctor(
  db: PrismaClient,
  doctorId: string,
  options?: { limit?: number; offset?: number }
) {
  return db.diagnosis.findMany({
    where: {
      doctorId,
      isDeleted: false
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      },
      medical: {
        select: {
          id: true
        }
      }
    },
    orderBy: { date: 'desc' },
    take: options?.limit || 20,
    skip: options?.offset || 0
  });
}

export async function countDiagnosesByPatient(db: PrismaClient, patientId: string) {
  return db.diagnosis.count({
    where: {
      patientId,
      isDeleted: false
    }
  });
}

// ==================== CREATE OPERATIONS ====================

export async function createDiagnosis(
  db: PrismaClient,
  data: {
    id: string;
    patientId: string;
    doctorId: string;
    medicalId: string;
    appointmentId?: string | null;
    clinicId: string;
    type?: string | null;
    symptoms: string;
    diagnosis: string;
    treatment?: string | null;
    notes?: string | null;
    followUpPlan?: string | null;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return db.diagnosis.create({
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

// ==================== UPDATE OPERATIONS ====================

export async function updateDiagnosis(
  db: PrismaClient,
  id: string,
  data: {
    diagnosis?: string;
    type?: string | null;
    symptoms?: string;
    treatment?: string | null;
    notes?: string | null;
    followUpPlan?: string | null;
    updatedAt: Date;
  }
) {
  return db.diagnosis.update({
    where: { id },
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

export async function softDeleteDiagnosis(
  db: PrismaClient,
  id: string,
  data: {
    isDeleted: boolean;
    deletedAt: Date;
    updatedAt: Date;
  }
) {
  return db.diagnosis.update({
    where: { id },
    data
  });
}
