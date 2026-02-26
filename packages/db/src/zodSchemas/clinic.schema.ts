import { z } from 'zod';

export const clinicGetByIdSchema = z.object({
  id: z.uuid()
});

export type ClinicGetOneInput = z.infer<typeof clinicGetOneSchema>;
export type ClinicCreateInput = z.infer<typeof clinicCreateSchema>;
export type ClinicGetByIdInput = z.infer<typeof clinicGetByIdSchema>;
export const reviewSchema = z.object({
  patientId: z.string(),
  staffId: z.string(),
  clinicId: z.uuid().optional(),
  rating: z.number(),
  comment: z
    .string()
    .min(1, 'Review must be at least 10 characters long')
    .max(500, 'Review must not exceed 500 characters')
});
export type ReviewFormValues = z.infer<typeof reviewSchema>;

export const DashboardStatsInputSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date()
});

export const MedicalRecordsSummaryInputSchema = z.object({
  clinicId: z.string().min(1)
});

export const ClinicStatsSchema = z.object({
  clinicId: z.uuid(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export const ClinicUpdateSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email format').optional().nullable(),
  phone: z.string().min(5, 'Invalid phone number').optional().nullable(),
  address: z.string().optional().nullable(),
  timezone: z.string().optional(),
  logo: z.string().url('Invalid logo URL').optional().nullable()
});

// ==================== RATING SCHEMAS ====================

export const RatingCreateSchema = z
  .object({
    clinicId: z.uuid().optional(),
    staffId: z.uuid().optional(), // Maps to doctor in your model
    patientId: z.uuid(),
    rating: z.number().int().min(1).max(5), // Typical 1-5 star scale
    comment: z.string().max(500, 'Comment too long').optional().nullable()
  })
  .refine(data => data.clinicId || data.staffId, {
    message: 'Rating must be associated with either a clinic or a staff member',
    path: ['clinicId']
  });

// ==================== INFERRED TYPES ====================

export type ClinicStatsInput = z.infer<typeof ClinicStatsSchema>;
export type ClinicUpdateInput = z.infer<typeof ClinicUpdateSchema>;
export type RatingCreateInput = z.infer<typeof RatingCreateSchema>;

// ... keeping your existing exports below
export const clinicGetOneSchema = z.object({
  id: z.string().min(1, { message: 'Id is required' })
});

export const clinicCreateSchema = z.object({
  name: z.string().min(1, 'Clinic name is required'),
  email: z.string().email().optional(), // Fixed typo from 'emai'
  address: z.string().optional(),
  phone: z.string().optional(),
  logo: z.string().url().optional()
});
export type DashboardStatsInput = z.infer<typeof DashboardStatsInputSchema>;
export type MedicalRecordsSummaryInput = z.infer<typeof MedicalRecordsSummaryInputSchema>;
export const PaymentFilterSchema = z.object({
  // Required for multi-tenancy security
  clinicId: z.string().uuid('Invalid Clinic ID format'),

  // Pagination
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(100).default(20),

  // Optional Filters
  search: z.string().optional(),

  // You might want to add these later for more robust filtering:
  status: z.enum(['PAID', 'PENDING', 'CANCELLED', 'REFUNDED']).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional()
});

// Export the inferred type
export type PaymentFilterInput = z.infer<typeof PaymentFilterSchema>;
