import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Prisma } from '@generated/browser';

import type { PrismaSeedClient } from '../seed';

// ... (Type definitions remain the same) ...
interface DoseGuidelineData {
  CLINICAL_INDICATION: string;
  COMPATIBILITY_DILUENT: string;
  DOSE_UNIT: string;
  FINAL_CONCENTRATION_MG_ML: number | string;
  FREQUENCY_DAYS: string;
  GESTATIONAL_AGE_WEEKS_MAX: number | string;
  GESTATIONAL_AGE_WEEKS_MIN: number | string;
  MAX_DOSE_PER_24H: number | string;
  MAX_DOSE_PER_KG: number | string;
  MIN_DOSE_PER_KG: number | string;
  MIN_INFUSION_TIME_MIN: number | string;
  POST_NATAL_AGE_DAYS_MAX: number | string;
  POST_NATAL_AGE_DAYS_MIN: number | string;
  ROUTE: string;
  STOCK_CONCENTRATION_MG_ML: number | string;
}

interface DrugDatabase {
  [drugName: string]: DoseGuidelineData[];
}

function parseNumericValue(value: string | number): number | null {
  if (value === 'N/A' || value === '' || value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number.parseFloat(value.toString().trim());
  return Number.isNaN(parsed) ? null : parsed;
}

function parseIntegerValue(value: string | number): number | null {
  if (value === 'N/A' || value === '' || value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Math.floor(value);
  }
  const parsed = Number.parseInt(value.toString().trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function drugSeed(prisma: PrismaSeedClient) {
  console.log('🌱 Starting NICU Drug Database seeding...');

  try {
    // Use path.resolve to ensure the path is absolute from the project root if run from a seed script command
    const filePath = path.resolve('prisma/data/nicu_data.json');
    console.log(`📖 Reading data from: ${filePath}`);

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const drugData = JSON.parse(fileContent) as DrugDatabase;
    const drugNames = Object.keys(drugData);
    console.log(`📊 Found ${drugNames.length} drugs to process`);

    let totalGuidelines = 0;
    const allGuidelinesToInsert: Prisma.DoseGuidelineCreateManyInput[] = [];
    for (const [drugName, guidelines] of Object.entries(drugData)) {
      // 1. Upsert the drug
      const drug = await prisma.drug.upsert({
        where: { name: drugName },
        update: {},
        create: { name: drugName }
      });

      // 2. Prepare guidelines data for batch insertion
      for (const g of guidelines) {
        const guidelineData = {
          drugId: drug.id,
          route: g.ROUTE,
          clinicalIndication: g.CLINICAL_INDICATION,
          minDosePerKg: parseNumericValue(g.MIN_DOSE_PER_KG),
          maxDosePerKg: parseNumericValue(g.MAX_DOSE_PER_KG),
          doseUnit: g.DOSE_UNIT === 'N/A' ? null : g.DOSE_UNIT,
          frequencyDays: g.FREQUENCY_DAYS === 'N/A' ? null : g.FREQUENCY_DAYS,
          gestationalAgeWeeksMin: parseNumericValue(g.GESTATIONAL_AGE_WEEKS_MIN),
          gestationalAgeWeeksMax: parseNumericValue(g.GESTATIONAL_AGE_WEEKS_MAX),
          postNatalAgeDaysMin: parseIntegerValue(g.POST_NATAL_AGE_DAYS_MIN),
          postNatalAgeDaysMax: parseIntegerValue(g.POST_NATAL_AGE_DAYS_MAX),
          maxDosePer24h: parseNumericValue(g.MAX_DOSE_PER_24H),
          stockConcentrationMgMl: parseNumericValue(g.STOCK_CONCENTRATION_MG_ML),
          finalConcentrationMgMl: parseNumericValue(g.FINAL_CONCENTRATION_MG_ML),
          minInfusionTimeMin: parseIntegerValue(g.MIN_INFUSION_TIME_MIN),
          compatibilityDiluent: g.COMPATIBILITY_DILUENT === 'N/A' ? null : g.COMPATIBILITY_DILUENT
        };
        allGuidelinesToInsert.push(guidelineData);
      }

      totalGuidelines += guidelines.length; // FIX: Replaced totalGuidelines++ with compound assignment
      console.log(`✅ ${drugName}: ${guidelines.length} guidelines collected`);
    }

    // --- Performance Improvement: Batch Insert Guidelines ---
    if (allGuidelinesToInsert.length > 0) {
      console.log(`\n⏳ Inserting ${allGuidelinesToInsert.length} guidelines via batch insertion...`);

      // Use a reasonable batch size (e.g., 500 or 1000)
      const BATCH_SIZE = 1000;

      for (let i = 0; i < allGuidelinesToInsert.length; i += BATCH_SIZE) {
        const batch = allGuidelinesToInsert.slice(i, i + BATCH_SIZE);

        // NOTE: Using createMany requires Prisma to be connected to the database.
        await prisma.doseGuideline.createMany({
          data: batch,
          skipDuplicates: true // You may want this if your table schema supports it
        });

        console.log(`  Inserted batch of ${batch.length} guidelines.`);
      }
    }

    console.log('🎉 NICU Drug Database seeded successfully!');
    console.log(`📈 Summary — Drugs: ${drugNames.length}, Guidelines: ${totalGuidelines}`);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

export default drugSeed;
