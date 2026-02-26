// src/services/growth/calculator.ts
import { prisma } from '../../client';
import type { GrowthAlert, GrowthMeasurement, ZScoreResult } from './types';
import { getCachedGrowthData } from './who-data';

export async function calculateLMSZScore(value: number, l: number, m: number, s: number): Promise<number> {
  if (m <= 0 || s <= 0) {
    throw new Error('Invalid LMS parameters');
  }

  if (l === 0) {
    return Math.log(value / m) / s;
  }
  return ((value / m) ** l - 1) / (l * s);
}
export class GrowthCalculator {
  /**
   * Calculate LMS Z-score
   */
  private calculateLMSZScore(value: number, l: number, m: number, s: number): number {
    if (m <= 0 || s <= 0) {
      throw new Error('Invalid LMS parameters');
    }

    if (l === 0) {
      return Math.log(value / m) / s;
    }
    return ((value / m) ** l - 1) / (l * s);
  }

  /**
   * Convert Z-score to percentile
   */
  private zScoreToPercentile(zScore: number): number {
    if (zScore < -6) return 0.01;
    if (zScore > 6) return 99.99;

    // Approximation of the error function
    const sign = zScore < 0 ? -1 : 1;
    const x = Math.abs(zScore) / Math.sqrt(2);
    const t = 1 / (1 + 0.327_591_1 * x);

    const erf =
      1 -
      ((((1.061_405_429 * t - 1.453_152_027) * t + 1.421_413_741) * t - 0.284_496_736) * t + 0.254_829_592 * t) *
        Math.exp(-x * x);

    const percentile = 0.5 * (1 + sign * erf);
    return Math.max(0.01, Math.min(99.99, percentile * 100));
  }

  /**
   * Classify weight-for-age
   */
  private classifyWFA(zScore: number | null): {
    classification: string;
    severity: 'normal' | 'mild' | 'moderate' | 'severe';
    recommendation: string;
  } {
    if (zScore === null) {
      return {
        classification: 'Unable to assess',
        severity: 'normal',
        recommendation: 'Please verify age and measurement data'
      };
    }

    if (zScore < -3) {
      return {
        classification: 'Severe Underweight',
        severity: 'severe',
        recommendation: 'Urgent medical assessment required. Consider referral to pediatric nutrition specialist.'
      };
    }
    if (zScore < -2) {
      return {
        classification: 'Moderate Underweight',
        severity: 'moderate',
        recommendation: 'Nutritional intervention needed. Monitor growth closely and provide dietary counseling.'
      };
    }
    if (zScore < -1) {
      return {
        classification: 'Mild Underweight',
        severity: 'mild',
        recommendation: 'Monitor growth pattern. Provide nutritional education and follow up in 1 month.'
      };
    }
    if (zScore <= 1) {
      return {
        classification: 'Normal Weight',
        severity: 'normal',
        recommendation: 'Continue current feeding practices. Regular growth monitoring recommended.'
      };
    }
    if (zScore <= 2) {
      return {
        classification: 'Overweight',
        severity: 'mild',
        recommendation: 'Monitor growth pattern. Encourage balanced diet and physical activity.'
      };
    }
    if (zScore <= 3) {
      return {
        classification: 'Obese',
        severity: 'moderate',
        recommendation: 'Nutritional counseling required. Assess dietary habits and physical activity levels.'
      };
    }
    return {
      classification: 'Severely Obese',
      severity: 'severe',
      recommendation: 'Urgent medical assessment. Comprehensive management plan needed.'
    };
  }

  /**
   * Calculate Z-score for a measurement
   */
  async calculateZScore(patientId: string, measurement: GrowthMeasurement): Promise<ZScoreResult> {
    // Get patient details
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { dateOfBirth: true, gender: true }
    });

    if (!patient) {
      throw new Error('Patient not found');
    }

    if (!measurement.weight) {
      return {
        zScore: null,
        percentile: null,
        classification: 'No weight data',
        severity: 'normal',
        recommendation: 'Weight measurement required',
        interpolated: false,
        exactMatch: false,
        whoClassification: 'No weight data',
        referenceValues: {
          median: 0,
          sd1neg: 0,
          sd1pos: 0,
          sd2neg: 0,
          sd2pos: 0,
          sd3neg: 0,
          sd3pos: 0
        }
      };
    }

    // Calculate age in days
    const ageDays = Math.floor((measurement.date.getTime() - patient.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

    // Get WHO reference data
    const growthData = await getCachedGrowthData();
    const reference = growthData.get(patient.gender)?.find((point: { ageDays: number }) => point.ageDays === ageDays);

    if (!reference) {
      return {
        zScore: null,
        percentile: null,
        classification: 'No reference data',
        severity: 'normal',
        recommendation: 'Growth reference data unavailable',
        interpolated: false,
        exactMatch: false,
        whoClassification: 'No reference data',
        referenceValues: {
          median: 0,
          sd1neg: 0,
          sd1pos: 0,
          sd2neg: 0,
          sd2pos: 0,
          sd3neg: 0,
          sd3pos: 0
        }
      };
    }

    try {
      const zScore = this.calculateLMSZScore(measurement.weight, reference.lValue, reference.mValue, reference.sValue);

      const classification = this.classifyWFA(zScore);

      return {
        zScore: Math.round(zScore * 100) / 100,
        percentile: Math.round(this.zScoreToPercentile(zScore) * 100) / 100,
        classification: classification.classification,
        severity: classification.severity,
        recommendation: classification.recommendation,
        interpolated: false,
        exactMatch: true,
        whoClassification: classification.classification,
        referenceValues: {
          median: reference.mValue,
          sd1neg: reference.sd1neg,
          sd1pos: reference.sd1pos,
          sd2neg: reference.sd2neg,
          sd2pos: reference.sd2pos,
          sd3neg: reference.sd3neg,
          sd3pos: reference.sd3pos
        }
      };
    } catch (error) {
      console.error('Error calculating Z-score:', error);
      return {
        zScore: null,
        percentile: null,
        classification: 'Calculation error',
        severity: 'normal',
        recommendation: 'Unable to calculate growth metrics',
        interpolated: false,
        exactMatch: false,
        whoClassification: 'Calculation error',
        referenceValues: {
          median: 0,
          sd1neg: 0,
          sd1pos: 0,
          sd2neg: 0,
          sd2pos: 0,
          sd3neg: 0,
          sd3pos: 0
        }
      };
    }
  }

  /**
   * Check for growth alerts
   */
  async checkAlerts(patientId: string, zScore: number): Promise<GrowthAlert[]> {
    const alerts: GrowthAlert[] = [];

    if (zScore < -3) {
      alerts.push({
        patientId,
        type: 'SEVERE_UNDERWEIGHT',
        severity: 'critical',
        message: 'Severe underweight detected - immediate intervention required',
        zScore,
        date: new Date()
      });
    } else if (zScore > 3) {
      alerts.push({
        patientId,
        type: 'OBESE',
        severity: 'warning',
        message: 'Severe obesity detected - nutritional counseling needed',
        zScore,
        date: new Date()
      });
    }

    // Store alerts in database
    if (alerts.length > 0) {
      await prisma.growthRecord.createMany({
        data: alerts.map(alert => ({
          ...alert,
          patientId
        }))
      });
    }

    return alerts;
  }
}

export const growthCalculator = new GrowthCalculator();
