// src/modules/patient/patient.schema.ts
import { z } from 'zod';

import { emailSchema, genderSchema, statusSchema } from './helpers/enums';

// ==================== MEDICAL VALIDATION HELPERS ====================
const bloodGroupSchema = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional();
const phoneNumberSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional();
const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

// ==================== BASE SCHEMAS ====================
export const patientBaseSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    dateOfBirth: z.date().refine(date => date <= new Date(), {
      message: 'Date of birth cannot be in future'
    }),
    gender: genderSchema,
    phone: phoneNumberSchema.nullable(),
    email: emailSchema.nullable(),
    address: z.string().max(500, 'Address must be less than 500 characters').optional().nullable(),
    image: z.string().url('Invalid image URL').optional().nullable(),
    colorCode: z
      .string()
      .regex(/^#([0-9A-F]{3}){1,2}$/i, 'Invalid hex color format')
      .optional()
      .nullable(),
    bloodGroup: bloodGroupSchema.nullable(),
    allergies: z.string().max(2000, 'Allergies must be less than 2000 characters').optional().nullable(),
    medicalConditions: z
      .string()
      .max(2000, 'Medical conditions must be less than 2000 characters')
      .optional()
      .nullable(),
    relation: z.string().max(100, 'Relation must be less than 100 characters').optional().nullable(),

    medicalHistory: z.string().max(5000, 'Medical history must be less than 5000 characters').optional().nullable(),
    nutritionalStatus: z.string().max(100, 'Nutritional status must be less than 100 characters').optional().nullable(),
    emergencyContactName: nameSchema.optional().nullable(),
    emergencyContactNumber: phoneNumberSchema.nullable(),
    maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional().nullable(),
    status: statusSchema.default('ACTIVE')
  })
  .refine(
    data => {
      // If emergency contact name is provided, phone should also be provided
      if (data.emergencyContactName && !data.emergencyContactNumber) {
        return false;
      }
      // If emergency contact phone is provided, name should also be provided
      if (data.emergencyContactNumber && !data.emergencyContactName) {
        return false;
      }
      return true;
    },
    {
      message: 'Emergency contact name and phone must both be provided if either is specified',
      path: ['emergencyContactNumber']
    }
  );

// ==================== CREATE SCHEMA ====================
export const CreatePatientSchema = patientBaseSchema
  .extend({
    clinicId: z.uuid().optional() // Will be set from session
  })
  .refine(
    data => {
      // Additional validation for create
      const today = new Date();
      const ageInYears = Math.floor(
        (today.getTime() - new Date(data.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      );

      // Pediatric patients (under 18) should have guardian information
      if (ageInYears < 18 && !data.emergencyContactName) {
        return false;
      }
      return true;
    },
    {
      message: 'Patients under 18 must have emergency contact information',
      path: ['emergencyContactName']
    }
  );

// ==================== UPDATE SCHEMA ====================
export const UpdatePatientSchema = patientBaseSchema.partial();

// ==================== UPSERT SCHEMA ====================
export const UpsertPatientSchema = z.object({
  id: z.uuid().optional(),
  ...patientBaseSchema.shape
});

// ==================== DELETE SCHEMA ====================
export const DeletePatientSchema = z.object({
  id: z.uuid()
});

// ==================== QUERY SCHEMAS ====================
export const GetAllPatientsSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
  search: z.string().max(100, 'Search term must be less than 100 characters').optional(),
  clinicId: z.uuid().optional(),
  status: statusSchema.optional(),
  gender: genderSchema.optional(),
  bloodGroup: bloodGroupSchema.optional(),
  ageRange: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().max(130).optional()
    })
    .optional()
    .refine(
      data => {
        if (data?.min !== undefined && data.max !== undefined) {
          return data.min <= data.max;
        }
        return true;
      },
      {
        message: 'Minimum age must be less than or equal to maximum age',
        path: ['max']
      }
    ),
  dateOfBirthRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional()
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
  sortBy: z.enum(['firstName', 'lastName', 'createdAt', 'dateOfBirth', 'age']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  hasAllergies: z.boolean().optional(),
  hasMedicalConditions: z.boolean().optional()
});

export const GetPatientByIdSchema = z.object({
  id: z.uuid(),
  includeMedicalRecords: z.boolean().default(false),
  includeAppointments: z.boolean().default(false),
  includePrescriptions: z.boolean().default(false)
});

// ==================== SEARCH SCHEMAS ====================
export const SearchPatientsSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100),
  clinicId: z.uuid(),
  searchBy: z.enum(['name', 'email', 'phone', 'id']).default('name'),
  limit: z.coerce.number().int().min(1).max(20).default(10)
});

// ==================== MEDICAL ALERT SCHEMAS ====================
export const PatientMedicalAlertSchema = z.object({
  patientId: z.uuid(),
  alertType: z.enum(['ALLERGY', 'CONDITION', 'MEDICATION', 'OTHER']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().default(true)
});

// ==================== TYPE EXPORTS ====================
export type PatientFormData = z.infer<typeof patientBaseSchema>;
export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;
export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>;
export type UpsertPatientInput = z.infer<typeof UpsertPatientSchema>;
export type GetAllPatientsInput = z.infer<typeof GetAllPatientsSchema>;
export type SearchPatientsInput = z.infer<typeof SearchPatientsSchema>;
export type PatientMedicalAlertInput = z.infer<typeof PatientMedicalAlertSchema>;
// modules/patient/schemas/patient.schema.ts

// Base schemas for common fields
const idSchema = z.uuid();
const dateSchema = z.coerce.date();

// Gender enum
export const GenderEnum = z.enum(['MALE', 'FEMALE']);

// Blood type enum
export const BloodTypeEnum = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

// Patient schema
export const PatientSchema = z.object({
  id: idSchema.optional(),
  clinicId: idSchema,
  createdById: idSchema.optional(),

  // Personal Information
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: dateSchema,
  gender: GenderEnum,

  // Contact Information
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number')
    .optional()
    .nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zipCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),

  // Emergency Contact
  emergencyContactName: z.string().max(200).optional().nullable(),
  emergencyContactPhone: z.string().max(20).optional().nullable(),
  emergencyContactRelationship: z.string().max(100).optional().nullable(),

  // Medical Information
  bloodType: BloodTypeEnum.optional().nullable(),
  allergies: z.string().optional().nullable(),
  medicalConditions: z.string().optional(),

  chronicConditions: z.string().default(''),
  medications: z.array(z.string()).default([]),

  // Insurance Information
  insuranceProvider: z.string().max(200).optional().nullable(),
  insurancePolicyNumber: z.string().max(100).optional().nullable(),
  insuranceGroupNumber: z.string().max(100).optional().nullable(),

  // Metadata
  colorCode: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .default('#4ECDC4'),
  notes: z.string().max(2000).optional().nullable(),
  isDeleted: z.boolean().default(false),

  // Timestamps (server-managed)
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
  deletedAt: dateSchema.optional().nullable()
});

// Patient filter schema
export const PatientFilterSchema = z.object({
  clinicId: idSchema.optional(),
  search: z.string().max(100).optional(),
  gender: GenderEnum.optional(),
  dateOfBirthFrom: dateSchema.optional(),
  dateOfBirthTo: dateSchema.optional(),
  bloodType: BloodTypeEnum.optional(),
  isDeleted: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['firstName', 'lastName', 'dateOfBirth', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Types
export type Patient = z.infer<typeof PatientSchema>;
export type PatientFilterInput = z.infer<typeof PatientFilterSchema>;
