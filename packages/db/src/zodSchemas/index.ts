export * from './admin.schema';
export * from './appointment.schema';
export * from './auth.schema';
export * from './clinic.schema';
export * from './doctor.schema';
export * from './encounter.schema';
export * from './growth.schema';
export * from './medical.schema';
export * from './patient.schema';
export * from './prescription.schema';
export * from './service.schema';
export * from './vac.schema';
export * from './visit.schema';

import z from 'zod';

import { genderSchema } from './helpers/enums';

export const DiagnosisSchema = z.object({
  patientId: z.string(),
  medicalId: z.string(),
  doctorId: z.string(),
  symptoms: z.string({
    error: 'Symptoms required'
  }),
  diagnosis: z.string({
    error: 'Diagnosis required'
  }),
  notes: z.string().optional(),
  prescribedMedications: z.string().optional(),
  followUpPlan: z.string().optional()
});

export const workingDaySchema = z.object({
  day: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
  startTime: z.string(),
  closeTime: z.string()
});
export type Day = z.infer<typeof workingDaySchema>;

export const PaymentSchema = z.object({
  id: z.string(),
  billDate: z.date(),
  discount: z.number(),
  totalAmount: z.number()
});

export type PaymentInput = z.infer<typeof PaymentSchema>;
export const VitalSignsSchema = z.object({
  patientId: z.string(),
  medicalId: z.string(),
  encounterId: z.string().optional(),
  recordedAt: z.date(),
  bodyTemperature: z.number().optional(),
  systolic: z.number().optional(),
  diastolic: z.number().optional(),
  heartRate: z.number().optional(),
  respiratoryRate: z.number().optional(),
  oxygenSaturation: z.number().optional(),
  gender: genderSchema,
  notes: z.string().optional()
});
export type VitalSignsInput = z.infer<typeof VitalSignsSchema>;

export const PatientBillSchema = z.object({
  clinicId: z.string(),
  billId: z.string(),
  serviceId: z.string(),
  serviceDate: z.string(),
  appointmentId: z.string(),
  quantity: z.string({
    error: 'Quantity is required'
  }),
  unitCost: z.string({
    error: 'Unit cost is required'
  }),
  totalCost: z.string({
    error: 'Total cost is required'
  })
});
export const AddNewBillInputSchema = PatientBillSchema.extend({
  appointmentId: z.string().optional(),
  billId: z.string().optional()
});
