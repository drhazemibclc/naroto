import * as path from 'node:path';

import { Gender, MeasurementType } from '@generated/browser';

import type { PrismaSeedClient } from '../seed';

const ZSCORE_DATA_PATH = path.join(import.meta.dirname, '..', 'data', 'zscore-wfa.json');

interface ZScoreDataPoint {
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

interface GenderData {
  boys: ZScoreDataPoint[];
  girls: ZScoreDataPoint[];
}

interface ZScoreData {
  wfa: GenderData;
}

interface ValidatedGrowthRecord {
  ageDays: number;
  ageInMonths: number;
  gender: Gender;
  lValue: number;
  measurementType: MeasurementType;
  mValue: number;
  sd0: number;
  sd1neg: number;
  sd1pos: number;
  sd2neg: number;
  sd2pos: number;
  sd3neg: number;
  sd3pos: number;
  sd4neg: number | null;
  sd4pos: number | null;
  sValue: number;
}

function parseNumericValue(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function calculateAgeInMonths(ageDays: number): number {
  // Calculate age in months with better precision
  return Number((ageDays / 30.4375).toFixed(2)); // Keep 2 decimal places for accuracy
}

function mapDataPoint(
  dataPoint: ZScoreDataPoint,
  measurementType: MeasurementType,
  gender: Gender
): ValidatedGrowthRecord {
  const ageDaysRaw = parseNumericValue(dataPoint.Day);
  if (ageDaysRaw === null) {
    throw new Error(`Invalid 'Day' value: ${dataPoint.Day}`);
  }
  const ageDays = Math.round(ageDaysRaw);
  const ageInMonths = calculateAgeInMonths(ageDays);

  const lValue = parseNumericValue(dataPoint.L);
  const mValue = parseNumericValue(dataPoint.M);
  const sValue = parseNumericValue(dataPoint.S);
  const sd0 = parseNumericValue(dataPoint.SD0);
  const sd1neg = parseNumericValue(dataPoint.SD1neg);
  const sd1pos = parseNumericValue(dataPoint.SD1);
  const sd2neg = parseNumericValue(dataPoint.SD2neg);
  const sd2pos = parseNumericValue(dataPoint.SD2);
  const sd3neg = parseNumericValue(dataPoint.SD3neg);
  const sd3pos = parseNumericValue(dataPoint.SD3);
  const sd4neg = parseNumericValue(dataPoint.SD4neg);
  const sd4pos = parseNumericValue(dataPoint.SD4);

  const requiredFields = {
    lValue,
    mValue,
    sValue,
    sd0,
    sd1neg,
    sd1pos,
    sd2neg,
    sd2pos,
    sd3neg,
    sd3pos
  };

  for (const [key, value] of Object.entries(requiredFields)) {
    if (value === null) {
      throw new Error(`Missing or invalid required numeric field: ${key}`);
    }
  }

  const validatedFields = requiredFields as Record<keyof typeof requiredFields, number>;

  return {
    ageInMonths,
    ageDays,
    gender,
    measurementType,
    lValue: validatedFields.lValue,
    mValue: validatedFields.mValue,
    sValue: validatedFields.sValue,
    sd0: validatedFields.sd0,
    sd1neg: validatedFields.sd1neg,
    sd1pos: validatedFields.sd1pos,
    sd2neg: validatedFields.sd2neg,
    sd2pos: validatedFields.sd2pos,
    sd3neg: validatedFields.sd3neg,
    sd3pos: validatedFields.sd3pos,
    sd4neg,
    sd4pos
  };
}

export default async function wfaSeed(prisma: PrismaSeedClient) {
  console.log('--- Starting WHO Growth Standards Seeding ---');

  let whoJson: ZScoreData;
  try {
    whoJson = (await import(ZSCORE_DATA_PATH)).default as ZScoreData;
    if (!whoJson?.wfa) {
      throw new Error("JSON file is missing required 'wfa' data.");
    }
  } catch (error) {
    console.error(`❌ Error reading or parsing WHO data file at ${ZSCORE_DATA_PATH}.`);
    console.error(error instanceof Error ? error.message : 'Unknown error');
    return;
  }

  const allRecords: ValidatedGrowthRecord[] = [];
  let recordsSkipped = 0;

  console.log('Processing wfa data...');

  // Process boys data
  if (whoJson.wfa.boys && Array.isArray(whoJson.wfa.boys)) {
    console.log(`  Processing ${whoJson.wfa.boys.length} boys records...`);
    let boysProcessed = 0;
    let boysSkipped = 0;
    // FIX 1: Replace forEach with for...of
    for (const dataPoint of whoJson.wfa.boys) {
      try {
        const mappedRecord = mapDataPoint(dataPoint, MeasurementType.Weight, Gender.MALE);
        allRecords.push(mappedRecord);
        boysProcessed += 1; // FIX 2: Replace ++
      } catch (error) {
        boysSkipped += 1; // FIX 3: Replace ++
        recordsSkipped += 1; // FIX 4: Replace ++
        console.warn(`Skipping boys record Day ${dataPoint.Day}: ${error}`);
      }
    }
    console.log(`    ✅ Processed: ${boysProcessed}, ❌ Skipped: ${boysSkipped}`);
  }

  // Process girls data
  if (whoJson.wfa.girls && Array.isArray(whoJson.wfa.girls)) {
    console.log(`  Processing ${whoJson.wfa.girls.length} girls records...`);
    let girlsProcessed = 0;
    let girlsSkipped = 0;

    // FIX 5: Replace forEach with for...of
    for (const dataPoint of whoJson.wfa.girls) {
      try {
        const mappedRecord = mapDataPoint(dataPoint, MeasurementType.Weight, Gender.FEMALE);
        allRecords.push(mappedRecord);
        girlsProcessed += 1; // FIX 6: Replace ++
      } catch (error) {
        girlsSkipped += 1; // FIX 7: Replace ++
        recordsSkipped += 1; // FIX 8: Replace ++
        console.warn(`Skipping girls record Day ${dataPoint.Day}: ${error}`);
      }
    }
    console.log(`    ✅ Processed: ${girlsProcessed}, ❌ Skipped: ${girlsSkipped}`);
  }

  console.log(`\nTotal records successfully mapped: ${allRecords.length}`);

  if (recordsSkipped > 0) {
    console.log(`Records skipped due to errors: ${recordsSkipped}`);
  }

  // Check for duplicates using ageDays + gender + measurementType
  const uniqueRecordsMap = new Map<string, ValidatedGrowthRecord>();
  const duplicates: string[] = [];

  for (const record of allRecords) {
    // Use ageDays as the unique identifier along with gender and measurementType
    const key = `${record.gender}:${record.measurementType}:${record.ageDays}`;

    if (uniqueRecordsMap.has(key)) {
      duplicates.push(key);
      console.warn(`⚠️ Duplicate found: ${key} (Age: ${record.ageInMonths} months)`);
    } else {
      uniqueRecordsMap.set(key, record);
    }
  }

  const dataToInsert = Array.from(uniqueRecordsMap.values());

  console.log(`\nUnique records ready for insertion: ${dataToInsert.length}`);
  if (duplicates.length > 0) {
    console.log(`Actual duplicates found and removed: ${duplicates.length}`);
  }

  // Show sample age calculations
  console.log('\n📏 Sample Age Calculations:');
  const sampleAges = [0, 30, 365, 1000, 1856]; // Sample days

  // FIX 9: Replace forEach with for...of
  for (const days of sampleAges) {
    const months = calculateAgeInMonths(days);
    console.log(`  ${days} days = ${months} months`);
  }

  // Clear existing data
  console.log('\nClearing existing WHO growth standard data...');
  try {
    await prisma.wHOGrowthStandard.deleteMany({});
    console.log('✅ Existing data cleared.');
  } catch (error) {
    console.error('❌ Could not clear existing data:', error);
    return;
  }

  // Perform Bulk Insertion
  if (dataToInsert.length > 0) {
    try {
      const batchSize = 1000;
      let totalInserted = 0;

      for (let i = 0; i < dataToInsert.length; i += batchSize) {
        const batch = dataToInsert.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        console.log(`\nInserting batch ${batchNumber} (${batch.length} records)...`);

        const result = await prisma.wHOGrowthStandard.createMany({
          data: batch,
          skipDuplicates: false
        });

        totalInserted += result.count;
        console.log(`  ✅ Inserted ${result.count} records in batch ${batchNumber}.`);
      }

      console.log(`\n🎉 SUCCESS! Inserted ${totalInserted} total WHO Growth Standard records.`);

      const summary = {
        'Boys records': whoJson.wfa.boys?.length || 0,
        'Girls records': whoJson.wfa.girls?.length || 0,
        'Total expected': (whoJson.wfa.boys?.length || 0) + (whoJson.wfa.girls?.length || 0),
        'Successfully processed': allRecords.length,
        'Skipped due to errors': recordsSkipped,
        'Actual duplicates removed': duplicates.length,
        'Final inserted': totalInserted
      };

      console.log('\n📊 Seeding Summary:');

      // FIX 10: Replace forEach with for...of
      for (const [key, value] of Object.entries(summary)) {
        console.log(`  ${key}: ${value}`);
      }
    } catch (error) {
      console.error('❌ Failed to insert WHO Growth Standard records:', error);
    }
  } else {
    console.log('⚠️ No valid WHO Growth Standard data was mapped for insertion.');
  }
}
