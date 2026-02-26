// lib/growth/getWhoZScores.ts

import db from '../client';
import type { GrowthDataMap, LMSDataPoint } from '../services/growth/types';
import { createValidatedGrowthDataMap } from './scoreCalc';

/**
 * Fetches WHO growth data from database and creates optimized GrowthDataMap
 */
export async function getGrowthDataMap(): Promise<GrowthDataMap> {
  try {
    const records = await db.wHOGrowthStandard.findMany({
      where: {
        chartType: 'WFA'
      },
      orderBy: {
        ageDays: 'asc'
      }
    });

    console.log(`📊 Loaded ${records.length} WHO growth records from database`);

    // Transform your database records to LMSDataPoint format, skipping any records with null LMS values
    const lmsData: LMSDataPoint[] = records
      .filter(
        (record: {
          lValue: number | null;
          mValue: number | null;
          sValue: number | null;
          sd0: number | null;
          sd1neg: number | null;
          sd1pos: number | null;
          sd2neg: number | null;
          sd2pos: number | null;
          sd3neg: number | null;
          sd3pos: number | null;
        }) =>
          record.lValue !== null &&
          record.mValue !== null &&
          record.sValue !== null &&
          record.sd0 !== null &&
          record.sd1neg !== null &&
          record.sd1pos !== null &&
          record.sd2neg !== null &&
          record.sd2pos !== null &&
          record.sd3neg !== null &&
          record.sd3pos !== null
      )
      .map(
        (record: {
          ageDays: number;
          lValue: number | null;
          mValue: number | null;
          sValue: number | null;
          sd0: number | null;
          sd1neg: number | null;
          sd1pos: number | null;
          sd2neg: number | null;
          sd2pos: number | null;
          sd3neg: number | null;
          sd3pos: number | null;
          sd4neg: number | null;
          sd4pos: number | null;
          gender: 'MALE' | 'FEMALE';
        }) => ({
          ageDays: record.ageDays,
          lValue: record.lValue as number,
          mValue: record.mValue as number,
          sValue: record.sValue as number,
          sd0: record.sd0 as number,
          sd1neg: record.sd1neg as number,
          sd1pos: record.sd1pos as number,
          sd2neg: record.sd2neg as number,
          sd2pos: record.sd2pos as number,
          sd3neg: record.sd3neg as number,
          sd3pos: record.sd3pos as number,
          sd4neg: record.sd4neg,
          sd4pos: record.sd4pos,
          gender: record.gender
        })
      );

    return createValidatedGrowthDataMap(lmsData);
  } catch (error) {
    console.error('❌ Error loading WHO growth data:', error);
    throw new Error('Failed to load WHO growth reference data');
  }
}

/**
 * Alternative: Load WHO data from JSON file (fallback)
 */
export async function getWhoZScores(): Promise<GrowthDataMap> {
  try {
    // First try to load from database
    return await getGrowthDataMap();
  } catch (error) {
    console.warn('⚠️ Falling back to JSON data:', error);

    // Fallback to JSON file
    try {
      const res = await fetch('/data/zscore.json');
      if (!res.ok) {
        throw new Error('Failed to load WHO z-score data');
      }

      const jsonData = await res.json();

      // Transform JSON data to LMSDataPoint format
      // This depends on your JSON structure - adjust accordingly
      const lmsData: LMSDataPoint[] = transformJsonToLMSData(jsonData);

      return createValidatedGrowthDataMap(lmsData);
    } catch (_jsonError) {
      console.error('❌ Failed to load WHO data from both database and JSON');
      throw new Error('WHO growth reference data unavailable');
    }
  }
}

/**
 * Transform JSON data to LMSDataPoint format (adjust based on your JSON structure)
 */
function transformJsonToLMSData(jsonData: unknown): LMSDataPoint[] {
  if (!isValidWhoDataStructure(jsonData)) {
    return [];
  }

  const { wfa } = jsonData as {
    wfa: { boys: Record<string, string>[]; girls: Record<string, string>[] };
  };

  const { boys, girls } = wfa;

  return [...transformGenderData(boys, 'MALE'), ...transformGenderData(girls, 'FEMALE')];
}

/**
 * Validate the JSON data structure
 */
function isValidWhoDataStructure(jsonData: unknown): jsonData is {
  wfa: { boys: Record<string, string>[]; girls: Record<string, string>[] };
} {
  if (typeof jsonData !== 'object' || jsonData === null) {
    return false;
  }

  const data = jsonData as Record<string, unknown>;

  if (!('wfa' in data) || typeof data.wfa !== 'object' || data.wfa === null) {
    return false;
  }

  const wfa = data.wfa as Record<string, unknown>;

  return 'boys' in wfa && Array.isArray(wfa.boys) && 'girls' in wfa && Array.isArray(wfa.girls);
}

/**
 * Transform gender-specific data points
 */
function transformGenderData(points: Record<string, string>[], gender: 'MALE' | 'FEMALE'): LMSDataPoint[] {
  return points.map(point => createLMSDataPoint(point, gender));
}

/**
 * Create a single LMSDataPoint from a raw data point
 */
function createLMSDataPoint(point: Record<string, string>, gender: 'MALE' | 'FEMALE'): LMSDataPoint {
  return {
    ageDays: Number.parseInt(point.Day ?? '0', 10),
    lValue: Number.parseFloat(point.L ?? '0'),
    mValue: Number.parseFloat(point.M ?? '0'),
    sValue: Number.parseFloat(point.S ?? '0'),
    sd0: Number.parseFloat(point.SD0 ?? '0'),
    sd1neg: Number.parseFloat(point.SD1neg ?? '0'),
    sd1pos: Number.parseFloat(point.SD1 ?? '0'),
    sd2neg: Number.parseFloat(point.SD2neg ?? '0'),
    sd2pos: Number.parseFloat(point.SD2 ?? '0'),
    sd3neg: Number.parseFloat(point.SD3neg ?? '0'),
    sd3pos: Number.parseFloat(point.SD3 ?? '0'),
    sd4neg: point.SD4neg ? Number.parseFloat(point.SD4neg) : null,
    sd4pos: point.SD4 ? Number.parseFloat(point.SD4) : null,
    gender
  };
}

/**
 * Cache for growth data to avoid repeated database calls
 */
let growthDataCache: GrowthDataMap | null = null;

/**
 * Get cached growth data map with automatic refresh
 */
export async function getCachedGrowthDataMap(): Promise<GrowthDataMap> {
  if (!growthDataCache) {
    growthDataCache = await getGrowthDataMap();
  }
  return growthDataCache;
}

/**
 * Clear growth data cache (useful for testing or when data updates)
 */
export function clearGrowthDataCache(): void {
  growthDataCache = null;
}

/**
 * Utility function to get available age ranges for validation
 */
export function getAvailableAgeRanges(dataMap: GrowthDataMap): {
  minAge: number;
  maxAge: number;
} {
  let minAge = Number.POSITIVE_INFINITY;
  let maxAge = Number.NEGATIVE_INFINITY;

  for (const dataArray of dataMap.values()) {
    for (const point of dataArray) {
      minAge = Math.min(minAge, point.ageDays);
      maxAge = Math.max(maxAge, point.ageDays);
    }
  }
  return {
    minAge: minAge === Number.POSITIVE_INFINITY ? 0 : minAge,
    maxAge: maxAge === Number.NEGATIVE_INFINITY ? 0 : maxAge
  };
}
