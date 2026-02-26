import type { ImmunizationStatus, Prisma, PrismaClient } from '../../generated/client';

/**
 * 🔷 VACCINATION REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

export interface ImmunizationFindParams {
  clinicId?: string;
  endDate?: Date;
  includeCompleted?: boolean;
  limit?: number;
  offset?: number;
  patientId?: string;
  startDate?: Date;
  status?: ImmunizationStatus;
}

export interface DateRangeParams {
  endDate: Date;
  startDate: Date;
}

export interface VaccineScheduleFindParams {
  ageMonths?: number;
  isMandatory?: boolean;
  limit?: number;
  vaccineName?: string;
}

// ==================== IMMUNIZATION QUERIES ====================

export async function findImmunizationById(db: PrismaClient, id: string) {
  return db.immunization.findUnique({
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
          dateOfBirth: true,
          clinicId: true
        }
      },
      administeredBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      medicalRecords: {
        select: {
          id: true,
          createdAt: true
        }
      }
    }
  });
}

export async function findImmunizationsByPatient(
  db: PrismaClient,
  patientId: string,
  options?: {
    includeCompleted?: boolean;
    limit?: number;
    offset?: number;
  }
) {
  const where: Prisma.ImmunizationWhereInput = {
    patientId,
    isDeleted: false
  };

  if (!options?.includeCompleted) {
    where.status = 'PENDING';
  }

  return db.immunization.findMany({
    where,
    orderBy: { date: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    include: {
      administeredBy: {
        select: {
          id: true,
          name: true
        }
      },
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true
        }
      }
    }
  });
}
// export async function findOverdueImmunizations(
//   db: PrismaClient | Prisma.TransactionClient, // Support transactions
//   clinicId: string,
//   currentTime: Date = new Date(), // Default to now
//   options: { limit?: number; skip?: number } = {} // Add skip for pagination
// ) {
//   return db.immunization.findMany({
//     where: {
//       isDeleted: false,
//       status: 'PENDING',
//       date: {
//         lt: currentTime
//       },
//       patient: {
//         clinicId,
//         isDeleted: false // Ensure we aren't pulling immunizations for deleted patients
//       }
//     },
//     include: {
//       patient: {
//         select: {
//           id: true,
//           firstName: true,
//           lastName: true,
//           dateOfBirth: true
//           // Consider adding phone/contact info if this is for an "Overdue" dashboard
//         }
//       }
//       // If your schema has a vaccine model, include the name
//       // vaccine: { select: { name: true } }
//     },
//     orderBy: {
//       date: 'asc' // Oldest overdue first (highest priority)
//     },
//     take: options.limit ?? 20,
//     skip: options.skip
//   });
// }
export async function findImmunizationsByClinic(
  db: PrismaClient,
  clinicId: string,
  options?: {
    status?: ImmunizationStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  const where: Prisma.ImmunizationWhereInput = {
    patient: { clinicId },
    isDeleted: false
  };

  if (options?.status) {
    where.status = options.status;
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

  return db.immunization.findMany({
    where,
    orderBy: { date: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true
        }
      },
      administeredBy: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

export async function findImmunizationsByDateRange(
  db: PrismaClient,
  clinicId: string,
  dateRange: DateRangeParams,
  options?: {
    status?: ImmunizationStatus;
    limit?: number;
  }
) {
  const where: Prisma.ImmunizationWhereInput = {
    patient: { clinicId },
    isDeleted: false,
    date: {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    }
  };

  if (options?.status) {
    where.status = options.status;
  }

  return db.immunization.findMany({
    where,
    orderBy: { date: 'asc' },
    take: options?.limit,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          ageMonths: true
        }
      }
    }
  });
}

export async function findUpcomingImmunizations(
  db: PrismaClient,
  clinicId: string,
  dateRange: DateRangeParams,
  options?: {
    limit?: number;
  }
) {
  return db.immunization.findMany({
    where: {
      patient: { clinicId },
      isDeleted: false,
      status: 'PENDING',
      date: {
        gte: dateRange.startDate,
        lte: dateRange.endDate
      }
    },
    orderBy: { date: 'asc' },
    take: options?.limit || 20,
    select: {
      id: true,
      vaccine: true,
      date: true,
      status: true,
      isOverDue: true,
      dose: true,
      daysOverDue: true,
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          ageMonths: true
        }
      }
    }
  });
}

export async function findOverdueImmunizations(
  db: PrismaClient,
  clinicId: string,
  cutoffDate: Date,
  options?: {
    daysOverdue?: number;
    limit?: number;
  }
) {
  return db.immunization.findMany({
    where: {
      patient: { clinicId },
      isDeleted: false,
      status: 'PENDING',
      date: {
        lt: cutoffDate
      }
    },
    orderBy: { date: 'asc' },
    take: options?.limit || 20,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true
        }
      }
    }
  });
}

// ==================== PATIENT VERIFICATION ====================

export async function getPatientDateOfBirth(db: PrismaClient, patientId: string) {
  return db.patient.findUnique({
    where: {
      id: patientId,
      isDeleted: false
    },
    select: {
      id: true,
      dateOfBirth: true,
      firstName: true,
      lastName: true,
      clinicId: true
    }
  });
}

export async function checkPatientExistsInClinic(db: PrismaClient, patientId: string, clinicId: string) {
  return db.patient.findFirst({
    where: {
      id: patientId,
      clinicId,
      isDeleted: false
    },
    select: {
      id: true,
      clinicId: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true
    }
  });
}

export async function countActivePatientsInClinic(db: PrismaClient, clinicId: string) {
  return db.patient.count({
    where: {
      clinicId,
      status: 'ACTIVE',
      isDeleted: false
    }
  });
}

// ==================== COUNT OPERATIONS ====================

export async function countImmunizationsByPatient(db: PrismaClient, patientId: string, status?: ImmunizationStatus) {
  const where: Prisma.ImmunizationWhereInput = {
    patientId,
    isDeleted: false
  };

  if (status) {
    where.status = status;
  }

  return db.immunization.count({ where });
}

export async function countImmunizationsByClinic(db: PrismaClient, clinicId: string, status?: ImmunizationStatus) {
  const where: Prisma.ImmunizationWhereInput = {
    patient: { clinicId },
    isDeleted: false
  };

  if (status) {
    where.status = status;
  }

  return db.immunization.count({ where });
}

export async function countImmunizationsByDateRange(
  db: PrismaClient,
  clinicId: string,
  dateRange: DateRangeParams,
  status?: ImmunizationStatus
) {
  const where: Prisma.ImmunizationWhereInput = {
    patient: { clinicId },
    isDeleted: false,
    date: {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    }
  };

  if (status) {
    where.status = status;
  }

  return db.immunization.count({ where });
}

export async function countImmunizationsByStatus(db: PrismaClient, clinicId: string, status: ImmunizationStatus) {
  return db.immunization.count({
    where: {
      patient: { clinicId },
      isDeleted: false,
      status
    }
  });
}

// ==================== VACCINE SCHEDULE QUERIES ====================

export async function findVaccineSchedule(db: PrismaClient, options?: VaccineScheduleFindParams) {
  const where: Prisma.VaccineScheduleWhereInput = {};

  if (options?.ageMonths !== undefined) {
    const ageDays = options.ageMonths * 30;
    where.ageInDaysMin = { lte: ageDays };
    where.ageInDaysMax = { gte: ageDays };
  }

  if (options?.isMandatory !== undefined) {
    where.isMandatory = options.isMandatory;
  }

  if (options?.vaccineName) {
    where.vaccineName = {
      contains: options.vaccineName,
      mode: 'insensitive' as const
    };
  }

  return db.vaccineSchedule.findMany({
    where,
    orderBy: [{ ageInDaysMin: 'asc' }, { vaccineName: 'asc' }],
    take: options?.limit || 100
  });
}

export async function findVaccineScheduleById(db: PrismaClient, id: number) {
  return db.vaccineSchedule.findUnique({
    where: { id }
  });
}

export async function findVaccineScheduleByAge(db: PrismaClient, ageDays: number) {
  return db.vaccineSchedule.findMany({
    where: {
      ageInDaysMin: { lte: ageDays },
      ageInDaysMax: { gte: ageDays }
    },
    orderBy: { vaccineName: 'asc' }
  });
}

export async function findVaccineScheduleByAgeRange(db: PrismaClient, minAgeDays: number, maxAgeDays: number) {
  return db.vaccineSchedule.findMany({
    where: {
      ageInDaysMin: { gte: minAgeDays },
      ageInDaysMax: { lte: maxAgeDays }
    },
    orderBy: [{ ageInDaysMin: 'asc' }, { vaccineName: 'asc' }]
  });
}

// ==================== STAFF VERIFICATION ====================

export async function checkStaffExistsInClinic(db: PrismaClient, staffId: string, clinicId: string) {
  return db.staff.findFirst({
    where: {
      id: staffId,
      clinicId,
      deletedAt: null
    },
    select: {
      id: true,
      name: true
    }
  });
}

// ==================== WRITE OPERATIONS ====================

export interface ImmunizationCreateInput {
  administeredById?: string | null;
  batchNumber?: string | null;
  createdAt?: Date;
  date: Date;
  daysOverDue?: number;
  dose?: string | null;
  expirationDate?: Date | null;
  id?: string;
  isOverDue?: boolean;
  manufacturer?: string | null;
  medicalRecordId?: string | null;
  nextDoseDate?: Date | null;
  notes?: string | null;
  patientId: string;
  route?: string | null;
  site?: string | null;
  status?: ImmunizationStatus;
  updatedAt?: Date;
  vaccine: string;
}

export async function createImmunization(db: PrismaClient, data: ImmunizationCreateInput) {
  return db.immunization.create({
    data: {
      ...data,
      id: data.id || crypto.randomUUID(),
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date()
    },
    include: {
      patient: {
        select: {
          id: true,
          clinicId: true,
          firstName: true,
          lastName: true
        }
      },
      administeredBy: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

export async function createBulkImmunizations(db: PrismaClient, data: ImmunizationCreateInput[]) {
  return db.immunization.createMany({
    data: data.map(d => ({
      ...d,
      id: d.id || crypto.randomUUID(),
      createdAt: d.createdAt || new Date(),
      updatedAt: d.updatedAt || new Date()
    }))
  });
}

export interface ImmunizationUpdateInput {
  administeredById?: string | null;
  batchNumber?: string | null;
  date?: Date;
  daysOverDue?: number;
  dose?: string | null;
  expirationDate?: Date | null;
  isOverDue?: boolean;
  manufacturer?: string | null;
  nextDoseDate?: Date | null;
  notes?: string | null;
  route?: string | null;
  site?: string | null;
  status?: ImmunizationStatus;
  vaccine?: string;
}

export async function updateImmunization(
  db: PrismaClient,
  id: string,
  data: ImmunizationUpdateInput & { updatedAt: Date }
) {
  return db.immunization.update({
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

export async function updateImmunizationStatus(
  db: PrismaClient,
  id: string,
  status: ImmunizationStatus,
  data?: {
    isOverDue?: boolean;
    daysOverDue?: number;
    administeredById?: string | null;
  }
) {
  return db.immunization.update({
    where: { id },
    data: {
      status,
      ...data,
      updatedAt: new Date()
    },
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

export async function updateBulkImmunizationStatus(db: PrismaClient, ids: string[], status: ImmunizationStatus) {
  return db.immunization.updateMany({
    where: { id: { in: ids } },
    data: {
      status,
      updatedAt: new Date()
    }
  });
}

export async function softDeleteImmunization(
  db: PrismaClient,
  id: string,
  data: {
    isDeleted: boolean;
    deletedAt: Date;
    updatedAt: Date;
  }
) {
  return db.immunization.update({
    where: { id },
    data
  });
}

export async function softDeleteBulkImmunizations(
  db: PrismaClient,
  ids: string[],
  data: {
    isDeleted: boolean;
    deletedAt: Date;
    updatedAt: Date;
  }
) {
  return db.immunization.updateMany({
    where: { id: { in: ids } },
    data
  });
}

// ==================== VALIDATION QUERIES ====================

export async function checkDuplicateVaccination(
  db: PrismaClient,
  patientId: string,
  vaccine: string,
  date: Date,
  excludeId?: string
) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return db.immunization.findFirst({
    where: {
      patientId,
      vaccine,
      isDeleted: false,
      date: {
        gte: startOfDay,
        lte: endOfDay
      },
      ...(excludeId && { id: { not: excludeId } })
    }
  });
}

export async function checkImmunizationExists(db: PrismaClient, id: string) {
  const where: Prisma.ImmunizationWhereUniqueInput = { id };

  return db.immunization.findUnique({
    where,
    include: {
      patient: {
        select: {
          clinicId: true
        }
      }
    }
  });
}
