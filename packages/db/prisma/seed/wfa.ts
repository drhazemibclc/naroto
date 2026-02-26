// scripts/seed-who-growth-data.ts

import fs from 'node:fs';
import path from 'node:path';

import { ChartType, Gender } from '../../src/types';
import type { PrismaSeedClient } from '../seed';

interface WHODayData {
  Day: string;
  L: string;
  M: string;
  S: string;
  SD0: string;
  SD1: string;
  SD1neg: string;
  SD2: string;
  SD2neg: string;
  SD3: string;
  SD3neg: string;
  SD4: string;
  SD4neg: string;
}

interface WHOData {
  wfa: {
    boys: WHODayData[];
    girls: WHODayData[];
  };
}

export default async function seedWHOGrowthData(prisma: PrismaSeedClient) {
  console.log('🌱 Seeding WHO growth data...');

  // Read JSON data
  const dataPath = path.join(process.cwd(), 'data', 'wfa.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const whoData = JSON.parse(rawData) as WHOData;

  // Clear existing data
  await prisma.wHOGrowthStandard.deleteMany();
  console.log('🗑️ Cleared existing WHO growth data');

  const records = [];

  for (const dayData of whoData.wfa.boys) {
    const ageDays = Number.parseInt(dayData.Day, 10);

    records.push({
      ageDays,
      ageInMonths: Math.floor(ageDays / 30.4375),
      gender: Gender.MALE,
      chartType: ChartType.WFA,
      lValue: Number.parseFloat(dayData.L),
      mValue: Number.parseFloat(dayData.M),
      sValue: Number.parseFloat(dayData.S),
      sd0: Number.parseFloat(dayData.SD0),
      sd1neg: Number.parseFloat(dayData.SD1neg),
      sd1pos: Number.parseFloat(dayData.SD1),
      sd2neg: Number.parseFloat(dayData.SD2neg),
      sd2pos: Number.parseFloat(dayData.SD2),
      sd3neg: Number.parseFloat(dayData.SD3neg),
      sd3pos: Number.parseFloat(dayData.SD3),
      sd4neg: Number.parseFloat(dayData.SD4neg),
      sd4pos: Number.parseFloat(dayData.SD4)
    });
  }

  for (const dayData of whoData.wfa.girls) {
    const ageDays = Number.parseInt(dayData.Day, 10);

    records.push({
      ageDays,
      ageInMonths: Math.floor(ageDays / 30.4375),
      gender: Gender.FEMALE,
      chartType: ChartType.WFA,
      lValue: Number.parseFloat(dayData.L),
      mValue: Number.parseFloat(dayData.M),
      sValue: Number.parseFloat(dayData.S),
      sd0: Number.parseFloat(dayData.SD0),
      sd1neg: Number.parseFloat(dayData.SD1neg),
      sd1pos: Number.parseFloat(dayData.SD1),
      sd2neg: Number.parseFloat(dayData.SD2neg),
      sd2pos: Number.parseFloat(dayData.SD2),
      sd3neg: Number.parseFloat(dayData.SD3neg),
      sd3pos: Number.parseFloat(dayData.SD3),
      sd4neg: Number.parseFloat(dayData.SD4neg),
      sd4pos: Number.parseFloat(dayData.SD4)
    });
  }

  // 🚀 FAST + SAFE
  await prisma.wHOGrowthStandard.createMany({
    data: records,
    skipDuplicates: true
  });

  console.log(`✅ Seeded ${records.length} WHO WFA records`);
}
