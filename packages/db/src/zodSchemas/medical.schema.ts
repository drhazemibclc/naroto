import { z } from 'zod';

import { clinicIdSchema, dateSchema, idSchema, labStatusSchema } from './helpers/enums';

// ==================== MEDICAL RECORDS SCHEMAS ====================
export const MedicalRecordBaseSchema = z.object({
  patientId: idSchema,
  doctorId: idSchema,
  clinicId: clinicIdSchema,
  appointmentId: idSchema,
  diagnosis: z.string().min(1, 'Diagnosis is required').max(2000),
  symptoms: z.string().min(1, 'Symptoms are required').max(5000),
  treatmentPlan: z.string().max(3000).optional(),
  labRequest: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  attachments: z.string().url().optional(),
  followUpDate: dateSchema.optional(),
  // SOAP note structure
  subjective: z.string().max(3000).optional(),
  objective: z.string().max(3000).optional(),
  assessment: z.string().max(2000).optional(),
  plan: z.string().max(3000).optional(),
  // HIPAA compliance
  isConfidential: z.boolean().default(false),
  accessLevel: z.enum(['STANDARD', 'SENSITIVE', 'RESTRICTED']).default('STANDARD')
});

export const MedicalRecordCreateSchema = MedicalRecordBaseSchema;

export const MedicalRecordUpdateSchema = MedicalRecordBaseSchema.partial().extend({
  id: idSchema
});

export const MedicalRecordFilterSchema = z.object({
  patientId: idSchema.optional(),
  doctorId: idSchema.optional(),
  clinicId: clinicIdSchema,
  startDate: z.date(),
  endDate: z.date(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(20),
  appointmentId: idSchema.optional(),
  isConfidential: z.boolean().optional(),
  accessLevel: z.enum(['STANDARD', 'SENSITIVE', 'RESTRICTED']).optional(),
  dateRange: z
    .object({
      from: dateSchema.optional(),
      to: dateSchema.optional()
    })
    .optional(),
  search: z.string().max(100).optional(),
  page: z.number().int().min(1).default(1),
  sortBy: z.enum(['createdAt', 'patientName', 'doctorName', 'followUpDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ==================== LAB TEST SCHEMAS ====================
export const LabTestBaseSchema = z.object({
  recordId: idSchema,
  serviceId: idSchema,
  patientId: idSchema,
  testDate: dateSchema.default(() => new Date()),
  result: z.string().max(2000),
  status: labStatusSchema.default('PENDING'),
  notes: z.string().max(1000).optional(),
  orderedBy: idSchema.optional(), // Doctor ID
  performedBy: idSchema.optional(), // Lab technician ID
  sampleType: z.string().max(100).optional(),
  sampleCollectionDate: dateSchema.optional(),
  reportDate: dateSchema.optional(),
  referenceRange: z.string().max(500).optional(),
  units: z.string().max(50).optional()
});
export const MedicalRecordByIdSchema = MedicalRecordBaseSchema.extend({
  id: idSchema,
  clinicId: clinicIdSchema,
  limit: z.number().int().min(1).max(100).optional(),
  page: z.number().int().min(1).default(1),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'patientName', 'doctorName', 'followUpDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const LabTestCreateSchema = LabTestBaseSchema;

export const LabTestUpdateSchema = LabTestBaseSchema.partial().extend({
  id: idSchema
});
export const LabTestByIdSchema = LabTestBaseSchema.extend({
  id: idSchema,
  clinicId: clinicIdSchema,
  limit: z.number().int().min(1).max(100).optional(),
  page: z.number().int().min(1).default(1),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'patientName', 'doctorName', 'followUpDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});
export const LabTestByMedicalRecordSchema = LabTestBaseSchema.extend({
  medicalId: idSchema,
  clinicId: clinicIdSchema,
  limit: z.number().int().min(1).max(100).optional(),
  page: z.number().int().min(1).default(1),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'patientName', 'doctorName', 'followUpDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const LabTestFilterSchema = z.object({
  medicalId: idSchema.optional(),
  patientId: idSchema.optional(),
  serviceId: idSchema.optional(),
  status: labStatusSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});
export type MedicalRecordCreateInput = z.infer<typeof MedicalRecordCreateSchema>;
export type MedicalRecordUpdateInput = z.infer<typeof MedicalRecordUpdateSchema>;
export type MedicalRecordFilterInput = z.infer<typeof MedicalRecordFilterSchema>;
export type LabTestCreateInput = z.infer<typeof LabTestCreateSchema>;
export type LabTestUpdateInput = z.infer<typeof LabTestUpdateSchema>;
export type LabTestFilterInput = z.infer<typeof LabTestFilterSchema>;
