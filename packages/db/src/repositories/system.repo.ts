import type { ChartType, Gender } from '../../generated/browser';
import type { PrismaClient } from '../../generated/client';

/**
 * 🔵 SYSTEM MODULE - QUERY LAYER
 *
 * RESPONSIBILITIES:
 * - ONLY raw Prisma database queries
 * - NO business logic, validation, or error handling
 * - NO cache directives
 
 */

// ==================== WHO GROWTH STANDARDS QUERIES ====================

/**
 * Get WHO growth standards by gender and measurement type
 */
export async function getWHOGrowthStandards(
  db: PrismaClient,
  gender: Gender,
  chartType: ChartType,
  p0: { minAgeDays: number | undefined; maxAgeDays: number | undefined; limit: number | undefined }
) {
  return db.wHOGrowthStandard.findMany({
    where: {
      gender,
      chartType,
      ageDays: {
        gte: p0.minAgeDays,
        lte: p0.maxAgeDays
      }
    },
    orderBy: {
      ageDays: 'asc'
    },
    take: p0.limit
  });
}

/**
 * Get all WHO growth standards (for cache warming)
 */
export async function getAllWHOGrowthStandards(db: PrismaClient) {
  return db.wHOGrowthStandard.findMany({
    orderBy: [{ gender: 'asc' }, { chartType: 'asc' }, { ageDays: 'asc' }]
  });
}

/**
 * Get growth standard by exact age and gender
 */
export async function getGrowthStandardByAge(db: PrismaClient, gender: Gender, chartType: ChartType, ageDays: number) {
  return await db.wHOGrowthStandard.findFirst({
    where: {
      gender,
      chartType,
      ageDays
    }
  });
}

/**
 * Get closest growth standard for age interpolation
 */
export async function getClosestGrowthStandards(
  db: PrismaClient,
  gender: Gender,
  chartType: ChartType,
  ageDays: number
) {
  const [lower, upper] = await Promise.all([
    db.wHOGrowthStandard.findFirst({
      where: {
        gender,
        chartType,
        ageDays: { lte: ageDays }
      },
      orderBy: { ageDays: 'desc' }
    }),
    db.wHOGrowthStandard.findFirst({
      where: {
        gender,
        chartType,
        ageDays: { gte: ageDays }
      },
      orderBy: { ageDays: 'asc' }
    })
  ]);

  return { lower, upper };
}
// ==================== DRUGS QUERIES ====================

/**
 * Get all drugs
 */
export async function getAllDrugs(db: PrismaClient) {
  return await db.drug.findMany({
    orderBy: { name: 'asc' },
    include: {
      guidelines: true
    }
  });
}

/**
 * Get drug by name
 */
export async function getDrugByName(db: PrismaClient, name: string) {
  return await db.drug.findUnique({
    where: { name },
    include: {
      guidelines: true
    }
  });
}

/**
 * Get drug by ID
 */
export async function getDrugById(db: PrismaClient, id: string) {
  return await db.drug.findUnique({
    where: { id },
    include: {
      guidelines: true
    }
  });
}
/**
 * Search drugs
 */
export async function searchDrugs(db: PrismaClient, query: string, limit = 20) {
  return await db.drug.findMany({
    where: {
      name: {
        contains: query,
        mode: 'insensitive'
      }
    },
    take: limit as number,
    orderBy: { name: 'asc' },
    include: {
      guidelines: {
        take: 1
      }
    }
  });
}

// ==================== DOSE GUIDELINES QUERIES ====================

/**
 * Get dose guidelines for a drug
 */
export async function getDoseGuidelines(db: PrismaClient, drugId: string) {
  return await db.doseGuideline.findMany({
    where: { drugId },
    orderBy: [{ clinicalIndication: 'asc' }, { route: 'asc' }]
  });
}
// ==================== VACCINE SCHEDULE QUERIES ====================

/**
 * Get vaccine schedule
 */
export async function getVaccineSchedule(db: PrismaClient) {
  return await db.vaccineSchedule.findMany({
    orderBy: [{ ageInDaysMin: 'asc' }, { vaccineName: 'asc' }]
  });
}
/**
 * Get vaccine by name
 */
export async function getVaccineByName(db: PrismaClient, name: string) {
  return await db.vaccineSchedule.findMany({
    where: { vaccineName: name },
    orderBy: { ageInDaysMin: 'asc' }
  });
}
/**
 * 📦 Grouped Export for convenience
 */
export const systemQueries = {
  getWHOGrowthStandards,
  getAllWHOGrowthStandards,
  getGrowthStandardByAge,
  getClosestGrowthStandards,
  getAllDrugs,
  getDrugByName,
  getDrugById,
  searchDrugs,
  getDoseGuidelines,
  getVaccineSchedule,
  getVaccineByName
} as const;
