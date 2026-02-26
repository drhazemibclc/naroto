/**
 * ⚪ VISIT MODULE - SCHEMA LAYER
 *
 * RESPONSIBILITIES:
 * - Zod validation schemas
 * - Type inference
 * - Constants and enums
 * - NO business logic
 */

import { z } from 'zod';

import { clinicIdSchema, dateSchema, doctorIdSchema, idSchema, patientIdSchema, timeSchema } from './helpers/enums';
import { serviceIdSchema } from './service.schema';

// ==================== BASE SCHEMAS ====================

// ==================== ENUM SCHEMAS ====================

export const appointmentStatusSchema = z.enum(['PENDING', 'SCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']);

export const appointmentTypeSchema = z.enum([
  'CONSULTATION',
  'VACCINATION',
  'PROCEDURE',
  'EMERGENCY',
  'CHECKUP',
  'FOLLOW_UP',
  'FEEDING_SESSION',
  'OTHER'
]);

// ==================== VISIT CREATE SCHEMA ====================

export const VisitCreateSchema = z.object({
  patientId: patientIdSchema,
  duration: z.number().min(1, 'Duration must be at least 1 minute').max(480, 'Duration cannot exceed 8 hours'),
  doctorId: doctorIdSchema,
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  serviceId: z.uuid(),
  clinicId: clinicIdSchema.optional(), // Will be derived from patient
  appointmentDate: dateSchema,
  time: timeSchema,
  type: appointmentTypeSchema,
  appointmentPrice: z.number().min(0, 'Price cannot be negative').optional(),
  reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional(),
  note: z.string().max(1000, 'Note cannot exceed 1000 characters').optional(),
  status: appointmentStatusSchema.default('SCHEDULED')
});

// ==================== VISIT UPDATE SCHEMA ====================

export const VisitUpdateSchema = z.object({
  id: idSchema,
  doctorId: doctorIdSchema.optional(),
  serviceId: serviceIdSchema,
  appointmentDate: dateSchema.optional(),
  appointmentPrice: z.number().min(0, 'Price cannot be negative').optional(),

  time: timeSchema,
  duration: z
    .number()
    .min(1, 'Duration must be at least 1 minute')
    .max(480, 'Duration cannot exceed 8 hours')
    .optional(),
  type: appointmentTypeSchema.optional(),
  updatedAt: z.date().optional(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  status: appointmentStatusSchema.optional()
});

// ==================== VISIT FILTER SCHEMAS ====================

export const VisitByIdSchema = z.object({
  id: idSchema
});

export const VisitByPatientSchema = z.object({
  patientId: patientIdSchema,
  clinicId: clinicIdSchema,
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

export const VisitByClinicSchema = z.object({
  clinicId: clinicIdSchema,
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  status: appointmentStatusSchema.optional(),
  doctorId: doctorIdSchema.optional()
});

export const VisitRecentSchema = z.object({
  clinicId: clinicIdSchema,
  limit: z.number().min(1).max(20).default(5)
});

export const VisitTodaySchema = z.object({
  clinicId: clinicIdSchema
});

export const VisitMonthSchema = z.object({
  clinicId: clinicIdSchema
});

// ==================== VISIT COUNT SCHEMAS ====================

export const VisitCountTodaySchema = z.object({
  clinicId: clinicIdSchema
});

export const VisitCountMonthSchema = z.object({
  clinicId: clinicIdSchema
});

// ==================== TYPE INFERENCES ====================

export type VisitCreateInput = z.infer<typeof VisitCreateSchema>;
export type VisitUpdateInput = z.infer<typeof VisitUpdateSchema>;
export type VisitByIdInput = z.infer<typeof VisitByIdSchema>;
export type VisitByPatientInput = z.infer<typeof VisitByPatientSchema>;
export type VisitByClinicInput = z.infer<typeof VisitByClinicSchema>;
export type VisitRecentInput = z.infer<typeof VisitRecentSchema>;
export type VisitTodayInput = z.infer<typeof VisitTodaySchema>;
export type VisitMonthInput = z.infer<typeof VisitMonthSchema>;
export type VisitCountTodayInput = z.infer<typeof VisitCountTodaySchema>;
export type VisitCountMonthInput = z.infer<typeof VisitCountMonthSchema>;

// ==================== CONSTANTS ====================

export const APPOINTMENT_STATUS = {
  PENDING: 'PENDING',
  SCHEDULED: 'SCHEDULED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW'
} as const;

export const APPOINTMENT_TYPE = {
  CONSULTATION: 'CONSULTATION',
  VACCINATION: 'VACCINATION',
  PROCEDURE: 'PROCEDURE',
  EMERGENCY: 'EMERGENCY',
  CHECKUP: 'CHECKUP',
  FOLLOW_UP: 'FOLLOW_UP',
  FEEDING_SESSION: 'FEEDING_SESSION',
  OTHER: 'OTHER'
} as const;

export const APPOINTMENT_TYPE_LABELS: Record<keyof typeof APPOINTMENT_TYPE, string> = {
  CONSULTATION: 'Consultation',
  VACCINATION: 'Vaccination',
  PROCEDURE: 'Procedure',
  EMERGENCY: 'Emergency',
  CHECKUP: 'Check-up',
  FOLLOW_UP: 'Follow-up',
  FEEDING_SESSION: 'Feeding Session',
  OTHER: 'Other'
} as const;

export const APPOINTMENT_STATUS_LABELS: Record<keyof typeof APPOINTMENT_STATUS, string> = {
  PENDING: 'Pending',
  SCHEDULED: 'Scheduled',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No Show'
} as const;

export const APPOINTMENT_STATUS_COLORS: Record<keyof typeof APPOINTMENT_STATUS, string> = {
  PENDING: 'yellow',
  SCHEDULED: 'blue',
  CANCELLED: 'red',
  COMPLETED: 'green',
  NO_SHOW: 'gray'
} as const;

export const getUpcomingVaccinationsSchema = z.object({
  clinicId: z.string(),
  daysAhead: z.number().optional().default(30),
  limit: z.number().optional().default(10)
});

export const getImmunizationsByClinicSchema = z.object({
  clinicId: z.string(),
  startDate: z.date().optional(),
  endDate: z.date().optional()
});

export const recordImmunizationSchema = z.object({
  patientId: z.string(),
  vaccineId: z.string(),
  doseNumber: z.number(),
  administrationDate: z.date(),
  lotNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  administeredBy: z.string(),
  nextDueDate: z.date().optional(),
  notes: z.string().optional(),
  clinicId: z.string()
});

export const getVaccineScheduleSchema = z.object({
  patientId: z.string().optional(),
  ageInDays: z.number().optional()
});
