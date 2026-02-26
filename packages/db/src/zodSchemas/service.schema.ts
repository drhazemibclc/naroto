import z from 'zod';

import { paginationSchema } from './helpers/enums';

export const serviceCategoryEnum = z.enum([
  'CONSULTATION',
  'LAB_TEST',
  'VACCINATION',
  'PROCEDURE',
  'PHARMACY',
  'EMERGENCY',
  'OTHER'
]);

export const serviceStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const ServiceCreateSchema = z.object({
  serviceName: z.string().min(1, 'Service name is required').max(200),
  description: z.string().min(1, 'Description is required').max(1000),
  price: z.number().positive('Price must be positive'),
  category: serviceCategoryEnum.optional(),
  duration: z.number().int().positive('Duration must be positive').optional(),
  clinicId: z.string().optional(), // Optional for global services
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
    .optional(),
  status: serviceStatusEnum.default('ACTIVE').optional()
});

export const updateServiceSchema = z.object({
  id: z.uuid('Invalid service ID'),
  serviceName: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  clinicId: z.string().optional(),
  price: z.number().positive().optional(),
  category: serviceCategoryEnum.optional(),
  duration: z.number().int().positive().optional(),
  isAvailable: z.boolean().optional(),
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  status: serviceStatusEnum.optional(),
  deletedAt: z.date().optional().nullable()
});

export const ServiceFilterSchema = z.object({
  clinicId: z.string().optional(),
  category: serviceCategoryEnum.optional(),
  status: serviceStatusEnum.optional(),
  isAvailable: z.boolean().optional(),
  serviceName: z.string().optional(),
  search: z.string().optional(),
  pagination: paginationSchema.optional(),
  filters: z
    .array(
      z.object({
        field: z.string(),
        operator: z.string(),
        value: z.string()
      })
    )
    .optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  includeDeleted: z.boolean().default(false)
});
// Add to existing schemas
export const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.uuid()),
  status: z.enum(['ACTIVE', 'INACTIVE'])
});

export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>;
export const serviceIdSchema = z.object({
  id: z.uuid('Invalid service ID')
});
export const serviceDeleteSchema = z.object({
  id: z.uuid('Invalid service ID'),
  reason: z.string().min(1).max(200),
  deletedAt: z.date().default(new Date())
});

export const clinicServicesSchema = z.object({
  clinicId: z.string(),
  includeAppointments: z.boolean().default(false),
  includeBills: z.boolean().default(false)
});

// Export types
export type CreateServiceInput = z.infer<typeof ServiceCreateSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ServiceFilters = z.infer<typeof ServiceFilterSchema>;
export type ServiceIdInput = z.infer<typeof serviceIdSchema>;
export type ClinicServicesInput = z.infer<typeof clinicServicesSchema>;
