import { z } from 'zod';

import {
  clinicIdSchema,
  DoseGuidelineRouteEnum,
  dateSchema,
  doctorIdSchema,
  dosageUnitSchema,
  drugRouteSchema,
  idSchema,
  patientIdSchema
} from './helpers/enums';
export const DoseGuidelineBaseSchema = z.object({
  drugId: idSchema,
  route: DoseGuidelineRouteEnum,
  clinicalIndication: z.string().min(1, 'Clinical indication is required').max(500),
  minDosePerKg: z.number().min(0).optional(),
  maxDosePerKg: z.number().min(0).optional(),
  doseUnit: z.string().max(20).optional(),
  frequencyDays: z.string().max(100).optional(),
  gestationalAgeWeeksMin: z.number().min(0).max(45).optional(),
  gestationalAgeWeeksMax: z.number().min(0).max(45).optional(),
  postNatalAgeDaysMin: z.number().min(0).max(3650).optional(),
  postNatalAgeDaysMax: z.number().min(0).max(3650).optional(),
  maxDosePer24h: z.number().min(0).optional(),
  stockConcentrationMgMl: z.number().min(0).optional(),
  finalConcentrationMgMl: z.number().min(0).optional(),
  minInfusionTimeMin: z.number().int().min(0).optional(),
  compatibilityDiluent: z.string().max(100).optional()
});

export const DoseGuidelineCreateSchema = DoseGuidelineBaseSchema;

export const DoseGuidelineUpdateSchema = DoseGuidelineBaseSchema.partial().extend({
  id: idSchema
});

// ==================== DRUG SCHEMAS ====================
export const DrugBaseSchema = z.object({
  name: z
    .string()
    .min(1, 'Drug name is required')
    .max(200, 'Drug name must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\s\-./]+$/, 'Drug name contains invalid characters'),
  genericName: z.string().max(200).optional(),
  brandNames: z.array(z.string().max(200)).optional(),
  manufacturer: z.string().max(200).optional(),
  drugClass: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  indications: z.array(z.string().max(500)).optional(),
  contraindications: z.array(z.string().max(500)).optional(),
  sideEffects: z.array(z.string().max(500)).optional(),
  warnings: z.array(z.string().max(500)).optional(),
  pregnancyCategory: z.enum(['A', 'B', 'C', 'D', 'X', 'N']).optional(),
  isControlled: z.boolean().default(false),
  controlledSchedule: z.enum(['I', 'II', 'III', 'IV', 'V']).optional(),
  requiresPriorAuth: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

export const DrugCreateSchema = DrugBaseSchema;

export const DrugUpdateSchema = DrugBaseSchema.partial().extend({
  id: idSchema
});

export const DrugFilterSchema = z.object({
  search: z.string().max(100).optional(),
  drugClass: z.string().max(100).optional(),
  isControlled: z.boolean().optional(),
  requiresPriorAuth: z.boolean().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});

// Types
export type DoseGuidelineCreateInput = z.infer<typeof DoseGuidelineCreateSchema>;
export type DoseGuidelineUpdateInput = z.infer<typeof DoseGuidelineUpdateSchema>;
export type DrugCreateInput = z.infer<typeof DrugCreateSchema>;
export type DrugUpdateInput = z.infer<typeof DrugUpdateSchema>;
export type DrugFilterInput = z.infer<typeof DrugFilterSchema>;

export const PharmacyRefillSchema = z.object({
  prescriptionId: idSchema,
  requestedDate: dateSchema.default(() => new Date()),
  requestedBy: idSchema.optional(),
  status: z.enum(['PENDING', 'APPROVED', 'DENIED', 'FILLED']).default('PENDING'),
  notes: z.string().max(500).optional()
});

// ==================== PRESCRIPTION VERIFICATION SCHEMAS ====================
export const PrescriptionVerificationSchema = z.object({
  prescriptionId: idSchema,
  verifiedBy: idSchema,
  verifiedDate: dateSchema.default(() => new Date()),
  status: z.enum(['APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION']),
  notes: z.string().max(1000).optional(),
  checkedInteractions: z.boolean().default(false),
  checkedAllergies: z.boolean().default(false),
  checkedDosing: z.boolean().default(false),
  checkedContraindications: z.boolean().default(false),
  clinicalCheckNotes: z.string().max(1000).optional()
});

// ==================== PEDIATRIC-SPECIFIC SCHEMAS ====================
export const PediatricDoseCheckSchema = z.object({
  prescriptionId: idSchema,
  patientId: patientIdSchema,
  weight: z.number().min(0.1).max(200), // Weight in kg
  age: z.number().min(0).max(18), // Age in years
  gestationalAge: z.number().min(20).max(45).optional(), // For neonates
  diagnosis: z.string().max(500),
  checkedGuidelines: z.boolean().default(false),
  dosePerKg: z.number().optional(),
  maxDosePerDay: z.number().optional(),
  isWithinGuidelines: z.boolean(),
  warnings: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional()
});
export type PrescriptionVerificationInput = z.infer<typeof PrescriptionVerificationSchema>;
export type PediatricDoseCheckInput = z.infer<typeof PediatricDoseCheckSchema>;
// ==================== PRESCRIPTION VALIDATION HELPERS ====================
const medicationNameSchema = z
  .string()
  .min(1, 'Medication name is required')
  .max(200, 'Medication name must be less than 200 characters')
  .regex(/^[a-zA-Z0-9\s-]+$/, 'Medication name can only contain letters, numbers, spaces, and hyphens');

const dosageValueSchema = z
  .number()
  .min(0.01, 'Dosage must be greater than 0')
  .max(1000, 'Dosage cannot exceed 1000 units')
  .refine(val => Number.isFinite(val), 'Dosage must be a valid number');

const frequencySchema = z
  .string()
  .min(1, 'Frequency is required')
  .max(100, 'Frequency must be less than 100 characters')
  .regex(
    /^(once|twice|\d+ times?) (daily|weekly|monthly|every \d+ hours?)$/i,
    'Invalid frequency format. Use formats like "once daily", "twice daily", "3 times daily", "every 4 hours"'
  );

const durationSchema = z
  .string()
  .min(1, 'Duration is required')
  .max(50, 'Duration must be less than 50 characters')
  .regex(/^\d+ (days?|weeks?|months?)$/, 'Invalid duration format. Use formats like "7 days", "2 weeks", "3 months"');

// ==================== PRESCRIBED ITEM SCHEMAS ====================
export const PrescribedItemBaseSchema = z
  .object({
    prescriptionId: idSchema,
    drugId: idSchema,
    dosageValue: dosageValueSchema,
    dosageUnit: dosageUnitSchema,
    frequency: frequencySchema,
    duration: durationSchema,
    instructions: z.string().max(1000, 'Instructions must be less than 1000 characters').optional(),
    drugRoute: drugRouteSchema.optional(),
    strength: z.string().max(50).optional(), // e.g., "500mg", "10mg/ml"
    quantity: z.number().min(1).max(1000).optional(), // Total quantity to dispense
    refills: z.number().int().min(0).max(12).optional(), // Number of refills allowed
    prn: z.boolean().default(false), // As needed (pro re nata)
    isActive: z.boolean().default(true)
  })
  .refine(
    data => {
      // Validate dosage based on unit
      if (data.dosageUnit === 'MG' && data.dosageValue > 1000) {
        return false;
      }
      if (data.dosageUnit === 'ML' && data.dosageValue > 100) {
        return false;
      }
      if (data.dosageUnit === 'TABLET' && data.dosageValue > 20) {
        return false;
      }
      return true;
    },
    {
      message: 'Dosage value exceeds maximum for specified unit',
      path: ['dosageValue']
    }
  );

export const PrescribedItemCreateSchema = PrescribedItemBaseSchema;

export const PrescribedItemUpdateSchema = PrescribedItemBaseSchema.partial().extend({
  id: idSchema
});

// ==================== PRESCRIPTION SCHEMAS ====================
export const PrescriptionBaseSchema = z
  .object({
    medicalRecordId: idSchema,
    doctorId: doctorIdSchema,
    patientId: patientIdSchema,
    encounterId: idSchema,
    clinicId: clinicIdSchema,
    medicationName: medicationNameSchema.optional(), // Legacy field for free-text entry
    instructions: z.string().max(2000, 'Instructions must be less than 2000 characters').optional(),
    issuedDate: dateSchema.default(() => new Date()),
    endDate: dateSchema.optional(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).default('ACTIVE'),
    isChronic: z.boolean().default(false),
    requiresPriorAuthorization: z.boolean().default(false),
    priorAuthorizationCode: z.string().max(50).optional(),
    pharmacyNotes: z.string().max(500).optional(),
    prescribedItems: z
      .array(PrescribedItemBaseSchema.omit({ prescriptionId: true }))
      .min(1, 'At least one prescribed item is required')
  })
  .refine(
    data => {
      // Validate end date is after issue date
      if (data.endDate && data.endDate <= data.issuedDate) {
        return false;
      }
      return true;
    },
    {
      message: 'End date must be after issue date',
      path: ['endDate']
    }
  )
  .refine(
    data => {
      // Validate prior authorization requirement
      if (data.requiresPriorAuthorization && !data.priorAuthorizationCode) {
        return false;
      }
      return true;
    },
    {
      message: 'Prior authorization code is required when prior authorization is required',
      path: ['priorAuthorizationCode']
    }
  );

export const PrescriptionCreateSchema = PrescriptionBaseSchema.extend({
  clinicId: clinicIdSchema // Required for create
});

export const PrescriptionUpdateSchema = PrescriptionBaseSchema.partial().extend({
  id: idSchema
});

// ==================== PRESCRIPTION FILTER SCHEMAS ====================
export const PrescriptionFilterSchema = z.object({
  patientId: patientIdSchema,
  doctorId: doctorIdSchema.optional(),
  clinicId: clinicIdSchema.optional(),
  encounterId: idSchema.optional(),
  medicalRecordId: idSchema.optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).optional(),
  isChronic: z.boolean().optional(),
  medicationName: z.string().max(100).optional(),
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
  sortBy: z.enum(['issuedDate', 'patientName', 'medicationName', 'status']).default('issuedDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ==================== DRUG INTERACTION SCHEMAS ====================
export const DrugInteractionSchema = z.object({
  drugId1: idSchema,
  drugId2: idSchema,
  severity: z.enum(['MINOR', 'MODERATE', 'MAJOR', 'CONTRAINDICATED']),
  description: z.string().max(1000),
  recommendation: z.string().max(1000).optional(),
  isActive: z.boolean().default(true)
});

export const DrugInteractionCheckSchema = z.object({
  drugIds: z.array(idSchema).min(2, 'At least two drugs are required for interaction check'),
  patientId: patientIdSchema.optional() // Include for patient-specific interactions
});

// ==================== ALLERGY SCHEMAS ====================
export const MedicationAllergySchema = z.object({
  patientId: patientIdSchema,
  drugId: idSchema.optional(), // For known drugs
  medicationName: medicationNameSchema, // For free-text allergies
  reactionType: z.enum(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLAXIS']),
  reaction: z.string().max(500, 'Reaction description must be less than 500 characters'),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLAXIS']),
  isActive: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
  reportedBy: z.enum(['PATIENT', 'DOCTOR', 'FAMILY', 'OTHER']).default('PATIENT'),
  reportedDate: dateSchema.default(() => new Date())
});

// ==================== PHARMACY SCHEMAS ====================
export const PharmacyDispenseSchema = z.object({
  prescriptionId: idSchema,
  prescribedItemId: idSchema,
  dispensedDate: dateSchema.default(() => new Date()),
  quantityDispensed: z.number().min(0.01).max(1000),
  remainingRefills: z.number().int().min(0).max(12),
  dispensedBy: idSchema, // Pharmacist ID
  pharmacyNotes: z.string().max(500).optional(),
  batchNumber: z.string().max(50).optional(),
  expiryDate: dateSchema.optional()
});

// ==================== TYPE EXPORTS ====================
export type PrescribedItemCreateInput = z.infer<typeof PrescribedItemCreateSchema>;
export type PrescribedItemUpdateInput = z.infer<typeof PrescribedItemUpdateSchema>;
export type PrescriptionCreateInput = z.infer<typeof PrescriptionCreateSchema>;
export type PrescriptionUpdateInput = z.infer<typeof PrescriptionUpdateSchema>;
export type PrescriptionFilterInput = z.infer<typeof PrescriptionFilterSchema>;
export type DrugInteractionInput = z.infer<typeof DrugInteractionSchema>;
export type DrugInteractionCheckInput = z.infer<typeof DrugInteractionCheckSchema>;
export type MedicationAllergyInput = z.infer<typeof MedicationAllergySchema>;
export type PharmacyDispenseInput = z.infer<typeof PharmacyDispenseSchema>;
