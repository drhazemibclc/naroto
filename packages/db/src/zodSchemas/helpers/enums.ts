// schemas/enums.ts

import * as z from 'zod';

import {
  AppointmentStatus,
  AppointmentType,
  AvailabilityStatus,
  DevelopmentStatus,
  DosageUnit,
  DrugRoute,
  EncounterStatus,
  EncounterType,
  FeedingType,
  Gender,
  GrowthStatus,
  ImmunizationStatus,
  JOBTYPE,
  LabStatus,
  MeasurementType,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  ReminderMethod,
  ReminderStatus,
  ServiceCategory,
  Status,
  UserRole
} from '../../../generated/browser';

// Role
export const roleSchema = z.enum(UserRole);
export type RoleType = z.infer<typeof roleSchema>;
export const labStatusSchema = z.enum(LabStatus);
export type LabStatusType = z.infer<typeof labStatusSchema>;
// Status
export const statusSchema = z.enum(Status);
export type StatusType = z.infer<typeof statusSchema>;

// Job Type
export const jobTypeSchema = z.enum(JOBTYPE);
export type JOBTYPEType = z.infer<typeof jobTypeSchema>;

// Gender
export const genderSchema = z.enum(Gender);
export type GenderType = z.infer<typeof genderSchema>;
// Appointment Status
export const appointmentStatusSchema = z.enum(AppointmentStatus);
export type AppointmentStatusType = z.infer<typeof appointmentStatusSchema>;
export const availabilityStatusSchema = z.enum(AvailabilityStatus);
export type AvailabilityStatusType = z.infer<typeof availabilityStatusSchema>;

export const appointmentTypeSchema = z.enum(AppointmentType);
export type AppointmentTypeType = z.infer<typeof appointmentTypeSchema>;
// Payment Method
export const paymentMethodSchema = z.enum(PaymentMethod);
export type PaymentMethodType = z.infer<typeof paymentMethodSchema>;
export const encounterTypeSchema = z.enum(EncounterType);
export type EncounterTypeType = z.infer<typeof encounterTypeSchema>;
// Payment Status
export const paymentStatusSchema = z.enum(PaymentStatus);
export type PaymentStatusType = z.infer<typeof paymentStatusSchema>;
export const encounterStatusSchema = z.enum(EncounterStatus);
export type EncounterStatusType = z.infer<typeof encounterStatusSchema>;
// Service Category
export const serviceCategorySchema = z.enum(ServiceCategory);
export type ServiceCategoryType = z.infer<typeof serviceCategorySchema>;

export const nutritionalStatusSchema = z.enum(GrowthStatus);
export type NutritionalStatusType = z.infer<typeof nutritionalStatusSchema>;
// Measurement Type
export const measurementTypeSchema = z.enum(MeasurementType);
export type MeasurementTypeType = z.infer<typeof measurementTypeSchema>;

// Reminder Method
export const reminderMethodSchema = z.enum(ReminderMethod);
export type ReminderMethodType = z.infer<typeof reminderMethodSchema>;

// Reminder Status
export const reminderStatusSchema = z.enum(ReminderStatus);
export type ReminderStatusType = z.infer<typeof reminderStatusSchema>;

// Notification Type
export const notificationTypeSchema = z.enum(NotificationType);
export type NotificationTypeType = z.infer<typeof notificationTypeSchema>;

// Feeding Type
export const feedingTypeSchema = z.enum(FeedingType);
export type FeedingTypeType = z.infer<typeof feedingTypeSchema>;

// Development Status
export const developmentStatusSchema = z.enum(DevelopmentStatus);
export type DevelopmentStatusType = z.infer<typeof developmentStatusSchema>;

// Immunization Status
export const immunizationStatusSchema = z.enum(ImmunizationStatus);
export type ImmunizationStatusType = z.infer<typeof immunizationStatusSchema>;

// Dosage Unit
export const dosageUnitSchema = z.enum(DosageUnit);
export type DosageUnitType = z.infer<typeof dosageUnitSchema>;

// Drug Route
export const drugRouteSchema = z.enum(DrugRoute);
export type DrugRouteType = z.infer<typeof drugRouteSchema>;

// Utility function to create enum arrays for select inputs
export const enumToOptions = <T extends Record<string, string>>(enumObj: T) => {
  return Object.entries(enumObj).map(([key, value]) => ({
    label: key.toLowerCase().replace(/_/g, ' '),
    value
  }));
};

// Example labels for display purposes
export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  [AppointmentStatus.PENDING]: 'Pending',
  [AppointmentStatus.SCHEDULED]: 'Scheduled',
  [AppointmentStatus.NO_SHOW]: 'No Show',
  [AppointmentStatus.CANCELLED]: 'Cancelled',
  [AppointmentStatus.COMPLETED]: 'Completed'
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  [PaymentStatus.UNPAID]: 'Unpaid',
  [PaymentStatus.PARTIAL]: 'Partially Paid',
  [PaymentStatus.PAID]: 'Paid',
  [PaymentStatus.REFUNDED]: 'Refunded'
};
// lib/validation/helpers/enums.ts

// ID Schemas
export const idSchema = z.uuid('Invalid UUID format');
export const clinicIdSchema = idSchema;
export const patientIdSchema = idSchema;
export const doctorIdSchema = idSchema;
export const medicalRecordIdSchema = idSchema;
export const encounterIdSchema = idSchema;
export const drugIdSchema = idSchema;
export const prescriptionIdSchema = idSchema;
export const prescribedItemIdSchema = idSchema;

// Date Schema
export const dateSchema = z.coerce.date();

// Enums
export const DosageUnitEnum = z.enum([
  'MG', // Milligrams
  'MCG', // Micrograms
  'G', // Grams
  'ML', // Milliliters
  'IU', // International Units
  'TABLET', // Tablets
  'CAPSULE', // Capsules
  'PUFF', // Inhaler puffs
  'DROP', // Drops
  'PATCH' // Patches
]);

export const DrugRouteEnum = z.enum([
  'ORAL',
  'INTRAVENOUS',
  'INTRAMUSCULAR',
  'SUBCUTANEOUS',
  'TOPICAL',
  'INHALATION',
  'RECTAL',
  'NASAL',
  'OPHTHALMIC',
  'OTIC',
  'BUCCAL',
  'SUBLINGUAL',
  'TRANSDERMAL'
]);

export const PrescriptionStatusEnum = z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD', 'EXPIRED']);

export const AllergySeverityEnum = z.enum(['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLAXIS']);

export const InteractionSeverityEnum = z.enum(['MINOR', 'MODERATE', 'MAJOR', 'CONTRAINDICATED']);

export const ReportedByEnum = z.enum(['PATIENT', 'DOCTOR', 'FAMILY', 'OTHER']);

export const DoseGuidelineRouteEnum = z.enum([
  'ORAL',
  'INTRAVENOUS',
  'INTRAMUSCULAR',
  'SUBCUTANEOUS',
  'TOPICAL',
  'INHALATION',
  'RECTAL'
]);

export const paginationSchema = z.object({
  limit: z.number().default(10),
  offset: z.number().default(0),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});
export type PaginationType = z.infer<typeof paginationSchema>;
export const staffIdSchema = idSchema.optional();
export const emailSchema = z.email('Invalid email address');
export const futureDateSchema = dateSchema.refine(date => date > new Date(), {
  message: 'Date must be in the future'
});
export const pastDateSchema = dateSchema.refine(date => date <= new Date(), {
  message: 'Date must be in the past'
});
export const timeSchema = z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)');
export const hexColorSchema = z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, 'Invalid hex color format');
export const decimalSchema = z.number().or(z.string().transform(val => Number.parseFloat(val)));
