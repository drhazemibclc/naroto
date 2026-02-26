import type { AppointmentStatus, PaymentStatus, ReminderStatus } from '@generated/browser';
import { z } from 'zod';

import type { workingDaySchema } from './doctor.schema';
import { clinicIdSchema, dateSchema, emailSchema, hexColorSchema, idSchema, pastDateSchema } from './helpers/enums';

// ============ CONSTANTS ============
export const MIN_PASSWORD_LENGTH = 8;
export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 50;
export const PHONE_LENGTH = 10;
export const MIN_ADDRESS_LENGTH = 5;
export const MAX_ADDRESS_LENGTH = 500;

// ============ BASE SCHEMAS ============

// ============ STAFF SCHEMAS ============
export const StaffSchema = z.object({
  name: z
    .string()
    .trim()
    .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters`)
    .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters`),
  role: z.enum(['STAFF'], { error: 'Role is required' }),
  phone: z
    .string()
    .min(PHONE_LENGTH, `Contact must be ${PHONE_LENGTH} digits`)
    .max(PHONE_LENGTH, `Contact must be ${PHONE_LENGTH} digits`)
    .regex(/^\d+$/, 'Phone must contain only numbers'),
  email: emailSchema,
  address: z
    .string()
    .min(MIN_ADDRESS_LENGTH, `Address must be at least ${MIN_ADDRESS_LENGTH} characters`)
    .max(MAX_ADDRESS_LENGTH, `Address must be at most ${MAX_ADDRESS_LENGTH} characters`),
  licenseNumber: z.string().optional(),
  department: z.string().optional(),
  img: z.string().url('Invalid image URL').optional(),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .or(z.literal('').optional())
});

export const StaffAuthSchema = z.object({
  clinicId: clinicIdSchema,
  name: z.string().min(1, 'Name is required'),
  email: emailSchema,
  role: z.enum(['STAFF']).default('STAFF'),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().min(1, 'Address is required'),
  department: z.string().min(1, 'Department is required'),
  img: z.string().url('Invalid image URL').optional(),
  licenseNumber: z.string().optional(),
  colorCode: hexColorSchema.optional(),
  hireDate: pastDateSchema.optional(),
  salary: z.number().min(0, 'Salary must be positive').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DORMANT']).default('ACTIVE'),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
});

// ============ SERVICE SCHEMAS ============
export const ServicesSchema = z.object({
  id: idSchema.optional(),
  clinicId: clinicIdSchema,
  serviceName: z.string().min(2, 'Service name must be at least 2 characters'),
  price: z.number().positive('Price must be greater than 0'),
  isAvailable: z.boolean().default(true),
  description: z.string().min(1, 'Service description is required')
});

// ============ DELETE SCHEMAS ============
export const DeleteInputSchema = z.object({
  id: idSchema,
  deleteType: z.enum(['doctor', 'service', 'staff', 'patient', 'payment', 'bill']),
  clinicId: clinicIdSchema
});

// ============ STATS SCHEMAS ============
export const StatsInputSchema = z
  .object({
    clinicId: clinicIdSchema,
    from: dateSchema,
    to: dateSchema
  })
  .refine(data => data.from <= data.to, {
    message: 'From date must be before or equal to To date',
    path: ['from']
  });

// ============ STAFF MANAGEMENT SCHEMAS ============
export const staffCreateSchema = z.object({
  id: idSchema.optional(),
  clinicId: clinicIdSchema,
  email: emailSchema,
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  userId: idSchema.optional(),
  address: z.string().min(1, 'Address is required'),
  department: z.string().optional(),
  img: z.string().url().optional(),
  licenseNumber: z.string().optional(),
  colorCode: hexColorSchema.optional(),
  hireDate: pastDateSchema.optional(),
  salary: z.number().min(0).optional(),
  role: z.enum(['STAFF']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DORMANT']).default('ACTIVE'),
  isDeleted: z.boolean().default(false),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional()
});

export const staffUpdateSchema = staffCreateSchema.partial().extend({
  id: idSchema,
  clinicId: clinicIdSchema
});

// ============ STATUS CHANGE SCHEMAS ============
export const deleteSchema = z.object({
  id: idSchema,
  clinicId: clinicIdSchema,
  hardDelete: z.boolean().default(false)
});

export const statusChangeSchema = z.object({
  id: idSchema,
  clinicId: clinicIdSchema,
  status: z.enum(['ACTIVE', 'INACTIVE', 'DORMANT']),
  reason: z.string().optional().default('Status changed by admin')
});

// ============ RESPONSE SCHEMAS ============
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.any().optional()
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  errors: z.array(z.string()).optional(),
  error: z.string().optional()
});

export const CreateStaffResponseSchema = z.union([SuccessResponseSchema, ErrorResponseSchema]);

// ============ TYPE EXPORTS ============
export type ServiceInput = z.infer<typeof ServicesSchema>;
export type CreateStaffInput = z.infer<typeof StaffAuthSchema>;
export type WorkingDayInput = z.infer<typeof workingDaySchema>;
export type DeleteInput = z.infer<typeof DeleteInputSchema>;
export type StatsInput = z.infer<typeof StatsInputSchema>;
export type StaffValues = z.infer<typeof staffCreateSchema>;
export type StaffCreate = z.infer<typeof staffCreateSchema>;
export type StaffUpdate = z.infer<typeof staffUpdateSchema>;
export type StaffSelect = z.infer<typeof staffCreateSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============ ENUM LABELS ============
export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  PENDING: 'Pending',
  SCHEDULED: 'Scheduled',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No Show'
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIAL: 'Partially Paid',
  PAID: 'Paid',
  REFUNDED: 'Refunded'
};

export const reminderStatusLabels: Record<ReminderStatus, string> = {
  PENDING: 'Pending',
  SENT: 'Sent',
  FAILED: 'Failed'
};

export const staffStatusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DORMANT: 'Dormant'
};

export const deleteTypeLabels: Record<string, string> = {
  doctor: 'Doctor',
  staff: 'Staff',
  service: 'Service',
  patient: 'Patient',
  payment: 'Payment',
  bill: 'Bill'
};

// ============ VALIDATION UTILITIES ============
export const validateClinicId = (clinicId: string, sessionClinicId?: string): boolean => {
  return !!sessionClinicId && sessionClinicId === clinicId;
};

export const validateStaffRole = (role: string): boolean => {
  return role === 'STAFF';
};

export const validateServicePrice = (price: number): boolean => {
  return price > 0;
};

// ============ TRANSFORM UTILITIES ============
export const transformPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-PHONE_LENGTH);
};

export const transformToLowercase = (input: string): string => {
  return input.toLowerCase();
};

export const transformDateToISO = (date: Date | string): string => {
  return new Date(date).toISOString();
};

// ============ DEFAULT VALUES ============
export const DEFAULT_STAFF_VALUES: Partial<StaffCreate> = {
  status: 'ACTIVE',
  isDeleted: false,
  hireDate: new Date(),
  salary: 0
};

export const DEFAULT_SERVICE_VALUES: Partial<ServiceInput> = {
  isAvailable: true
};

// ============ SCHEMA FACTORIES ============
export const createClinicSchema = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) => {
  return schema.extend({
    clinicId: clinicIdSchema
  });
};

export const createPaginationSchema = (defaultLimit = 10, maxLimit = 100) => {
  return z.object({
    clinicId: clinicIdSchema,
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(maxLimit).default(defaultLimit),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc')
  });
};
