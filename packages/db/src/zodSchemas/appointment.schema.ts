import {
  type Appointment,
  AppointmentStatus,
  type AppointmentType,
  type Doctor,
  type Patient,
  type Service
} from '@generated/browser';
import { z } from 'zod';

import {
  appointmentStatusSchema,
  appointmentTypeSchema,
  clinicIdSchema,
  dateSchema,
  idSchema,
  paymentMethodSchema
} from './helpers/enums';

export const AppointmentListSchema = z.object({
  clinicId: z.string(),
  patientId: z.string().optional(),
  doctorId: z.string().optional(),
  status: appointmentStatusSchema.optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

export const AppointmentStatsSchema = z.object({
  clinicId: z.string(),
  startDate: z.date().optional(),
  endDate: z.date().optional()
});

export const AppointmentCreateSchema = z.object({
  id: z.string().optional(),
  patientId: z.string(),
  clinicId: z.string(),
  doctorId: z.string(),
  serviceId: z.string().optional(),
  type: appointmentTypeSchema,
  appointmentDate: z.date(),
  time: z.string().optional(),
  status: appointmentStatusSchema.optional(),
  appointmentPrice: z.number().optional(),
  note: z.string().optional(),
  createReminder: z.boolean().optional()
});

export const AppointmentUpdateSchema = z.object({
  id: z.uuid(),
  patientId: z.string().optional(),
  doctorId: z.string().optional(),
  serviceId: z.string().optional(),
  type: appointmentTypeSchema,
  appointmentDate: z.date().optional(),
  time: z.string().optional(),
  status: appointmentStatusSchema.optional(),
  appointmentPrice: z.number().optional(),
  note: z.string().optional()
});

export const AppointmentUpdateStatusSchema = z.object({
  id: z.uuid(),
  status: appointmentStatusSchema,
  reason: z.string().optional()
});
export const AppointmentByIdSchema = z.object({
  id: z.string()
});

export const AppointmentActionSchema = z.object({
  id: z.string(),
  status: appointmentStatusSchema,
  reason: z.string().optional(),
  notes: z.string().optional()
});

export const BillCreateSchema = z.object({
  appointmentId: z.string(),
  items: z
    .array(
      z.object({
        serviceId: z.string(),
        quantity: z.number().int().min(1).max(100).default(1),
        unitCost: z.number().min(0),
        description: z.string().optional()
      })
    )
    .min(1),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  paymentMethod: paymentMethodSchema.optional(),
  notes: z.string().optional()
});

export const AppointmentDeleteSchema = z.object({
  id: idSchema,
  clinicId: clinicIdSchema
});

// ==================== QUERY INPUT SCHEMAS ====================
export const GetForMonthInputSchema = z.object({
  clinicId: clinicIdSchema,
  startDate: dateSchema,
  endDate: dateSchema
});

export const AllAppointmentsInputSchema = z.object({
  clinicId: clinicIdSchema,
  patientId: idSchema.optional(),
  search: z.string().optional(),
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(100).default(20),
  status: z.enum(AppointmentStatus).optional(),
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional()
});

export const AvailableTimesInputSchema = z.object({
  doctorId: idSchema,
  clinicId: clinicIdSchema,
  appointmentDate: dateSchema
});

export const AppointmentStatsInputSchema = z.object({
  clinicId: clinicIdSchema,
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional()
});

export type CreateAppointmentInput = z.infer<typeof AppointmentCreateSchema>;
export type UpdateAppointmentInput = z.infer<typeof AppointmentUpdateSchema>;
export type AppointmentByIdInput = z.infer<typeof AppointmentByIdSchema>;
export type AppointmentActionInput = z.infer<typeof AppointmentActionSchema>;
export type BillCreateInput = z.infer<typeof BillCreateSchema>;

export type AppointmentStatusType = z.infer<typeof appointmentStatusSchema>;
export const getForMonthInputSchema = z.object({
  clinicId: z.string(),
  startDate: z.date().min(1).max(12),
  endDate: z.date().min(1970)
});

export type GetForMonthInput = z.infer<typeof getForMonthInputSchema>;

export const allAppointmentsInputSchema = z.object({
  clinicId: z.string(),
  patientId: z.string().optional(),
  doctorId: z.string().optional(),
  status: appointmentStatusSchema.optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  take: z.number().min(1).max(100).default(20),
  skip: z.number().min(0).default(0)
});
export type UpdateAppointmentStatusInput = z.infer<typeof AppointmentUpdateStatusSchema>;
export type DeleteAppointmentInput = z.infer<typeof AppointmentDeleteSchema>;
export type AllAppointmentsInput = z.infer<typeof AllAppointmentsInputSchema>;
export type AvailableTimesInput = z.infer<typeof AvailableTimesInputSchema>;
export type AppointmentStatsInput = z.infer<typeof AppointmentStatsInputSchema>;

export type AppointmentListInput = z.infer<typeof AppointmentListSchema>;
export type AppointmentCreateInput = z.infer<typeof AppointmentCreateSchema>;
export type AppointmentUpdateInput = z.infer<typeof AppointmentUpdateSchema>;

export interface AppointmentStats {
  byStatus: Record<string, number>;
  monthlyTrend?: Array<{ month: string; appointments: number }>;
  todayCount?: number;
  topDoctors?: Array<{ doctorId: string; doctorName: string; count: number }>;
  topServices?: Array<{ serviceId: string; serviceName: string; count: number }>;
  totalAppointments: number;
  upcomingCount?: number;
}
// src/modules/appointment/appointment.types.ts

export type AppointmentWithRelations = Appointment & {
  patient?: Pick<Patient, 'id' | 'firstName' | 'lastName' | 'phone' | 'gender' | 'dateOfBirth' | 'image' | 'colorCode'>;
  doctor?: Pick<Doctor, 'id' | 'name' | 'specialty' | 'img' | 'colorCode' | 'availableFromTime' | 'availableToTime'>;
  service?: Pick<Service, 'id' | 'serviceName' | 'price' | 'isAvailable' | 'icon' | 'color'>;
};

export interface TimeSlot {
  available: boolean;
  label?: string;
  value: string; // "09:00"
}

export interface AppointmentCalendarEvent {
  color?: string;
  doctorName: string;
  end: Date;
  id: string;
  patientName: string;
  start: Date;
  status: AppointmentStatus;
  title: string;
  type: AppointmentType;
}
