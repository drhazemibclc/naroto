import type { Gender, GrowthStatus, MeasurementType, Prisma, PrismaClient } from '../../generated/client';

/**
 * 🔷 GROWTH REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

export interface MeasurementCreateInput {
  ageDays: number;
  ageMonths: number;
  date: Date;
  growthStatus?: GrowthStatus | null;
  headCircumference?: number;
  height?: number;
  heightForAgeZ?: number | null;
  notes?: string | null;
  patientId: string;
  recordedAt?: Date;
  recordedById?: string;
  weight: number;
  weightForAgeZ?: number | null;
}

export interface WHOStandardFindParams {
  ageMonthsMax?: number;
  ageMonthsMin?: number;
  gender: Gender;
  measurementType: MeasurementType;
}

export interface ClosestWHOStandardParams {
  ageDays: number;
  ageMonths: number;
  gender: Gender;
  measurementType: MeasurementType;
}

export interface DateRange {
  endDate: Date;
  startDate: Date;
}

// ==================== MEASUREMENT QUERIES ====================

export async function findMeasurementById(db: PrismaClient, id: string) {
  return db.growthRecord.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          clinicId: true
        }
      }
    }
  });
}

export async function findMeasurementsByPatient(
  db: PrismaClient,
  patientId: string,
  options?: { limit?: number; offset?: number; fromDate?: Date; toDate?: Date }
) {
  return db.growthRecord.findMany({
    where: { patientId },
    orderBy: { recordedAt: 'desc' },
    take: options?.limit || 100,
    skip: options?.offset || 0,
    include: {
      patient: {
        select: {
          gender: true,
          dateOfBirth: true,
          clinicId: true
        }
      }
    }
  });
}

export async function findLatestMeasurementByPatient(db: PrismaClient, patientId: string) {
  return db.growthRecord.findFirst({
    where: { patientId },
    orderBy: { recordedAt: 'desc' }
  });
}

export async function countMeasurementsByPatient(db: PrismaClient, patientId: string) {
  return db.growthRecord.count({
    where: { patientId }
  });
}

// ==================== GROWTH RECORD QUERIES ====================

export async function findGrowthRecordById(db: PrismaClient, id: string) {
  return db.growthRecord.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          clinicId: true
        }
      },
      vitalSigns: true,
      medical: {
        select: {
          id: true,
          diagnosis: true,
          appointmentId: true
        }
      }
    }
  });
}

export async function findGrowthRecordsByPatient(
  db: PrismaClient,
  patientId: string,
  options?: { limit?: number; offset?: number }
) {
  return db.growthRecord.findMany({
    where: { patientId },
    orderBy: { date: 'desc' },
    take: options?.limit || 100,
    skip: options?.offset || 0,
    include: {
      patient: {
        select: {
          gender: true,
          dateOfBirth: true,
          clinicId: true
        }
      }
    }
  });
}

export async function findLatestGrowthRecordByPatient(db: PrismaClient, patientId: string) {
  return db.growthRecord.findFirst({
    where: { patientId },
    orderBy: { date: 'desc' }
  });
}

export async function countGrowthRecordsByPatient(db: PrismaClient, patientId: string) {
  return db.growthRecord.count({
    where: { patientId }
  });
}

export async function findGrowthRecordsByClinic(
  db: PrismaClient,
  clinicId: string,
  options?: { limit?: number; offset?: number }
) {
  return db.growthRecord.findMany({
    where: {
      patient: { clinicId }
    },
    orderBy: { date: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true
        }
      }
    }
  });
}

export async function findGrowthRecordsByDateRange(db: PrismaClient, patientId: string, dateRange: DateRange) {
  return db.growthRecord.findMany({
    where: {
      patientId,
      date: {
        gte: dateRange.startDate,
        lte: dateRange.endDate
      }
    },
    orderBy: { date: 'asc' }
  });
}

// ==================== WHO STANDARDS QUERIES ====================

export async function findWHOStandards(db: PrismaClient, params: WHOStandardFindParams) {
  const { gender, measurementType, ageMonthsMin, ageMonthsMax } = params;

  const where: Prisma.WHOGrowthStandardWhereInput = {
    gender,
    measurementType
  };

  if (ageMonthsMin !== undefined || ageMonthsMax !== undefined) {
    where.ageInMonths = {
      ...(ageMonthsMin !== undefined && { gte: ageMonthsMin }),
      ...(ageMonthsMax !== undefined && { lte: ageMonthsMax })
    };
  }

  return db.wHOGrowthStandard.findMany({
    where,
    orderBy: [{ ageInMonths: 'asc' }, { ageDays: 'asc' }]
  });
}

export async function findClosestWHOStandard(db: PrismaClient, params: ClosestWHOStandardParams) {
  const { gender, measurementType, ageDays, ageMonths } = params;

  return db.wHOGrowthStandard.findFirst({
    where: {
      gender,
      measurementType,
      OR: [
        { ageInMonths: ageMonths },
        ...(ageMonths < 24
          ? [
              {
                ageDays: {
                  gte: Math.max(0, ageDays - 7),
                  lte: ageDays + 7
                }
              }
            ]
          : [])
      ]
    },
    orderBy: [{ ageInMonths: 'asc' }, { ageDays: 'asc' }]
  });
}

export async function findWHOStandardByExactAge(
  db: PrismaClient,
  params: {
    gender: Gender;
    measurementType: MeasurementType;
    ageInMonths: number;
  }
) {
  return db.wHOGrowthStandard.findFirst({
    where: {
      gender: params.gender,
      measurementType: params.measurementType,
      ageInMonths: params.ageInMonths
    }
  });
}

// ==================== CREATE OPERATIONS ====================

export async function createMeasurement(db: PrismaClient, data: MeasurementCreateInput & { recordedAt?: Date }) {
  return db.growthRecord.create({
    data: {
      patientId: data.patientId,
      date: data.date,
      weight: data.weight,
      height: data.height ?? null,
      headCircumference: data.headCircumference ?? null,
      notes: data.notes ?? null,
      ageDays: data.ageDays,
      weightForAgeZ: data.weightForAgeZ ?? null,
      heightForAgeZ: data.heightForAgeZ ?? null,
      growthStatus: data.growthStatus ?? null,
      recordedAt: data.recordedAt || new Date()
    }
  });
}

export async function createGrowthRecord(
  db: PrismaClient,
  data: Prisma.GrowthRecordCreateInput & { createdAt?: Date; updatedAt?: Date }
) {
  return db.growthRecord.create({
    data: {
      ...data,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date()
    }
  });
}

export async function createBulkMeasurements(db: PrismaClient, data: MeasurementCreateInput[]) {
  return db.growthRecord.createMany({
    data: data.map(d => ({
      ...d,
      recordedAt: new Date()
    }))
  });
}

// ==================== UPDATE OPERATIONS ====================

export async function updateGrowthRecord(
  db: PrismaClient,
  id: string,
  data: Partial<{
    weight: number;
    height: number;
    headCircumference: number;
    bmi: number;
    notes: string;
    classification: string;
    weightForAgeZ: number;
    heightForAgeZ: number;
    growthStatus: GrowthStatus;
    updatedAt: Date;
  }>
) {
  return db.growthRecord.update({
    where: { id },
    data: {
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

// ==================== DELETE OPERATIONS ====================

export async function deleteGrowthRecord(db: PrismaClient, id: string) {
  return db.growthRecord.delete({
    where: { id }
  });
}

export async function softDeleteGrowthRecord(db: PrismaClient, id: string, data: { deletedAt: Date }) {
  return db.growthRecord.update({
    where: { id },
    data
  });
}

export async function deletePatientGrowthRecords(db: PrismaClient, patientId: string) {
  return db.growthRecord.deleteMany({
    where: { patientId }
  });
}

// ==================== AGGREGATION QUERIES ====================

export async function getGrowthStatsByClinic(db: PrismaClient, clinicId: string, dateRange?: DateRange) {
  const where = {
    patient: { clinicId },
    ...(dateRange && {
      date: {
        gte: dateRange.startDate,
        lte: dateRange.endDate
      }
    })
  };

  return db.$transaction([
    db.growthRecord.count({ where }),
    db.patient.count({
      where: {
        clinicId,
        growthRecords: { some: {} }
      }
    }),
    db.growthRecord.groupBy({
      by: ['growthStatus'],
      where,
      _count: true,
      orderBy: {
        growthStatus: 'asc'
      }
    })
  ]);
}

export async function getGrowthPercentilesByPatient(
  db: PrismaClient,
  patientId: string,
  measurementType: MeasurementType
) {
  return db.growthRecord.findMany({
    where: { patientId },
    select: {
      date: true,
      ageDays: true,
      [measurementType.toString() === 'WEIGHT' ? 'weight' : 'height']: true,
      weightForAgeZ: measurementType.toString() === 'WEIGHT',
      heightForAgeZ: measurementType.toString() === 'HEIGHT'
    },
    orderBy: { date: 'asc' }
  });
}

export async function countPatientsNeedingGrowthCheck(
  db: PrismaClient | Prisma.TransactionClient,
  clinicId: string,
  cutoffDate: Date
) {
  return db.patient.count({
    where: {
      clinicId,
      isDeleted: false,
      OR: [
        {
          // Case 1: Patient has never had a growth record
          growthRecords: {
            none: {}
          }
        },
        {
          // Case 2: Latest growth record is older than the cutoff date
          growthRecords: {
            every: {
              date: {
                lt: cutoffDate
              }
            }
          }
        }
      ]
    }
  });
}

// ==================== TREND ANALYSIS ====================

export async function getGrowthVelocity(
  db: PrismaClient,
  patientId: string,
  measurementType: 'weight' | 'height',
  startDate: Date,
  endDate: Date
) {
  return db.growthRecord.findMany({
    where: {
      patientId,
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      date: true,
      [measurementType]: true
    },
    orderBy: { date: 'asc' }
  });
}

// ==================== VALIDATION QUERIES ====================

export async function checkMeasurementExists(db: PrismaClient, id: string) {
  return db.growthRecord.findUnique({
    where: { id },
    select: { id: true, patientId: true }
  });
}

export async function checkDuplicateMeasurement(db: PrismaClient, patientId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return db.growthRecord.findFirst({
    where: {
      patientId,
      date: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });
}
