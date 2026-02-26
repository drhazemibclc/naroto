// src/services/growth/types.ts
export interface GrowthMeasurement {
  bmi?: number;
  date: Date;
  headCircumference?: number;
  height?: number;
  patientId: string;
  weight?: number;
}

export interface ZScoreResult {
  classification: string;
  interpolated: boolean;
  percentile: number | null;
  recommendation: string;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  zScore: number | null;
}

export interface GrowthAlert {
  date: Date;
  message: string;
  patientId: string;
  severity: 'warning' | 'critical';
  type: 'SEVERE_UNDERWEIGHT' | 'SEVERE_STUNTING' | 'OBESE' | 'RAPID_WEIGHT_LOSS';
  zScore: number;
}

export type GrowthStatus = 'NORMAL' | 'UNDERWEIGHT' | 'STUNTED' | 'WASTED' | 'OVERWEIGHT' | 'OBESE';

export interface LMSDataPoint {
  ageDays: number;
  ageMonths?: number;
  gender: 'MALE' | 'FEMALE';
  lValue: number;
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

export type GrowthDataMap = Map<string, LMSDataPoint[]>;

export interface ZScoreResult {
  exactMatch: boolean;
  interpolated: boolean;
  percentile: number | null;
  referenceValues: {
    median: number;
    sd1neg: number;
    sd1pos: number;
    sd2neg: number;
    sd2pos: number;
    sd3neg: number;
    sd3pos: number;
  };
  whoClassification: string;
  zScore: number | null;
}

export interface GrowthAssessment {
  classification: string;
  interpolated: boolean;
  percentile: number | null;
  recommendation: string;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  zScore: number | null;
}
