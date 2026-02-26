/**
 * ⚪ VACCINATION MODULE - SCHEMA LAYER
 *
 * RESPONSIBILITIES:
 * - Zod validation schemas
 * - Type inference
 * - Constants and enums
 * - NO business logic
 */

import { z } from 'zod';

import { clinicIdSchema, dateSchema, idSchema, patientIdSchema, staffIdSchema } from './helpers/enums';

// ==================== BASE SCHEMAS ====================

// ==================== ENUM SCHEMAS ====================

export const immunizationStatusSchema = z.enum(['COMPLETED', 'PENDING', 'DELAYED', 'EXEMPTED']);

export const vaccineRouteSchema = z.enum([
  'IM', // Intramuscular
  'SC', // Subcutaneous
  'ID', // Intradermal
  'PO', // Oral
  'IN' // Intranasal
]);

// ==================== VACCINE SCHEDULE SCHEMAS ====================

export const VaccineScheduleSchema = z.object({
  id: idSchema.optional(),
  vaccineName: z.string().min(1, 'Vaccine name is required'),
  recommendedAge: z.string().min(1, 'Recommended age is required'),
  dosesRequired: z.number().int().min(1, 'Doses required must be at least 1'),
  minimumInterval: z.number().int().min(0, 'Minimum interval cannot be negative').optional(),
  isMandatory: z.boolean().default(true),
  description: z.string().optional(),
  ageInDaysMin: z.number().int().min(0).optional(),
  ageInDaysMax: z.number().int().min(0).optional(),
  route: vaccineRouteSchema.default('IM'),
  manufacturer: z.string().optional(),
  lotNumberFormat: z.string().optional()
});

// ==================== IMMUNIZATION RECORD SCHEMAS ====================

export const ImmunizationCreateSchema = z.object({
  patientId: patientIdSchema,
  clinicId: clinicIdSchema.optional(), // Will be derived from patient
  vaccine: z.string().min(1, 'Vaccine name is required'),
  date: dateSchema,
  dose: z.string().optional(),
  lotNumber: z.string().optional(),
  administeredByStaffId: staffIdSchema,
  administeredByDoctorId: idSchema.optional(),
  medicalRecordId: idSchema.optional(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  status: immunizationStatusSchema.default('COMPLETED'),
  route: vaccineRouteSchema.optional(),
  site: z.string().optional(), // e.g., "Left deltoid", "Right thigh"
  expirationDate: dateSchema.optional(),
  manufacturer: z.string().optional(),
  nextDueDate: dateSchema.optional()
});

export const ImmunizationUpdateSchema = z.object({
  id: idSchema,
  date: dateSchema.optional(),
  dose: z.string().optional(),
  lotNumber: z.string().optional(),
  administeredByStaffId: staffIdSchema,
  administeredByDoctorId: idSchema.optional(),
  notes: z.string().max(1000).optional(),
  status: immunizationStatusSchema.optional(),
  route: vaccineRouteSchema.optional(),
  site: z.string().optional(),
  expirationDate: dateSchema.optional(),
  manufacturer: z.string().optional(),
  nextDueDate: dateSchema.optional()
});

export const ImmunizationRecordSchema = z.object({
  id: idSchema,
  patientId: patientIdSchema,
  vaccine: z.string(),
  date: dateSchema,
  dose: z.string().nullable(),
  lotNumber: z.string().nullable(),
  status: immunizationStatusSchema,
  administeredByStaffId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema
});

// ==================== VACCINATION SCHEDULING SCHEMAS ====================

export const ScheduleVaccinationSchema = z.object({
  patientId: patientIdSchema,
  clinicId: clinicIdSchema.optional(),
  vaccineName: z.string().min(1, 'Vaccine name is required'),
  dueDate: dateSchema,
  doseNumber: z.number().int().min(1).optional(),
  notes: z.string().optional(),
  scheduleId: idSchema.optional() // Reference to vaccine schedule
});

export const DueVaccinationSchema = z.object({
  patientId: patientIdSchema,
  patientName: z.string(),
  patientAgeMonths: z.number(),
  vaccineName: z.string(),
  dueDate: dateSchema,
  doseNumber: z.number().optional(),
  scheduleId: z.string().optional(),
  daysOverdue: z.number().int(),
  isOverdue: z.boolean()
});

// ==================== FILTER SCHEMAS ====================

export const VaccinationByIdSchema = z.object({
  id: idSchema
});

export const VaccinationByPatientSchema = z.object({
  patientId: patientIdSchema,
  clinicId: clinicIdSchema,
  includeCompleted: z.boolean().default(true),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
});

export const VaccinationByClinicSchema = z.object({
  clinicId: clinicIdSchema,
  status: immunizationStatusSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
});

export const UpcomingVaccinationsSchema = z.object({
  clinicId: clinicIdSchema,
  isOverDue: z.boolean().default(false),
  daysAhead: z.number().int().min(1).max(365).default(30),
  limit: z.number().min(1).max(100).default(20)
});

export const OverdueVaccinationsSchema = z.object({
  clinicId: clinicIdSchema,
  daysOverdue: z.number().int().min(0).default(0),
  limit: z.number().min(1).max(100).default(20)
});

export const VaccineScheduleFilterSchema = z.object({
  ageMonths: z.number().int().min(0).max(240).optional(),
  isMandatory: z.boolean().optional(),
  vaccineName: z.string().optional(),
  limit: z.number().min(1).max(100).default(50)
});

// ==================== COUNT SCHEMAS ====================

export const UpcomingCountSchema = z.object({
  clinicId: clinicIdSchema,
  daysAhead: z.number().int().min(1).max(365).default(30)
});

export const OverdueCountSchema = z.object({
  clinicId: clinicIdSchema,
  daysOverdue: z.number().int().min(0).default(0)
});

export const CompletionRateSchema = z.object({
  clinicId: clinicIdSchema,
  startDate: dateSchema,
  endDate: dateSchema
});
export const DeleteImmunizationSchema = z.object({
  id: idSchema,
  clinicId: clinicIdSchema,
  patientId: patientIdSchema
});
export type DeleteImmunizationInput = z.infer<typeof DeleteImmunizationSchema>;
export const calculateDueVaccinesSchema = z.object({
  // The unique identifier (usually patientId)
  patientId: idSchema,
  clinicId: clinicIdSchema,
  // Current age in days for window calculations
  patientAgeDays: z.number().min(0),

  // The history of what the patient has already received
  completedVaccines: z.array(
    z.object({
      vaccineName: z.string(),
      // We use number here for the logic,
      // service layer will map this to "Dose X" string if needed
      doseNumber: z.number().int().positive(),
      administrationDate: z.coerce.date() // Coerce handles strings from JSON/Forms
    })
  )
});

// Export type for use in Service and Action layers
export type CalculateDueVaccinesInput = z.infer<typeof calculateDueVaccinesSchema>;
// ==================== TYPE INFERENCES ====================

export type VaccineScheduleInput = z.infer<typeof VaccineScheduleSchema>;
export type ImmunizationCreateInput = z.infer<typeof ImmunizationCreateSchema>;
export type ImmunizationUpdateInput = z.infer<typeof ImmunizationUpdateSchema>;
export type ScheduleVaccinationInput = z.infer<typeof ScheduleVaccinationSchema>;
export type DueVaccination = z.infer<typeof DueVaccinationSchema>;

export type VaccinationByIdInput = z.infer<typeof VaccinationByIdSchema>;
export type VaccinationByPatientInput = z.infer<typeof VaccinationByPatientSchema>;
export type VaccinationByClinicInput = z.infer<typeof VaccinationByClinicSchema>;
export type UpcomingVaccinationsInput = z.infer<typeof UpcomingVaccinationsSchema>;
export type OverdueVaccinationsInput = z.infer<typeof OverdueVaccinationsSchema>;
export type VaccineScheduleFilterInput = z.infer<typeof VaccineScheduleFilterSchema>;

export type UpcomingCountInput = z.infer<typeof UpcomingCountSchema>;
export type OverdueCountInput = z.infer<typeof OverdueCountSchema>;
export type CompletionRateInput = z.infer<typeof CompletionRateSchema>;

// ==================== CONSTANTS ====================

export const VACCINE_STATUS = {
  COMPLETED: 'COMPLETED',
  PENDING: 'PENDING',
  DELAYED: 'DELAYED',
  EXEMPTED: 'EXEMPTED'
} as const;

export const VACCINE_STATUS_LABELS: Record<keyof typeof VACCINE_STATUS, string> = {
  COMPLETED: 'Completed',
  PENDING: 'Pending',
  DELAYED: 'Delayed',
  EXEMPTED: 'Exempted'
} as const;

export const VACCINE_STATUS_COLORS: Record<keyof typeof VACCINE_STATUS, string> = {
  COMPLETED: 'green',
  PENDING: 'yellow',
  DELAYED: 'orange',
  EXEMPTED: 'gray'
} as const;

export const VACCINE_ROUTES = {
  IM: 'Intramuscular',
  SC: 'Subcutaneous',
  ID: 'Intradermal',
  PO: 'Oral',
  IN: 'Intranasal'
} as const;

export const COMMON_VACCINES = [
  'BCG',
  'Hepatitis B',
  'DTaP',
  'Hib',
  'IPV',
  'PCV',
  'Rotavirus',
  'MMR',
  'Varicella',
  'Hepatitis A',
  'Influenza',
  'HPV',
  'Tdap',
  'Meningococcal'
] as const;
