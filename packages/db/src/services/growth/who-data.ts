// src/services/growth/who-data.ts
import { prisma } from '../../client';
import type { GrowthDataMap, LMSDataPoint } from './types';

let growthDataCache: GrowthDataMap | null = null;
let lastCacheUpdate: Date | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Load WHO growth data from database
 */
export async function loadWHOData(): Promise<GrowthDataMap> {
  const records = await prisma.wHOGrowthStandard.findMany({
    where: {
      chartType: 'WFA'
    },
    orderBy: {
      ageDays: 'asc'
    }
  });

  const dataMap: GrowthDataMap = new Map();

  for (const record of records) {
    if (record.lValue === null || record.mValue === null || record.sValue === null) {
      continue;
    }

    const key = record.gender;
    const point: LMSDataPoint = {
      ageDays: record.ageDays,
      lValue: record.lValue,
      mValue: record.mValue,
      sValue: record.sValue,
      sd0: record.sd0 || 0,
      sd1neg: record.sd1neg || 0,
      sd1pos: record.sd1pos || 0,
      sd2neg: record.sd2neg || 0,
      sd2pos: record.sd2pos || 0,
      sd3neg: record.sd3neg || 0,
      sd3pos: record.sd3pos || 0,
      sd4neg: record.sd4neg,
      sd4pos: record.sd4pos,
      gender: record.gender
    };

    const arr = dataMap.get(key) || [];
    arr.push(point);
    dataMap.set(key, arr);
  }

  // Sort by age
  for (const [key, arr] of dataMap) {
    arr.sort((a, b) => a.ageDays - b.ageDays);
    dataMap.set(key, arr);
  }

  return dataMap;
}

/**
 * Get cached growth data
 */
export async function getCachedGrowthData(): Promise<GrowthDataMap> {
  const now = new Date();

  if (!(growthDataCache && lastCacheUpdate) || now.getTime() - lastCacheUpdate.getTime() > CACHE_TTL) {
    growthDataCache = await loadWHOData();
    lastCacheUpdate = now;
  }

  return growthDataCache;
}

/**
 * Clear growth data cache
 */
export function clearGrowthDataCache(): void {
  growthDataCache = null;
  lastCacheUpdate = null;
}
