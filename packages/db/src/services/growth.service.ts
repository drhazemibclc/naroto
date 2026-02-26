/**
 * 🟡 GROWTH MODULE - SERVICE LAYER
 *
 * RESPONSIBILITIES:
 * - Business logic and calculations
 * - Orchestrates queries and cache invalidation
 * - NO 'use cache' directives
 * - NO direct Prisma calls
 * - Calls query layer for data access
 * - Uses cache helpers for invalidation
 * - Input validation via schema
 * - Permission checks via userId
 */

import { prisma } from '@naroto/db';
import type { Gender, MeasurementType } from '@naroto/db/types';
import { calculateZScore, getAgeInDays } from '@naroto/db/utils';
import { CACHE_KEYS } from '@naroto/redis/cache-keys';
import { differenceInMonths } from 'date-fns';

import { AppError, NotFoundError, ValidationError } from '../error';
import * as growthQueries from '../repositories/growth.repo';
import * as patientQueries from '../repositories/patient.repo';
import { validateClinicAccess } from '../repositories/validation.repo';
import type {
  CreateGrowthRecordInput,
  GrowthComparisonInput,
  GrowthPercentileInput,
  GrowthStandardsInput,
  GrowthTrendsInput,
  UpdateGrowthRecordInput,
  VelocityCalculationInput
} from '../zodSchemas';
import type { LMSDataPoint } from './growth/types';

// ==================== TYPE DEFINITIONS ====================

export interface ZScoreChartData {
  ageRange: {
    minAgeDays: number;
    maxAgeDays: number;
    minAgeMonths: number;
    maxAgeMonths: number;
  };
  gender: 'MALE' | 'FEMALE';
  measurementType: 'Weight' | 'Height' | 'HeadCircumference';
  metadata: {
    totalPoints: number;
    dataSource: 'WHO';
    lastUpdated: Date;
  };
  points: LMSDataPoint[];
}

export interface PatientZScoreData {
  ageDays: number;
  ageMonths: number;
  classification: string;
  date: Date;
  height?: number | null;
  heightForAgeZ?: number | null;
  percentile?: number | null;
  weight?: number | null;
  weightForAgeZ?: number | null;
  zScore?: number | null;
}

export interface ClinicGrowthOverview {
  recentMeasurements: Array<{
    id: string;
    date: Date;
    patientId: string;
    weight?: number | null;
    height?: number | null;
    classification?: string | null;
    measurementType?: string | null;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      dateOfBirth: Date;
      gender: string | null;
    };
  }>;
  stats: {
    totalMeasurements: number;
    patientsMeasured: number;
    classifications: Array<{ classification: string | null; _count: { _all: number } }>;
  };
}

// ==================== SERVICE CLASS ====================

class GrowthService {
  // ==================== QUERY METHODS ====================

  async getGrowthRecordById(id: string) {
    const record = await growthQueries.findGrowthRecordById(prisma, id);
    if (!record) {
      throw new NotFoundError('Growth record', id);
    }
    return record;
  }

  async getGrowthRecordsByPatient(patientId: string, options?: { limit?: number; offset?: number }) {
    return growthQueries.findGrowthRecordsByPatient(prisma, patientId, options);
  }

  async getLatestGrowthRecord(patientId: string, clinicId: string) {
    await this.verifyPatientAccess(patientId, clinicId);
    return growthQueries.findLatestGrowthRecordByPatient(prisma, patientId);
  }

  async getRecentGrowthRecords(clinicId: string, limit = 20) {
    return growthQueries.findGrowthRecordsByClinic(prisma, clinicId, { limit });
  }

  async getPatientMeasurements(patientId: string, clinicId: string, limit = 50) {
    await this.verifyPatientAccess(patientId, clinicId);

    const [measurements, growthRecords] = await Promise.all([
      growthQueries.findMeasurementsByPatient(prisma, patientId, { limit }),
      growthQueries.findGrowthRecordsByPatient(prisma, patientId, { limit })
    ]);

    return {
      measurements,
      growthRecords,
      summary: {
        totalMeasurements: measurements.length,
        totalGrowthRecords: growthRecords.length,
        latestMeasurement: measurements[0] || null,
        latestGrowthRecord: growthRecords[0] || null,
        averageWeight: this.calculateAverage(growthRecords, 'weight'),
        averageHeight: this.calculateAverage(growthRecords, 'height')
      }
    };
  }

  async getGrowthSummary(patientId: string, clinicId: string) {
    await this.verifyPatientAccess(patientId, clinicId);

    const [records, latest] = await Promise.all([
      growthQueries.findGrowthRecordsByPatient(prisma, patientId),
      growthQueries.findLatestGrowthRecordByPatient(prisma, patientId)
    ]);

    return {
      totalRecords: records.length,
      latestRecord: latest,
      hasData: records.length > 0,
      firstRecordDate: records.at(-1)?.date ?? null,
      lastRecordDate: records[0]?.date ?? null
    };
  }

  async getClinicGrowthOverview(clinicId: string): Promise<ClinicGrowthOverview> {
    const [recentMeasurements, patientsWithData, stats] = await Promise.all([
      growthQueries.findGrowthRecordsByClinic(prisma, clinicId, { limit: 50 }),
      prisma.patient.count({
        where: {
          clinicId,
          growthRecords: { some: {} }
        }
      }),
      growthQueries.getGrowthStatsByClinic(prisma, clinicId)
    ]);

    return {
      stats: {
        totalMeasurements: stats[0],
        patientsMeasured: patientsWithData,
        classifications: stats[2] as ClinicGrowthOverview['stats']['classifications']
      },
      recentMeasurements: recentMeasurements.slice(0, 10) as ClinicGrowthOverview['recentMeasurements']
    };
  }

  // ==================== WHO STANDARDS METHODS ====================

  async getWHOStandards(input: GrowthStandardsInput) {
    const { gender, measurementType, ageMonthsMin, ageMonthsMax } = input;

    return growthQueries.findWHOStandards(prisma, {
      gender,
      measurementType,
      ageMonthsMin,
      ageMonthsMax
    });
  }

  async getWHOStandardsMap() {
    const [maleWeight, femaleWeight, maleHeight, femaleHeight, maleHeadCircumference, femaleHeadCircumference] =
      await Promise.all([
        growthQueries.findWHOStandards(prisma, { gender: 'MALE', measurementType: 'Weight' }),
        growthQueries.findWHOStandards(prisma, { gender: 'FEMALE', measurementType: 'Weight' }),
        growthQueries.findWHOStandards(prisma, { gender: 'MALE', measurementType: 'Height' }),
        growthQueries.findWHOStandards(prisma, { gender: 'FEMALE', measurementType: 'Height' }),
        growthQueries.findWHOStandards(prisma, { gender: 'MALE', measurementType: 'HeadCircumference' }),
        growthQueries.findWHOStandards(prisma, { gender: 'FEMALE', measurementType: 'HeadCircumference' })
      ]);

    const map = new Map();
    map.set('MALE_Weight', maleWeight);
    map.set('FEMALE_Weight', femaleWeight);
    map.set('MALE_Height', maleHeight);
    map.set('FEMALE_Height', femaleHeight);
    map.set('MALE_HeadCircumference', maleHeadCircumference);
    map.set('FEMALE_HeadCircumference', femaleHeadCircumference);

    return map;
  }

  // ==================== CALCULATION METHODS ====================

  async calculatePercentile(input: GrowthPercentileInput) {
    const { patientId, measurement } = input;

    const patient = await patientQueries.checkPatientExists(prisma, patientId);
    if (!patient) {
      throw new NotFoundError('Patient', patientId);
    }

    let measurementType: MeasurementType;
    switch (measurement.type) {
      case 'Weight':
        measurementType = 'Weight';
        break;
      case 'Height':
        measurementType = 'Height';
        break;
      case 'HeadCircumference':
        measurementType = 'HeadCircumference';
        break;
      default:
        throw new ValidationError('Invalid measurement type');
    }

    const ageDays = measurement.ageMonths * 30.44;

    const standard = await growthQueries.findClosestWHOStandard(prisma, {
      gender: patient.gender as Gender,
      measurementType,
      ageDays,
      ageMonths: measurement.ageMonths
    });

    if (!standard) {
      return {
        zScore: null,
        percentile: null,
        classification: 'No standard available',
        standardAgeMonths: measurement.ageMonths
      };
    }

    const zScore = this.calculateLMSZScore(
      measurement.value,
      Number(standard.lValue),
      Number(standard.mValue),
      Number(standard.sValue)
    );

    const percentile = this.zScoreToPercentile(zScore);
    const classification = this.getGrowthInterpretation(zScore);

    return {
      zScore: Number(zScore.toFixed(3)),
      percentile,
      classification,
      standardAgeMonths: standard.ageInMonths || Math.floor((standard.ageDays || 0) / 30.44),
      standardValues: {
        median: standard.mValue,
        sd3neg: standard.sd3neg,
        sd2neg: standard.sd2neg,
        sd1neg: standard.sd1neg,
        sd1pos: standard.sd1pos,
        sd2pos: standard.sd2pos,
        sd3pos: standard.sd3pos
      }
    };
  }

  async getGrowthTrends(input: GrowthTrendsInput) {
    const { patientId, measurementType, timeRange } = input;

    await this.verifyPatientAccess(patientId, input.clinicId);

    const records = await growthQueries.findGrowthRecordsByPatient(prisma, patientId);

    const trends = records
      .filter(record => {
        if (timeRange) {
          if (timeRange.startDate && record.date < timeRange.startDate) return false;
          if (timeRange.endDate && record.date > timeRange.endDate) return false;
        }
        return true;
      })
      .map(record => {
        let value: number | null = null;
        let zScore: number | null = null;

        switch (measurementType) {
          case 'Weight':
            value = record.weight;
            zScore = record.weightForAgeZ?.toNumber() ?? null;
            break;
          case 'Height':
            value = record.height;
            zScore = record.heightForAgeZ?.toNumber() ?? null;
            break;
          case 'HeadCircumference':
            value = record.headCircumference?.toNumber() ?? null;
            zScore = record.hcForAgeZ?.toNumber() ?? null;
            break;
          default:
            break;
        }

        return {
          id: record.id,
          date: record.date,
          ageMonths: record.ageMonths,
          value,
          zScore,
          percentile: zScore ? this.zScoreToPercentile(zScore) : null
        };
      })
      .filter(trend => trend.value !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let velocity = null;
    if (trends.length >= 2) {
      const first = trends[0];
      const last = trends.at(-1);

      if (first?.value && last?.value) {
        const daysDiff = (last.date.getTime() - first.date.getTime()) / (1000 * 60 * 60 * 24);
        const valueDiff = last.value - first.value;

        velocity = {
          perDay: Number((valueDiff / daysDiff).toFixed(4)),
          perMonth: Number(((valueDiff / daysDiff) * 30.44).toFixed(4)),
          perYear: Number(((valueDiff / daysDiff) * 365.25).toFixed(4))
        };
      }
    }

    return {
      trends,
      velocity,
      summary: {
        totalMeasurements: trends.length,
        firstDate: trends[0]?.date || null,
        lastDate: trends.at(-1)?.date || null,
        currentValue: trends.at(-1)?.value || null,
        currentPercentile: trends.at(-1)?.percentile || null
      }
    };
  }

  async calculateVelocity(input: VelocityCalculationInput) {
    const { patientId, clinicId, measurementType, startDate, endDate } = input;

    await this.verifyPatientAccess(patientId, clinicId);

    const records = await growthQueries.findGrowthRecordsByPatient(prisma, patientId);

    const filtered = records
      .filter(r => {
        let value: number | null | undefined;
        switch (measurementType) {
          case 'Weight':
            value = r.weight;
            break;
          case 'Height':
            value = r.height;
            break;
          case 'HeadCircumference':
            value = r.headCircumference?.toNumber();
            break;
          default:
            break;
        }

        return r.date >= startDate && r.date <= endDate && value !== null && value !== undefined;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (filtered.length < 2) return null;

    const first = filtered[0];
    const last = filtered.at(-1);

    if (!(last && first)) return null;

    const msDiff = last.date.getTime() - first.date.getTime();
    if (msDiff <= 0) return null;

    const daysDiff = msDiff / (1000 * 60 * 60 * 24);

    const getVal = (r: typeof first) =>
      measurementType === 'Weight'
        ? r.weight
        : measurementType === 'Height'
          ? r.height
          : r.headCircumference?.toNumber();

    const firstValue = Number(getVal(first) ?? 0);
    const lastValue = Number(getVal(last) ?? 0);
    const valueDiff = lastValue - firstValue;

    return {
      perDay: Number((valueDiff / daysDiff).toFixed(4)),
      perWeek: Number(((valueDiff / daysDiff) * 7).toFixed(4)),
      perMonth: Number(((valueDiff / daysDiff) * 30.44).toFixed(4)),
      perYear: Number(((valueDiff / daysDiff) * 365.25).toFixed(4)),
      totalChange: Number(valueDiff.toFixed(4)),
      daysBetween: Math.round(daysDiff),
      ageChangeMonths: (last.ageMonths ?? 0) - (first.ageMonths ?? 0)
    };
  }

  async compareGrowth(input: GrowthComparisonInput) {
    const { patientId, measurementType, referenceAgeMonths, comparisonType } = input;

    await this.verifyPatientAccess(patientId, input.clinicId);

    const latestRecord = await growthQueries.findLatestGrowthRecordByPatient(prisma, patientId);

    if (!latestRecord) {
      return {
        comparison: 'No data available',
        status: 'unknown',
        details: null
      };
    }

    const currentAgeMonths = latestRecord.ageMonths || 0;

    switch (comparisonType) {
      case 'age': {
        const ageDifference = currentAgeMonths - referenceAgeMonths;
        return {
          comparison: 'Age',
          status: ageDifference >= 0 ? 'ahead' : 'behind',
          details: {
            currentAgeMonths,
            referenceAgeMonths,
            differenceMonths: ageDifference
          }
        };
      }

      case 'percentile': {
        let currentValue: number | null = null;
        switch (measurementType) {
          case 'Weight':
            currentValue = latestRecord.weight;
            break;
          case 'Height':
            currentValue = latestRecord.height;
            break;
          case 'HeadCircumference':
            currentValue = Number(latestRecord.headCircumference);
            break;
          default:
            break;
        }

        if (!(currentValue && latestRecord.gender)) {
          return {
            comparison: 'Percentile',
            status: 'no_data',
            details: null
          };
        }

        const percentileResult = await this.calculatePercentile({
          patientId,
          date: new Date(),
          measurement: {
            type: measurementType,
            value: currentValue,
            ageMonths: currentAgeMonths
          }
        });

        return {
          comparison: 'Percentile',
          status: percentileResult.classification?.toLowerCase().replace(/ /g, '_') || 'unknown',
          details: {
            currentPercentile: percentileResult.percentile,
            zScore: percentileResult.zScore,
            classification: percentileResult.classification
          }
        };
      }

      case 'velocity': {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const velocity = await this.calculateVelocity({
          patientId,
          measurementType,
          clinicId: input.clinicId,
          startDate: threeMonthsAgo,
          endDate: new Date()
        });

        if (!velocity) {
          return {
            comparison: 'Velocity',
            status: 'insufficient_data',
            details: null
          };
        }

        let status = 'normal';
        if (measurementType === 'Weight') {
          if (velocity.perMonth < 0.1) status = 'slow';
          else if (velocity.perMonth > 0.5) status = 'fast';
        } else if (measurementType === 'Height') {
          if (velocity.perMonth < 0.3) status = 'slow';
          else if (velocity.perMonth > 1.0) status = 'fast';
        }

        return {
          comparison: 'Velocity',
          status,
          details: {
            perMonth: velocity.perMonth,
            perYear: velocity.perYear,
            totalChange: velocity.totalChange,
            daysBetween: velocity.daysBetween
          }
        };
      }

      default:
        return {
          comparison: 'Unknown',
          status: 'unknown',
          details: null
        };
    }
  }

  async calculateZScores(ageDays: number, weight: number, gender: 'MALE' | 'FEMALE') {
    const growthDataMap = await getCachedWHOStandardsMap();

    // Map WHOStandardRow to LMSDataPoint to satisfy calculateZScore type requirements
    const mappedMap = new Map<string, LMSDataPoint[]>();
    for (const [key, rows] of growthDataMap) {
      mappedMap.set(
        key,
        rows.map(r => ({
          ageDays: r.ageDays,
          lValue: r.lValue ?? 0,
          mValue: r.mValue ?? 0,
          sValue: r.sValue ?? 0,
          gender: r.gender,
          sd3neg: r.sd3neg ?? 0,
          sd2neg: r.sd2neg ?? 0,
          sd1neg: r.sd1neg ?? 0,
          sd0: r.sd0 ?? 0,
          sd1pos: r.sd1pos ?? 0,
          sd2pos: r.sd2pos ?? 0,
          sd3pos: r.sd3pos ?? 0,
          sd4neg: r.sd4neg ?? 0,
          sd4pos: r.sd4pos ?? 0,
          ageMonths: r.ageInMonths ?? 0
        })) as LMSDataPoint[]
      );
    }

    const result = calculateZScore(mappedMap, gender, ageDays, weight);

    return {
      zScore: result.zScore,
      percentile: result.percentile,
      classification: result.whoClassification,
      ageDays,
      ageMonths: Math.floor(ageDays / 30.44),
      weight,
      gender,
      expectedWeight: {
        median: result.referenceValues?.median,
        range: {
          min: result.referenceValues?.sd2neg,
          max: result.referenceValues?.sd2pos
        }
      }
    };
  }

  async calculateMultipleZScores(
    measurements: Array<{
      ageDays: number;
      weight: number;
      gender: 'MALE' | 'FEMALE';
    }>
  ) {
    const results = await Promise.all(measurements.map(m => this.calculateZScores(m.ageDays, m.weight, m.gender)));

    const validResults = results.filter(r => r.zScore !== null);

    return {
      results,
      statistics: {
        total: results.length,
        valid: validResults.length,
        averageZScore:
          validResults.length > 0
            ? Number((validResults.reduce((sum, r) => sum + (r.zScore || 0), 0) / validResults.length).toFixed(3))
            : null,
        averagePercentile:
          validResults.length > 0
            ? Number((validResults.reduce((sum, r) => sum + (r.percentile || 0), 0) / validResults.length).toFixed(1))
            : null,
        classifications: validResults.reduce(
          (acc, r) => {
            acc[r.classification] = (acc[r.classification] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        )
      }
    };
  }

  async getGrowthProjection(patientId: string, clinicId: string, measurementType: string, projectionMonths = 12) {
    await this.verifyPatientAccess(patientId, clinicId);

    const trends = await this.getGrowthTrends({
      patientId,
      clinicId,
      measurementType: measurementType as 'Weight' | 'Height' | 'HeadCircumference',
      timeRange: {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      }
    });

    if (trends.trends.length < 2) {
      return {
        projections: [],
        confidence: 'low',
        message: 'Insufficient data for projection'
      };
    }

    const recent = trends.trends.slice(0, 3);
    const averageGrowth =
      recent.reduce((acc, curr, idx, arr) => {
        if (idx === 0) return 0;
        const currValue = curr.value ?? 0;
        const prevValue = arr[idx - 1]?.value ?? 0;
        const currAge = curr.ageMonths ?? 0;
        const prevAge = arr[idx - 1]?.ageMonths ?? 0;
        const ageDiff = currAge - prevAge;

        if (ageDiff === 0) return acc;
        return acc + (currValue - prevValue) / ageDiff;
      }, 0) / Math.max(recent.length - 1, 1);

    const lastMeasurement = recent[0];
    const projections = [];

    for (let i = 1; i <= projectionMonths; i += 3) {
      const projectedAgeMonths = (lastMeasurement?.ageMonths || 0) + i;
      const projectedValue = (lastMeasurement?.value || 0) + averageGrowth * i;

      projections.push({
        ageMonths: projectedAgeMonths,
        projectedValue,
        confidence: Math.max(0.7 - i * 0.05, 0.3)
      });
    }

    return {
      projections,
      confidence: averageGrowth > 0 ? 'moderate' : 'low',
      currentAgeMonths: lastMeasurement?.ageMonths || 0,
      currentValue: lastMeasurement?.value || 0,
      averageMonthlyGrowth: averageGrowth
    };
  }

  // ==================== CHART DATA METHODS ====================

  async getZScoreChartData(
    gender: 'MALE' | 'FEMALE',
    measurementType: 'Weight' | 'Height' | 'HeadCircumference' = 'Weight'
  ): Promise<ZScoreChartData> {
    const whoRecords = await growthQueries.findWHOStandards(prisma, {
      gender,
      measurementType
    });

    if (!whoRecords.length) {
      throw new NotFoundError(`No WHO growth data found for ${gender} ${measurementType}`);
    }

    const points: LMSDataPoint[] = whoRecords.map(record => ({
      ageDays: record.ageDays,
      ageMonths: record.ageInMonths ?? 0,
      gender: record.gender,
      lValue: record.lValue ?? 0,
      mValue: record.mValue ?? 0,
      sValue: record.sValue ?? 0,
      sd0: record.sd0 ?? 0,
      sd4neg: record.sd4neg ?? 0,
      sd3neg: record.sd3neg ?? 0,
      sd2neg: record.sd2neg ?? 0,
      sd1neg: record.sd1neg ?? 0,
      sd1pos: record.sd1pos ?? 0,
      sd2pos: record.sd2pos ?? 0,
      sd3pos: record.sd3pos ?? 0,
      sd4pos: record.sd4pos ?? 0
    }));

    const ageRange = {
      minAgeDays: Math.min(...points.map(p => p.ageDays)),
      maxAgeDays: Math.max(...points.map(p => p.ageDays)),
      minAgeMonths: Math.min(...points.map(p => p.ageMonths ?? 0)),
      maxAgeMonths: Math.max(...points.map(p => p.ageMonths ?? 0))
    };

    return {
      gender,
      measurementType,
      points,
      ageRange,
      metadata: {
        totalPoints: points.length,
        dataSource: 'WHO',
        lastUpdated: new Date()
      }
    };
  }

  async getPatientZScoreChart(
    patientId: string,
    clinicId: string,
    measurementType: 'Weight' | 'Height' | 'HeadCircumference' = 'Weight'
  ) {
    await this.verifyPatientAccess(patientId, clinicId);

    const patient = await patientQueries.checkPatientExists(prisma, patientId);
    if (!patient) {
      throw new NotFoundError('Patient', patientId);
    }

    const [chartData, measurements] = await Promise.all([
      this.getZScoreChartData(patient.gender as 'MALE' | 'FEMALE', measurementType),
      growthQueries.findMeasurementsByPatient(prisma, patientId)
    ]);

    const patientData: PatientZScoreData[] = measurements.map(m => {
      let zScore: number | null = 0;
      if (measurementType === 'Weight') zScore = m.weightForAgeZ?.toNumber() ?? null;
      else if (measurementType === 'Height') zScore = m.heightForAgeZ?.toNumber() ?? 0;
      else if (measurementType === 'HeadCircumference') zScore = m.hcForAgeZ?.toNumber() ?? 0;

      return {
        ageDays: m.ageDays ?? 0,
        ageMonths: Math.floor((m.ageDays ?? 0) / 30.44),
        weight: m.weight,
        height: m.height,
        zScore,
        percentile: zScore !== null ? this.zScoreToPercentile(zScore) : null,
        classification: m.classification ?? 'Unknown',
        date: m.date
      };
    });

    const combined = chartData.points.map(chartPoint => {
      const patientPoint = patientData.find(p => Math.abs(p.ageDays - chartPoint.ageDays) < 15);

      return {
        ageDays: chartPoint.ageDays,
        ageMonths: chartPoint.ageMonths,
        patient: patientPoint,
        chart: chartPoint
      };
    });

    return {
      chartData,
      patientData,
      combined
    };
  }

  async getZScoreAreas(
    gender: 'MALE' | 'FEMALE',
    measurementType: 'Weight' | 'Height' | 'HeadCircumference' = 'Weight'
  ) {
    const chartData = await this.getZScoreChartData(gender, measurementType);

    const sdAreaDefinitions = [
      { sdLevel: -3, name: 'Severe Underweight', color: '#ff4444' },
      { sdLevel: -2, name: 'Moderate Underweight', color: '#ff8800' },
      { sdLevel: -1, name: 'Mild Underweight', color: '#ffbb33' },
      { sdLevel: 0, name: 'Normal', color: '#00C851' },
      { sdLevel: 1, name: 'Mild Overweight', color: '#ffbb33' },
      { sdLevel: 2, name: 'Moderate Overweight', color: '#ff8800' },
      { sdLevel: 3, name: 'Severe Overweight', color: '#ff4444' }
    ];

    const sdAreas = sdAreaDefinitions.map(def => {
      const data = chartData.points.map(point => {
        let lower: number;
        let upper: number;

        switch (def.sdLevel) {
          case -3:
            lower = point.sd4neg || point.sd3neg;
            upper = point.sd3neg;
            break;
          case -2:
            lower = point.sd3neg;
            upper = point.sd2neg;
            break;
          case -1:
            lower = point.sd2neg;
            upper = point.sd1neg;
            break;
          case 0:
            lower = point.sd1neg;
            upper = point.sd1pos;
            break;
          case 1:
            lower = point.sd1pos;
            upper = point.sd2pos;
            break;
          case 2:
            lower = point.sd2pos;
            upper = point.sd3pos;
            break;
          case 3:
            lower = point.sd3pos;
            upper = point.sd4pos || point.sd3pos;
            break;
          default:
            lower = point.sd0;
            upper = point.sd0;
        }

        return {
          ageDays: point.ageDays,
          ageMonths: point.ageMonths,
          lower,
          upper
        };
      });

      return {
        sdLevel: def.sdLevel,
        name: def.name,
        color: def.color,
        data
      };
    });

    const median = chartData.points.map(point => ({
      ageDays: point.ageDays,
      ageMonths: point.ageMonths,
      value: point.sd0
    }));

    return { sdAreas, median };
  }

  // ==================== MUTATION METHODS ====================

  async createGrowthRecord(input: CreateGrowthRecordInput) {
    // Verify clinic access
    // await validateClinicAccess(input.clinicId, userId); // clinicId not in input

    // Verify patient exists and belongs to clinic
    const patient = await patientQueries.checkPatientExists(prisma, input.patientId);
    if (!patient) {
      throw new NotFoundError('Patient', input.patientId);
    }

    // Calculate age
    const ageDays = getAgeInDays(patient.dateOfBirth, input.date);
    if (ageDays < 0) {
      throw new ValidationError('Measurement date cannot be before birth date');
    }

    const ageMonths = differenceInMonths(input.date, patient.dateOfBirth);

    // Calculate Z-scores
    const growthDataMap = await getCachedWHOStandardsMap();
    const gender = patient.gender as 'MALE' | 'FEMALE';

    // Map WHOStandardRow to LMSDataPoint to satisfy calculateZScore type requirements
    const mappedMap = new Map<string, LMSDataPoint[]>();
    for (const [key, rows] of growthDataMap) {
      mappedMap.set(
        key,
        rows.map(r => ({
          ageDays: r.ageDays,
          lValue: r.lValue ?? 0,
          mValue: r.mValue ?? 0,
          sValue: r.sValue ?? 0,
          gender: r.gender,
          sd3neg: r.sd3neg ?? 0,
          sd2neg: r.sd2neg ?? 0,
          sd1neg: r.sd1neg ?? 0,
          sd0: r.sd0 ?? 0,
          sd1pos: r.sd1pos ?? 0,
          sd2pos: r.sd2pos ?? 0,
          sd3pos: r.sd3pos ?? 0,
          sd4neg: r.sd4neg ?? 0,
          sd4pos: r.sd4pos ?? 0,
          ageMonths: r.ageInMonths ?? 0
        })) as LMSDataPoint[]
      );
    }

    const weightZScore = input.weight ? calculateZScore(mappedMap, gender, ageDays, input.weight) : null;

    const heightZScore = input.height ? calculateZScore(mappedMap, gender, ageDays, input.height) : null;

    // Calculate BMI
    let bmi = null;
    if (input.weight && input.height && input.height > 0) {
      bmi = input.weight / (input.height / 100) ** 2;
    }

    // Create growth record
    const growthRecord = await growthQueries.createGrowthRecord(prisma, {
      date: input.date,
      recordedAt: new Date(),
      weight: input.weight ?? 0,
      height: input.height ?? 0,
      bmi,
      ageDays,
      ageMonths,
      gender: patient.gender as Gender,
      weightForAgeZ: weightZScore?.zScore ?? null,
      heightForAgeZ: heightZScore?.zScore ?? null,
      patient: {
        connect: { id: input.patientId }
      },
      clinic: {
        connect: { id: input.clinicId }
      },
      medical: {
        connect: { id: input.medicalId }
      },
      notes: input.notes,
      classification: weightZScore?.whoClassification ?? null
    });

    // Cache invalidation
    CACHE_KEYS.PATIENT_VISITS(input.patientId);
    CACHE_KEYS.PATIENT_MEDICAL_RECORDS(input.patientId);
    CACHE_KEYS.ADMIN_DASHBOARD(patient.clinicId);

    return growthRecord;
  }

  async updateGrowthRecord(id: string, input: UpdateGrowthRecordInput, userId: string) {
    const existing = await growthQueries.findGrowthRecordById(prisma, id);
    if (!existing) {
      throw new NotFoundError('Growth record', id);
    }

    await validateClinicAccess(prisma, existing.patient.clinicId, userId);

    const updated = await growthQueries.updateGrowthRecord(prisma, id, {
      ...input,
      notes: input.notes ?? undefined,
      headCircumference: input.headCircumference ?? undefined
    });

    // Cache invalidation
    // cacheHelpers.growth.invalidateGrowthRecord(id, existing.patientId, existing.patient.clinicId);
    CACHE_KEYS.ADMIN_DASHBOARD(existing.patient.clinicId);

    return updated;
  }

  async deleteGrowthRecord(id: string, userId: string) {
    const existing = await growthQueries.findGrowthRecordById(prisma, id);
    if (!existing) {
      throw new NotFoundError('Growth record', id);
    }

    await validateClinicAccess(prisma, existing.patient.clinicId, userId);

    await growthQueries.deleteGrowthRecord(prisma, id);

    // Cache invalidation
    // cacheHelpers.growth.invalidateGrowthRecord(id, existing.patientId, existing.patient.clinicId);
    CACHE_KEYS.PATIENT(existing.patientId);
  }

  async invalidatePatientGrowthCache(patientId: string) {
    CACHE_KEYS.PATIENT_MEDICAL_RECORDS(patientId);
    // cacheHelpers.growth.invalidatePatientGrowth(patientId, clinicId);
    CACHE_KEYS.PATIENT(patientId);
  }

  // ==================== HELPER METHODS ====================

  private async verifyPatientAccess(patientId: string, clinicId: string) {
    const patient = await patientQueries.checkPatientExists(prisma, patientId);
    if (!patient) {
      throw new NotFoundError('Patient', patientId);
    }
    if (patient.clinicId !== clinicId) {
      throw new AppError('Patient does not belong to this clinic', { code: 'FORBIDDEN', statusCode: 403 });
    }
    return patient;
  }

  private calculateLMSZScore(value: number, L: number, M: number, S: number): number {
    if (L !== 0) {
      return ((value / M) ** L - 1) / (L * S);
    }
    return Math.log(value / M) / S;
  }

  private zScoreToPercentile(zScore: number): number {
    const Z = Math.abs(zScore);
    const t = 1 / (1 + 0.231_641_9 * Z);
    const d = 0.398_942_3 * Math.exp((-Z * Z) / 2);
    let p = d * t * (0.319_381_5 + t * (-0.356_563_8 + t * (1.781_478 + t * (-1.821_256 + t * 1.330_274))));

    if (zScore > 0) {
      p = 1 - p;
    }

    return Math.round(p * 100 * 10) / 10;
  }

  private getGrowthInterpretation(zScore: number): string {
    if (zScore < -3) return 'Severely underweight';
    if (zScore < -2) return 'Underweight';
    if (zScore < -1) return 'Risk of underweight';
    if (zScore <= 1) return 'Normal';
    if (zScore <= 2) return 'Risk of overweight';
    if (zScore <= 3) return 'Overweight';
    return 'Severely overweight';
  }

  private calculateAverage(
    measurements: Array<{ weight: number | null; height?: number | null }>,
    field: 'weight' | 'height'
  ): number | null {
    const values = measurements.map(m => m[field]).filter((val): val is number => val !== null && val !== undefined);

    if (values.length === 0) return null;

    const sum = values.reduce((acc, val) => acc + val, 0);
    return Number((sum / values.length).toFixed(2));
  }
}

export const growthService = new GrowthService();
// helper cache used by several service methods
type WHOStandardRow = Awaited<ReturnType<typeof growthQueries.findWHOStandards>>[0];
type WHOStandardsMap = Map<string, WHOStandardRow[]>;

let whoStandardsCache: WHOStandardsMap | null = null;
let whoStandardsPromise: Promise<WHOStandardsMap> | null = null;

/**
 * Load WHO growth standards once and keep them in memory.  The shape
 * of the map is the same as what `GrowthService.getWHOStandardsMap`
 * returns – keys are `${gender}_${measurementType}` strings and values
 * are the arrays returned by the repository call.
 *
 * Calling code (eg. `GrowthService.calculateZScores`) can rely on this
 * being cheap after the first invocation.  A simple in‑flight promise
 * guard prevents multiple parallel queries.
 */
async function getCachedWHOStandardsMap(): Promise<WHOStandardsMap> {
  if (whoStandardsCache) {
    return whoStandardsCache;
  }

  if (whoStandardsPromise) {
    return whoStandardsPromise;
  }

  whoStandardsPromise = (async () => {
    // reuse the service method so we don’t duplicate the query logic
    const map = await growthService.getWHOStandardsMap();
    whoStandardsCache = map as WHOStandardsMap;
    whoStandardsPromise = null;
    return whoStandardsCache;
  })();

  return whoStandardsPromise;
}
