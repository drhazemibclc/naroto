import { UserRole } from '@generated/browser';
import { z } from 'zod';

import { NullableDecimal } from './helpers';
import { availabilityStatusSchema, decimalSchema, jobTypeSchema, statusSchema } from './helpers/enums';

const userRoleSchema = z.enum(UserRole);
// Doctor schemas
export const CreateDoctorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  specialty: z.string().min(1, 'Specialty is required'),
  email: z.email('Invalid email address'),
  address: z.string(),
  licenseNumber: z.string(),
  type: jobTypeSchema,
  department: z.string(),
  isActive: z.boolean().optional().default(true),
  appointmentPrice: NullableDecimal.optional(),
  phone: z.string(),
  img: z.string().optional(),
  colorCode: z.string().optional(),
  availableFromTime: z.string(),
  availableToTime: z.string(),
  availableFromWeekDay: z.number().min(0).max(6),
  availableToWeekDay: z.number().min(0).max(6),
  availabilityStatus: availabilityStatusSchema.optional(),
  status: statusSchema.optional(), // Add status field
  clinicId: z.string(), // Add clinicId for relation
  userId: z.string().optional(), // Add userId for relation
  role: userRoleSchema.optional() // Add role field
});
export const DoctorListSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional()
});

export const DoctorByIdSchema = z.object({
  id: z.uuid()
});

// Export types
export type CreateDoctorInput = z.infer<typeof CreateDoctorSchema>;
export type DoctorListInput = z.infer<typeof DoctorListSchema>;
export type DoctorByIdInput = z.infer<typeof DoctorByIdSchema>;

export const workingDaySchema = z.object({
  day: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
  startTime: z.string(),
  endTime: z.string()
});
const MAGIC_8_6 = 8;
const MAGIC_2_0 = 2;
const MAGIC_50_2 = 50;
const MAGIC_10_3 = 10;
const MAGIC_5_4 = 5;
const MAGIC_500_5 = 500;

// --- 1. Define the Schema for a Single Working Day (WorkingDays model) ---
export const WorkingDaySchema = z.object({
  day: z.string().min(1, 'Day is required'), // e.g., 'Monday', 'Tuesday'
  startTime: z.string().min(1, 'Start time is required'), // String format (TIME equivalent)
  endTime: z.string().min(1, 'Close time is required') // String format (TIME equivalent)
});

// --- 2. Define the Schema for Creating a New Doctor ---
export const CreateNewDoctorInputSchema = z.object({
  clinicId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(MAGIC_2_0, 'Name must be at least MAGIC_2_0 characters')
    .max(MAGIC_50_2, 'Name must be at most MAGIC_50_2 characters'),
  phone: z.string().min(MAGIC_10_3, 'Enter phone number').max(MAGIC_10_3, 'Enter phone number'),
  email: z.email('Invalid email address.'),
  colorCode: z.string().optional(),
  address: z
    .string()
    .min(MAGIC_5_4, 'Address must be at least MAGIC_5_4 characters')
    .max(MAGIC_500_5, 'Address must be at most MAGIC_500_5 characters'),
  specialty: z.string().min(MAGIC_2_0, 'Specialty is required.'),
  licenseNumber: z.string().min(MAGIC_2_0, 'License number is required'),
  type: z.enum(['FULL', 'PART'], {
    error: 'Type is required.'
  }),
  appointmentPrice: decimalSchema.optional(),
  department: z.string().min(MAGIC_2_0, 'Department is required.'),
  img: z.string().optional(),
  password: z
    .string()
    .min(MAGIC_8_6, {
      error: 'Password must be at least MAGIC_8_6 characters long!'
    })
    .optional()
    .or(z.literal('')),

  // --- NEW FIELDS FROM PRISMA MODEL ---

  // General Weekly Availability (e.g., used for quick checks)
  availableFromWeekDay: z.number().optional(),
  availableToWeekDay: z.number().optional(),
  availableFromTime: z.string().optional(),

  // Default Daily Working Hours (String for TIME equivalent)
  availableToTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),

  // Detailed Work Schedule (Used for creating WorkingDays records)
  workSchedule: z.array(WorkingDaySchema).optional()
});

export type Day = z.infer<typeof workingDaySchema>;
export const DeleteDoctorSchema = z.object({
  id: z
    .string({
      error: 'Doctor ID is required'
    })
    .uuid('Invalid Doctor ID format') // Ensures the ID is a valid UUID
    .min(1, 'Doctor ID cannot be empty'),

  // Optional: Add a confirmation field if deleting via a modal
  confirmName: z.string().optional()
});

// Type inference for use in components
export type DeleteDoctorInput = z.infer<typeof DeleteDoctorSchema>;
