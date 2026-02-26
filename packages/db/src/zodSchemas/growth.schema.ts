import { ChartType, Gender, GrowthStatus, MeasurementType } from '@generated/browser';
import { z } from 'zod';

import { clinicIdSchema, dateSchema, genderSchema, idSchema, patientIdSchema } from './helpers/enums';
export const measurementTypeSchema = z.enum(MeasurementType);
export const whoChartTypeSchema = z.enum(ChartType);

// // ==================== PEDIATRIC VALIDATION HELPERS ====================
// const pediatricAgeSchema = z
//   .object({
//     ageDays: z.number().int().min(0).max(1825), // 0-5 years
//     ageMonths: z.number().int().min(0).max(60), // 0-5 years
//     ageYears: z.number().int().min(0).max(5) // 0-5 years
//   })
//   .refine(
//     data => {
//       // Convert all to days for consistency check
//       const daysFromMonths = (data.ageMonths || 0) * 30.44;
//       const daysFromYears = (data.ageYears || 0) * 365.25;
//       const totalDays = Math.max(data.ageDays || 0, daysFromMonths, daysFromYears);
//       return totalDays <= 1825; // Max 5 years
//     },
//     {
//       message: 'Pediatric age cannot exceed 5 years',
//       path: ['ageYears']
//     }
//   );

const growthStatusSchema = z.enum(GrowthStatus);

// ==================== GROWTH RECORD SCHEMAS ====================
export const GrowthRecordBaseSchema = z
  .object({
    patientId: patientIdSchema,
    clinicId: clinicIdSchema,
    medicalId: idSchema.optional(),
    vitalSignsId: idSchema.optional(),
    encounterId: idSchema.optional(),
    gender: genderSchema,
    date: dateSchema.default(() => new Date()),
    recordedAt: dateSchema.default(() => new Date()),
    // Age information
    ageDays: z.number().int().min(0).max(1825),
    ageMonths: z.number().int().min(0).max(60),
    ageYears: z.number().int().min(0).max(5),
    // Measurements
    weight: z.number().min(0.5).max(200), // kg
    height: z.number().min(20).max(250), // cm
    headCircumference: z.number().min(20).max(60).optional(), // cm (for infants < 2 years)
    bmi: z.number().min(5).max(50).optional(),
    // WHO standards
    weightForAgeZ: z.number().min(-5).max(5).optional(),
    heightForAgeZ: z.number().min(-5).max(5).optional(),
    bmiForAgeZ: z.number().min(-5).max(5).optional(),
    hcForAgeZ: z.number().min(-5).max(5).optional(),
    // Classification
    growthStatus: growthStatusSchema.default('NORMAL'),
    percentile: z.number().min(0).max(100).optional(),
    zScore: z.number().min(-5).max(5).optional(),
    // Additional info
    measurementType: measurementTypeSchema.default('Weight'),
    notes: z.string().max(1000).optional(),
    classification: z.string().max(100).optional()
  })
  .refine(
    data => {
      // Head circumference should only be measured for children under 2 years
      if (data.headCircumference && data.ageMonths && data.ageMonths >= 24) {
        return false;
      }
      return true;
    },
    {
      message: 'Head circumference should only be measured for children under 24 months',
      path: ['headCircumference']
    }
  )
  .refine(
    data => {
      // Validate age consistency
      const daysFromMonths = (data.ageMonths || 0) * 30.44;
      const daysFromYears = (data.ageYears || 0) * 365.25;
      const maxDays = Math.max(data.ageDays || 0, daysFromMonths, daysFromYears);
      return maxDays <= 1825;
    },
    {
      message: 'Pediatric age cannot exceed 5 years',
      path: ['ageYears']
    }
  )
  .refine(
    data => {
      // Calculate BMI if weight and height are provided
      if (data.weight && data.height && !data.bmi) {
        const calculatedBmi = data.weight / (data.height / 100) ** 2;
        return calculatedBmi >= 5 && calculatedBmi <= 50;
      }
      return true;
    },
    {
      message: 'Calculated BMI is outside valid range (5-50)',
      path: ['weight']
    }
  );
export const GrowthRecordCreateSchema = GrowthRecordBaseSchema.extend({
  clinicId: clinicIdSchema.optional() // Required for create
});

export type GrowthRecordCreateInput = z.infer<typeof GrowthRecordCreateSchema>;
export type GrowthRecordUpdateInput = z.infer<typeof GrowthRecordUpdateSchema>;

// ==================== GROWTH ANALYSIS SCHEMAS ====================
export const GrowthPercentileCalculationSchema = z.object({
  patientId: patientIdSchema,
  measurementType: z.enum(['Weight', 'Height', 'HeadCircumference', 'BMI']),
  value: z.number().positive(),
  ageDays: z.number().int().min(0).max(1825),
  gender: genderSchema,
  useWHOStandards: z.boolean().default(true)
});

export const GrowthVelocityCalculationSchema = z
  .object({
    patientId: patientIdSchema,
    measurementType: z.enum(['Weight', 'Height']),
    startDate: dateSchema,
    endDate: dateSchema,
    timeUnit: z.enum(['days', 'weeks', 'months']).default('months')
  })
  .refine(data => data.endDate > data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate']
  });
export const GrowthRecordsByPatientSchema = z.object({
  patientId: patientIdSchema,
  clinicId: clinicIdSchema,
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0)
});
export const GrowthTrendAnalysisSchema = z.object({
  patientId: patientIdSchema,
  measurementType: z.enum(['Weight', 'Height', 'BMI']),
  timeRange: z
    .object({
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional()
    })
    .optional(),
  analysisType: z.enum(['percentile_trend', 'velocity', 'z_score_change']).default('percentile_trend')
});

// ==================== WHO STANDARDS SCHEMAS ====================
export const WHOStandardsQuerySchema = z.object({
  gender: genderSchema,
  measurementType: z.enum(['WFA', 'HFA', 'HcFA', 'BFA']), // Weight-for-Age, Height-for-Age, etc.
  ageMonths: z.number().int().min(0).max(60),
  includePercentiles: z.boolean().default(true),
  includeZScores: z.boolean().default(true),
  percentileRange: z
    .object({
      min: z.number().min(0).max(50).default(3),
      max: z.number().min(50).max(97).default(97)
    })
    .optional()
});

// ==================== GROWTH ALERT SCHEMAS ====================
export const GrowthAlertSchema = z.object({
  patientId: patientIdSchema,
  alertType: z.enum(['FALLING_PERCENTILES', 'STUNTING', 'WASTING', 'RAPID_WEIGHT_GAIN', 'NO_GAIN', 'OVERWEIGHT_RISK']),
  severity: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']),
  threshold: z.number(),
  currentValue: z.number(),
  previousValue: z.number(),
  measurementType: z.enum(['Weight', 'Height', 'BMI']),
  ageAtMeasurement: z.number().int(),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).optional()
});

// ==================== FILTER SCHEMAS ====================
export const GrowthRecordFilterSchema = z.object({
  patientId: patientIdSchema.optional(),
  clinicId: clinicIdSchema.optional(),
  gender: genderSchema.optional(),
  measurementType: z.enum(['Weight', 'Height', 'HeadCircumference', 'BMI']).optional(),
  growthStatus: growthStatusSchema.optional(),
  dateRange: z
    .object({
      from: dateSchema.optional(),
      to: dateSchema.optional()
    })
    .optional()
    .refine(
      data => {
        if (data?.from && data.to) {
          return data.from <= data.to;
        }
        return true;
      },
      {
        message: 'From date must be before to date',
        path: ['to']
      }
    ),
  ageRange: z
    .object({
      minMonths: z.number().int().min(0).max(60).optional(),
      maxMonths: z.number().int().min(0).max(60).optional()
    })
    .optional()
    .refine(
      data => {
        if (data?.minMonths !== undefined && data.maxMonths !== undefined) {
          return data.minMonths <= data.maxMonths;
        }
        return true;
      },
      {
        message: 'Minimum age must be less than or equal to maximum age',
        path: ['maxMonths']
      }
    ),
  percentileRange: z
    .object({
      min: z.number().min(0).max(100).optional(),
      max: z.number().min(0).max(100).optional()
    })
    .optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['date', 'measurementType', 'percentile', 'zScore']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});
export const GrowthRecordByIdSchema = z.object({
  id: z.string()
});
export const GrowthRecordByPatientSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  clinicId: z.string().optional()
});

// Export types
export type CreateGrowthRecordInput = z.infer<typeof GrowthRecordCreateSchema>;
export type UpdateGrowthRecordInput = z.infer<typeof GrowthRecordUpdateSchema>;
export type GrowthRecordByIdInput = z.infer<typeof GrowthRecordByIdSchema>;
export type GrowthRecordsByPatientInput = z.infer<typeof GrowthRecordByPatientSchema>;

export const growthStandardsSchema = z.object({
  gender: z.enum(Object.values(Gender) as [Gender, ...Gender[]]),
  measurementType: z.enum(Object.values(MeasurementType) as [MeasurementType, ...MeasurementType[]]),
  ageMonthsMin: z.number().min(0).max(240).optional(),
  ageMonthsMax: z.number().min(0).max(240).optional()
}) satisfies z.ZodType<unknown>;

export const growthPercentileSchema = z.object({
  patientId: z.uuid(),
  date: z.date(),
  measurement: z.object({
    type: z.enum(['Weight', 'Height', 'HeadCircumference']),
    value: z.number().min(0).max(500),
    ageMonths: z.number().min(0).max(240)
  })
}) satisfies z.ZodType<unknown>;

export const growthTrendsSchema = z.object({
  patientId: z.uuid(),
  clinicId: z.uuid(),
  measurementType: z.enum(MeasurementType),
  timeRange: z
    .object({
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional()
    })
    .optional()
}) satisfies z.ZodType<unknown>;

export const velocityCalculationSchema = z.object({
  patientId: z.uuid(),
  clinicId: z.uuid(),
  measurementType: z.enum(MeasurementType),
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
}) satisfies z.ZodType<unknown>;

export const growthComparisonSchema = z.object({
  patientId: z.uuid(),
  clinicId: z.uuid(),
  measurementType: z.enum(MeasurementType),
  referenceAgeMonths: z.number().min(0).max(240),
  comparisonType: z.enum(['age', 'percentile', 'velocity']).default('age')
}) satisfies z.ZodType<unknown>;

export type GrowthStandardsInput = z.infer<typeof growthStandardsSchema>;
export type GrowthPercentileInput = z.infer<typeof growthPercentileSchema>;
export type GrowthTrendsInput = z.infer<typeof growthTrendsSchema>;
export type VelocityCalculationInput = z.infer<typeof velocityCalculationSchema>;
export type GrowthComparisonInput = z.infer<typeof growthComparisonSchema>;

// ==================== BASE SCHEMAS ====================

// ==================== MEASUREMENT SCHEMAS ====================

export const weightSchema = z
  .number()
  .min(0.1, 'Weight must be at least 0.1 kg')
  .max(200, 'Weight must be at most 200 kg');

export const heightSchema = z
  .number()
  .min(10, 'Height must be at least 10 cm')
  .max(250, 'Height must be at most 250 cm')
  .optional();

export const headCircumferenceSchema = z
  .number()
  .min(20, 'Head circumference must be at least 20 cm')
  .max(60, 'Head circumference must be at most 60 cm')
  .optional();

export const bmiSchema = z.number().min(5, 'BMI must be at least 5').max(50, 'BMI must be at most 50').optional();

export const ageDaysSchema = z
  .number()
  .min(0, 'Age cannot be negative')
  .max(1825, 'Age cannot exceed 5 years (1825 days)');

export const ageMonthsSchema = z
  .number()
  .min(0, 'Age cannot be negative')
  .max(60, 'Age cannot exceed 5 years (60 months)');

export const zScoreSchema = z
  .number()
  .min(-5, 'Z-score must be between -5 and 5')
  .max(5, 'Z-score must be between -5 and 5')
  .optional();

export const percentileSchema = z
  .number()
  .min(0, 'Percentile must be between 0 and 100')
  .max(100, 'Percentile must be between 0 and 100')
  .optional();

// ==================== INPUT SCHEMAS ====================

export const GrowthRecordUpdateSchema = z
  .object({
    id: idSchema,
    weight: weightSchema.optional(),
    height: heightSchema,
    headCircumference: headCircumferenceSchema,
    bmi: bmiSchema,
    notes: z.string().max(1000).optional(),
    classification: z.string().optional()
  })
  .partial();

export const DeleteGrowthRecordSchema = z.object({
  id: idSchema,
  patientId: patientIdSchema
});

// ==================== CACHE INVALIDATION SCHEMAS ====================

export const InvalidateGrowthCacheSchema = z.object({
  patientId: patientIdSchema,
  clinicId: clinicIdSchema
});

// ==================== WHO STANDARDS SCHEMAS ====================

export const GrowthStandardsSchema = z.object({
  gender: genderSchema,
  measurementType: z.enum(MeasurementType),
  chartType: measurementTypeSchema,
  ageMonthsMin: ageMonthsSchema.optional(),
  ageMonthsMax: ageMonthsSchema.optional()
});

// ==================== PERCENTILE CALCULATION SCHEMAS ====================

export const MeasurementValueSchema = z.object({
  type: measurementTypeSchema,
  value: z.number().positive(),
  ageMonths: ageMonthsSchema
});

export const GrowthPercentileSchema = z.object({
  patientId: patientIdSchema,
  date: dateSchema.default(() => new Date()),
  measurement: MeasurementValueSchema
});

// ==================== TRENDS SCHEMAS ====================

export const GrowthTrendsSchema = z.object({
  patientId: patientIdSchema,
  clinicId: clinicIdSchema,
  measurementType: measurementTypeSchema,
  timeRange: z
    .object({
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional()
    })
    .optional()
});

// ==================== VELOCITY SCHEMAS ====================

export const VelocityCalculationSchema = z
  .object({
    patientId: patientIdSchema,
    clinicId: clinicIdSchema,
    measurementType: measurementTypeSchema,
    startDate: dateSchema,
    endDate: dateSchema
  })
  .refine(data => data.endDate >= data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate']
  });

// ==================== COMPARISON SCHEMAS ====================

export const GrowthComparisonSchema = z.object({
  patientId: patientIdSchema,
  clinicId: clinicIdSchema,
  measurementType: measurementTypeSchema,
  referenceAgeMonths: ageMonthsSchema,
  comparisonType: z.enum(['age', 'percentile', 'velocity'])
});

// ==================== Z-SCORE SCHEMAS ====================

export const ZScoreCalculationSchema = z.object({
  ageDays: ageDaysSchema,
  weight: weightSchema,
  gender: genderSchema
});

export const MultipleZScoreSchema = z.object({
  measurements: z.array(ZScoreCalculationSchema)
});

// ==================== CHART SCHEMAS ====================

export const ZScoreChartSchema = z.object({
  gender: genderSchema,
  measurementType: measurementTypeSchema.default('Weight')
});

export const PatientZScoreChartSchema = z.object({
  patientId: patientIdSchema,
  clinicId: clinicIdSchema,
  measurementType: measurementTypeSchema.default('Weight')
});

// ==================== PROJECTION SCHEMAS ====================

export const GrowthProjectionSchema = z.object({
  patientId: patientIdSchema,
  clinicId: clinicIdSchema,
  measurementType: measurementTypeSchema,
  projectionMonths: z.number().min(1).max(24).default(12)
});

// ==================== TYPE INFERENCES ====================
export type DeleteGrowthRecordInput = z.infer<typeof DeleteGrowthRecordSchema>;
export type InvalidateGrowthCacheInput = z.infer<typeof InvalidateGrowthCacheSchema>;
export type ZScoreCalculationInput = z.infer<typeof ZScoreCalculationSchema>;
export type MultipleZScoreInput = z.infer<typeof MultipleZScoreSchema>;
export type ZScoreChartInput = z.infer<typeof ZScoreChartSchema>;
export type PatientZScoreChartInput = z.infer<typeof PatientZScoreChartSchema>;
export type GrowthProjectionInput = z.infer<typeof GrowthProjectionSchema>;

// ==================== CONSTANTS ====================

export const GROWTH_CLASSIFICATIONS = {
  SEVERE_UNDERWEIGHT: 'Severely underweight',
  UNDERWEIGHT: 'Underweight',
  RISK_UNDERWEIGHT: 'Risk of underweight',
  NORMAL: 'Normal',
  RISK_OVERWEIGHT: 'Risk of overweight',
  OVERWEIGHT: 'Overweight',
  SEVERE_OVERWEIGHT: 'Severely overweight'
} as const;

export const MEASUREMENT_TYPES = {
  WEIGHT: 'weight',
  HEIGHT: 'height',
  HEAD_CIRCUMFERENCE: 'headCircumference',
  BMI: 'bmi'
} as const;

export const WHO_MEASUREMENT_TYPES = {
  WFA: 'WFA',
  HFA: 'HFA',
  HcFA: 'HcFA'
} as const;

export const COMPARISON_TYPES = {
  AGE: 'age',
  PERCENTILE: 'percentile',
  VELOCITY: 'velocity'
} as const;
