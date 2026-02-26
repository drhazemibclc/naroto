import z from 'zod';

import {
  clinicIdSchema,
  dateSchema,
  encounterStatusSchema,
  encounterTypeSchema,
  genderSchema,
  idSchema
} from './helpers/enums';

// ==================== MEDICAL VALIDATION HELPERS ====================
const temperatureSchema = z.number().min(30).max(45);
export const VitalSignsBaseSchema = z
  .object({
    id: z.uuid().optional(),
    patientId: idSchema,
    medicalId: idSchema.optional(),
    encounterId: idSchema.optional(),
    clinicId: clinicIdSchema,
    recordedAt: dateSchema.default(() => new Date()),
    // Temperature (Celsius)
    bodyTemperature: temperatureSchema.optional(),
    // Blood Pressure
    systolic: z.number().min(50).max(250).optional(),
    diastolic: z.number().min(30).max(150).optional(),
    // Cardiovascular
    heartRate: z.number().min(20).max(300).optional(),
    // Respiratory
    respiratoryRate: z.number().min(5).max(100).optional(),
    oxygenSaturation: z.number().min(50).max(100).optional(),
    // Patient context
    gender: genderSchema.optional(),
    ageDays: z.number().int().min(0).max(474_800).optional(),
    ageMonths: z.number().int().min(0).max(1560).optional(),
    // Additional measurements
    height: z.number().min(20).max(300).optional(), // cm
    weight: z.number().min(0.5).max(500).optional(), // kg
    bmi: z.number().min(10).max(80).optional(),
    // Notes
    notes: z.string().max(1000).optional()
  })
  .refine(
    data => {
      // Validate blood pressure relationship
      if (data.systolic && data.diastolic && data.systolic <= data.diastolic) {
        return false;
      }
      return true;
    },
    {
      message: 'Systolic pressure must be greater than diastolic pressure',
      path: ['systolic']
    }
  )
  .refine(
    data => {
      // Age-appropriate vital signs validation
      if (data.ageDays !== undefined) {
        const ageInMonths = Math.floor(data.ageDays / 30.44);

        // Infant heart rate validation
        if (ageInMonths < 12 && data.heartRate && (data.heartRate < 80 || data.heartRate > 200)) {
          return false;
        }

        // Child heart rate validation
        if (ageInMonths >= 12 && ageInMonths < 156 && data.heartRate && (data.heartRate < 60 || data.heartRate > 140)) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Heart rate outside normal range for patient age',
      path: ['heartRate']
    }
  );
// ==================== DIAGNOSIS SCHEMAS ====================
export const DiagnosisBaseSchema = z.object({
  // Foreign Keys
  patientId: z.string().uuid('Invalid Patient ID'),
  doctorId: z.string().uuid('Invalid Doctor ID'),
  medicalId: z.string().uuid('Medical Record ID is required'), // Required & Unique in Model
  clinicId: z.string().uuid().optional().nullable(),
  appointmentId: z.string().uuid().optional().nullable(),

  // Core Fields
  date: z.date().default(() => new Date()),
  symptoms: z.string({ error: 'Symptoms are required' }).min(1, 'Symptoms cannot be empty'),
  diagnosis: z.string({ error: 'Diagnosis is required' }).min(1, 'Diagnosis cannot be empty'),

  // Optional Fields (Strings in Prisma Model)
  treatment: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  prescribedMedications: z.string().optional(),
  followUpPlan: z.string().optional().nullable(),
  type: z.string().optional().nullable(), // Separate from typeOfEncounter

  // Enums from Prisma Model
  status: encounterStatusSchema.default('PENDING'),
  typeOfEncounter: encounterTypeSchema.default('CONSULTATION'),

  // Metadata
  isDeleted: z.boolean().default(false).optional()
});

/**
 * Input for Creating a New Diagnosis
 */
export const CreateDiagnosisSchema = DiagnosisBaseSchema.omit({
  isDeleted: true
});

export type CreateDiagnosisInput = z.infer<typeof CreateDiagnosisSchema>;

export const DiagnosisCreateSchema = DiagnosisBaseSchema.extend({
  clinicId: clinicIdSchema // Required for create
});

export const DiagnosisUpdateSchema = DiagnosisBaseSchema.partial().extend({
  id: idSchema
});

export const DiagnosisFilterSchema = z.object({
  patientId: idSchema.optional(),
  doctorId: idSchema.optional(),
  startDate: z.date(),
  endDate: z.date(),
  clinicId: clinicIdSchema.optional(),
  type: encounterTypeSchema.optional(),
  status: encounterStatusSchema.optional(),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'CRITICAL']).optional(),
  isChronic: z.boolean().optional(),
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
  search: z.string().max(100).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['date', 'patientName', 'diagnosis', 'severity']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});
export const DiagnosisByIdSchema = DiagnosisBaseSchema.extend({
  id: idSchema
});

export const VitalSignsByMedicalRecordSchema = VitalSignsBaseSchema.pick({
  medicalId: true
});

// ==================== VITAL SIGNS SCHEMAS ====================

export const VitalSignsCreateSchema = VitalSignsBaseSchema;
export const VitalSignsByIdSchema = VitalSignsBaseSchema.pick({
  id: true
});
export const VitalSignsByPatientSchema = VitalSignsBaseSchema.extend({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),

  limit: z.number().int().min(1).max(100).optional()
});
export const DiagnosisByMedicalRecordSchema = DiagnosisBaseSchema.pick({
  medicalId: true,
  clinicId: true
});
export const VitalSignsUpdateSchema = VitalSignsBaseSchema.partial().extend({
  id: idSchema
});
export const DiagnosisByAppointmentSchema = DiagnosisBaseSchema.pick({
  appointmentId: true,
  clinicId: true
});
export const VitalSignsFilterSchema = z.object({
  patientId: idSchema.optional(),
  medicalId: idSchema.optional(),
  encounterId: idSchema.optional(),
  clinicId: clinicIdSchema.optional(),
  dateRange: z
    .object({
      from: dateSchema.optional(),
      to: dateSchema.optional()
    })
    .optional(),
  vitalType: z
    .enum(['TEMPERATURE', 'BLOOD_PRESSURE', 'HEART_RATE', 'RESPIRATORY_RATE', 'OXYGEN_SATURATION'])
    .optional(),
  abnormalOnly: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['recordedAt', 'patientName']).default('recordedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ==================== TYPE EXPORTS ====================
export type DiagnosisCreateInput = z.infer<typeof DiagnosisCreateSchema>;
export type DiagnosisUpdateInput = z.infer<typeof DiagnosisUpdateSchema>;
export type DiagnosisFilterInput = z.infer<typeof DiagnosisFilterSchema>;

export type VitalSignsCreateInput = z.infer<typeof VitalSignsCreateSchema>;
export type VitalSignsUpdateInput = z.infer<typeof VitalSignsUpdateSchema>;
export type VitalSignsFilterInput = z.infer<typeof VitalSignsFilterSchema>;
