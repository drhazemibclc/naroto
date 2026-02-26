// packages/db/src/services/service.services.ts

/**
 * 🔵 SERVICE SERVICE - BUSINESS LOGIC LAYER
 *
 * RESPONSIBILITIES:
 * - Business logic and validation
 * - Date calculations
 * - Redis caching
 * - Pino logging
 * - Orchestrating repository calls
 * - Error handling
 */

import logger from '@naroto/logger';
import redis from '@naroto/redis';
import type Decimal from 'decimal.js';

import { prisma } from '../client';
import * as serviceRepository from '../repositories/service.repo';
import type { ServiceCategory, Status } from '../types';
import { toNumber } from '../utils';
import type { ServiceFilters } from '../zodSchemas';

const CACHE_TTL = 300; // 5 minutes
const SERVICE_CACHE_PREFIX = 'service:';

// ==================== TYPE DEFINITIONS ====================

export interface ServiceWithStats {
  category: ServiceCategory | null;
  clinicId: string | null;
  color: string | null;
  createdAt: Date;
  description: string;
  duration: number | null;
  icon: string | null;
  id: string;
  isAvailable: boolean;
  price: number;
  serviceName: string;
  status: Status;
  updatedAt: Date;
  usageStats?: {
    totalAppointments: number;
    completedAppointments: number;
    totalRevenue: number;
    completionRate: number;
  };
}

export interface ServiceAnalytics {
  averagePrice: number;
  byCategory: Array<{
    category: ServiceCategory | null;
    count: number;
    averagePrice: number;
  }>;
  maxPrice: number;
  minPrice: number;
  popularServices: Array<{
    id: string;
    name: string;
    appointmentCount: number;
    revenue: number;
  }>;
  revenueByService: Array<{
    serviceName: string;
    revenue: number;
    count: number;
  }>;
  totalServices: number;
}

export interface ServiceAvailability {
  estimatedWaitDays?: number;
  id: string;
  isAvailable: boolean;
  nextAvailableSlot?: Date;
  serviceName: string;
}

export interface ServiceValidationResult {
  errors: string[];
  valid: boolean;
  warnings: string[];
}

// ==================== SERVICE FUNCTIONS ====================

/**
 * Get service by ID with caching
 */
export async function getServiceById(
  id: string,
  clinicId?: string,
  options?: { includeStats?: boolean; skipCache?: boolean }
): Promise<ServiceWithStats | null> {
  const cacheKey = `${SERVICE_CACHE_PREFIX}${id}`;
  const startTime = Date.now();

  // Check cache
  if (!options?.skipCache) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug('Service served from cache', { serviceId: id });
        return JSON.parse(cached) as ServiceWithStats;
      }
    } catch (error) {
      logger.error('Redis cache read failed', { error, serviceId: id });
    }
  }

  try {
    // Get service from repository
    const service = await serviceRepository.findServiceById(prisma, id, clinicId);

    if (!service) {
      logger.debug('Service not found', { serviceId: id });
      return null;
    }

    let result: ServiceWithStats = {
      ...service,
      price: service.price.toNumber(),
      isAvailable: service.isAvailable ?? false,
      status: (service.status as Status) || 'ACTIVE',
      usageStats: undefined
    };

    // Include usage stats if requested
    if (options?.includeStats) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const usageStats = await serviceRepository.getUsageStats(prisma, id, {
        from: thirtyDaysAgo,
        to: new Date()
      });

      result = {
        ...result,
        usageStats
      };
    }

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (error) {
      logger.error('Redis cache write failed', { error, serviceId: id });
    }

    logger.info('Service retrieved successfully', {
      serviceId: id,
      duration: Date.now() - startTime
    });

    return result;
  } catch (error) {
    logger.error('Failed to get service', { error, serviceId: id });
    throw new Error('Unable to fetch service');
  }
}

/**
 * Get services with filters and pagination
 */
export async function getServices(filters: ServiceFilters, options?: { includeStats?: boolean }) {
  const cacheKey = `services:${JSON.stringify(filters)}`;
  const startTime = Date.now();

  try {
    // Try cache for list endpoints (shorter TTL)
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.error('Redis cache read failed', { error });
  }

  try {
    const [services, totalCount] = await Promise.all([
      serviceRepository.findWithFilters(prisma, filters),
      serviceRepository.count(prisma, filters)
    ]);

    let result = services.map(s => ({ ...s, price: s.price.toNumber() }));

    // Include usage stats if requested (for each service)
    if (options?.includeStats && services.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const now = new Date();

      const servicesWithStats = await Promise.all(
        services.map(async service => {
          const usageStats = await serviceRepository.getUsageStats(prisma, service.id, {
            from: thirtyDaysAgo,
            to: now
          });
          return {
            ...service,
            price: service.price.toNumber(),
            usageStats
          };
        })
      );
      result = servicesWithStats;
    }

    const limit = filters.pagination?.limit || 20;
    const offset = filters.pagination?.offset || 0;

    const response = {
      items: result,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };

    // Cache for 2 minutes (list endpoints change more frequently)
    await redis.setex(cacheKey, 120, JSON.stringify(response));

    logger.info('Services retrieved successfully', {
      count: services.length,
      total: totalCount,
      duration: Date.now() - startTime
    });

    return response;
  } catch (error) {
    logger.error('Failed to get services', { error, filters });
    throw new Error('Unable to fetch services');
  }
}

/**
 * Create a new service
 */
export async function createService(data: {
  serviceName: string;
  description: string;
  price: number;
  category?: ServiceCategory;
  duration?: number;
  clinicId?: string;
  icon?: string;
  color?: string;
}) {
  const startTime = Date.now();

  try {
    // Validate service name uniqueness
    if (data.clinicId) {
      const existing = await serviceRepository.checkNameExists(prisma, data.clinicId, data.serviceName);
      if (existing) {
        throw new Error('A service with this name already exists in the clinic');
      }
    }

    // Validate price
    if (data.price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    // Validate duration
    if (data.duration && data.duration <= 0) {
      throw new Error('Duration must be greater than 0');
    }

    const service = await serviceRepository.createService(prisma, {
      ...data,
      id: crypto.randomUUID(),
      price: new (await import('decimal.js')).default(data.price),
      duration: data.duration || 0,
      status: 'ACTIVE',
      isAvailable: true
    });

    // Invalidate relevant caches
    await invalidateServiceCaches(data.clinicId);

    logger.info('Service created successfully', {
      serviceId: service.id,
      serviceName: service.serviceName,
      clinicId: data.clinicId,
      duration: Date.now() - startTime
    });

    return service;
  } catch (error) {
    logger.error('Failed to create service', { error, data });
    throw error;
  }
}

/**
 * Update an existing service
 */
export async function updateService(
  id: string,
  data: {
    serviceName?: string;
    description?: string;
    price?: Decimal | number;
    category?: ServiceCategory;
    duration?: number;
    isAvailable?: boolean;
    icon?: string;
    color?: string;
    status?: Status;
  }
) {
  const startTime = Date.now();

  try {
    // Check if service exists
    const existing = await serviceRepository.findServiceById(prisma, id);
    if (!existing) {
      throw new Error('Service not found');
    }

    // Validate price if provided
    if (data.price !== undefined && toNumber(data.price) <= 0) {
      throw new Error('Price must be greater than 0');
    }

    // Validate duration if provided
    if (data.duration !== undefined && data.duration <= 0) {
      throw new Error('Duration must be greater than 0');
    }

    // Check name uniqueness if name is being changed
    if (data.serviceName && data.serviceName !== existing.serviceName) {
      const nameExists = await serviceRepository.checkNameExists(
        prisma,
        existing.clinicId || undefined,
        data.serviceName,
        id
      );
      if (nameExists) {
        throw new Error('A service with this name already exists');
      }
    }

    const service = await serviceRepository.updateService(prisma, id, existing.clinicId ?? '', {
      ...data,
      serviceName: data.serviceName ?? existing.serviceName,
      description: data.description ?? existing.description,
      price: data.price ? new (await import('decimal.js')).default(data.price) : existing.price,
      updatedAt: new Date()
    });

    // Invalidate caches
    await invalidateServiceCaches(existing.clinicId || undefined, id);

    logger.info('Service updated successfully', {
      serviceId: id,
      changes: Object.keys(data),
      duration: Date.now() - startTime
    });

    return service;
  } catch (error) {
    logger.error('Failed to update service', { error, serviceId: id, data });
    throw error;
  }
}

/**
 * Delete a service (soft delete)
 */
export async function deleteService(id: string, permanent = false) {
  const startTime = Date.now();

  try {
    // Check if service exists
    const existing = await serviceRepository.findServiceById(prisma, id);
    if (!existing) {
      throw new Error('Service not found');
    }

    // Check if service is in use
    const usageStats = await serviceRepository.getUsageStats(prisma, id);
    if (usageStats.totalAppointments > 0 && !permanent) {
      // Soft delete if it has been used
      const result = await serviceRepository.softDeleteService(prisma, id, existing.clinicId ?? '', {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      });

      logger.info('Service soft deleted', {
        serviceId: id,
        action: 'soft_delete',
        appointmentsCount: usageStats.totalAppointments,
        duration: Date.now() - startTime
      });

      return result;
    }
    if (permanent) {
      // Permanent delete (admin only)
      const result = await serviceRepository.permanentDelete(prisma, id);

      logger.info('Service permanently deleted', {
        serviceId: id,
        action: 'permanent_delete',
        duration: Date.now() - startTime
      });

      return result;
    }
    // Soft delete with warning
    const result = await serviceRepository.softDeleteService(prisma, id, existing.clinicId ?? '', {
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date()
    });

    logger.warn('Service soft deleted despite having appointments', {
      serviceId: id,
      appointmentsCount: usageStats.totalAppointments,
      duration: Date.now() - startTime
    });

    return result;
  } catch (error) {
    logger.error('Failed to delete service', { error, serviceId: id });
    throw error;
  } finally {
    // Invalidate caches
    // We can't easily get clinicId here if we failed before fetching 'existing',
    // but typically we'd want to invalidate if we knew it.
    // For now, we rely on the logic inside try block to invalidate.
  }
}

/**
 * Restore a soft-deleted service
 */
export async function restoreService(id: string) {
  const startTime = Date.now();

  try {
    const service = await serviceRepository.restoreService(prisma, id);

    await invalidateServiceCaches(service.clinicId || undefined, id);

    logger.info('Service restored successfully', {
      serviceId: id,
      duration: Date.now() - startTime
    });

    return service;
  } catch (error) {
    logger.error('Failed to restore service', { error, serviceId: id });
    throw error;
  }
}

/**
 * Get service analytics
 */
export async function getServiceAnalytics(
  clinicId: string,
  options?: { from?: Date; to?: Date }
): Promise<ServiceAnalytics> {
  const cacheKey = `analytics:services:${clinicId}:${options?.from?.toISOString()}:${options?.to?.toISOString()}`;
  const startTime = Date.now();

  try {
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ServiceAnalytics;
    }
  } catch (error) {
    logger.error('Redis cache read failed', { error });
  }

  try {
    // Get basic stats
    const [stats, categoryStats, services] = await Promise.all([
      serviceRepository.getStats(prisma, clinicId),
      serviceRepository.getCategoryStats(prisma, clinicId),
      serviceRepository.findServices(prisma, clinicId)
    ]);

    // Get usage stats for each service
    const dateRange = options?.from && options?.to ? { from: options.from, to: options.to } : undefined;

    const usagePromises = services.map(async service => {
      const usage = await serviceRepository.getUsageStats(prisma, service.id, dateRange);
      return {
        id: service.id,
        name: service.serviceName,
        appointmentCount: usage.totalAppointments,
        revenue: usage.totalRevenue
      };
    });

    const usageStats = await Promise.all(usagePromises);

    // Sort and get popular services
    const popularServices = [...usageStats].sort((a, b) => b.appointmentCount - a.appointmentCount).slice(0, 10);

    // Revenue by service
    const revenueByService = usageStats
      .filter(s => s.revenue > 0)
      .map(s => ({
        serviceName: s.name,
        revenue: s.revenue,
        count: s.appointmentCount
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const analytics: ServiceAnalytics = {
      totalServices: stats._count || 0,
      averagePrice: stats._avg.price?.toNumber() || 0,
      minPrice: stats._min.price?.toNumber() || 0,
      maxPrice: stats._max.price?.toNumber() || 0,
      byCategory: categoryStats.map(c => ({
        category: c.category,
        count: c._count,
        averagePrice: c._avg.price?.toNumber() || 0
      })),
      popularServices,
      revenueByService
    };

    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(analytics));

    logger.info('Service analytics generated', {
      clinicId,
      duration: Date.now() - startTime
    });

    return analytics;
  } catch (error) {
    logger.error('Failed to get service analytics', { error, clinicId });
    throw new Error('Unable to fetch service analytics');
  }
}

/**
 * Check service availability
 */
export async function checkServiceAvailability(serviceId: string, clinicId: string): Promise<ServiceAvailability> {
  try {
    const service = await serviceRepository.findServiceById(prisma, serviceId, clinicId);

    if (!service) {
      throw new Error('Service not found');
    }

    if (service.clinicId !== clinicId) {
      throw new Error('Service does not belong to this clinic');
    }

    // Get recent appointments to estimate wait time
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usageStats = await serviceRepository.getUsageStats(prisma, serviceId, {
      from: thirtyDaysAgo,
      to: new Date()
    });

    // Estimate wait days based on demand
    const appointmentsPerDay = usageStats.totalAppointments / 30;
    const estimatedWaitDays =
      appointmentsPerDay > 0
        ? Math.ceil(appointmentsPerDay / 5) // Assuming 5 slots per day
        : 0;

    return {
      id: serviceId,
      serviceName: service.serviceName,
      isAvailable: (service.isAvailable ?? false) && service.status === 'ACTIVE',
      estimatedWaitDays: estimatedWaitDays || undefined
    };
  } catch (error) {
    logger.error('Failed to check service availability', { error, serviceId, clinicId });
    throw error;
  }
}

/**
 * Validate service data
 */
export function validateServiceData(data: {
  serviceName?: string;
  price?: number;
  duration?: number;
}): ServiceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.serviceName !== undefined) {
    if (data.serviceName.trim().length < 2) {
      errors.push('Service name must be at least 2 characters long');
    }
    if (data.serviceName.trim().length > 100) {
      errors.push('Service name must not exceed 100 characters');
    }
  }

  if (data.price !== undefined) {
    if (data.price <= 0) {
      errors.push('Price must be greater than 0');
    }
    if (data.price > 1_000_000) {
      warnings.push('Price is unusually high. Please verify.');
    }
  }

  if (data.duration !== undefined) {
    if (data.duration <= 0) {
      errors.push('Duration must be greater than 0');
    }
    if (data.duration > 480) {
      warnings.push('Duration exceeds 8 hours. Please verify.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Invalidate service caches
 */
async function invalidateServiceCaches(clinicId?: string, serviceId?: string) {
  try {
    const patterns: string[] = [];

    if (serviceId) {
      patterns.push(`${SERVICE_CACHE_PREFIX}${serviceId}`);
    }

    if (clinicId) {
      patterns.push(`services:*${clinicId}*`);
      patterns.push(`analytics:services:${clinicId}:*`);
    }

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    logger.debug('Service caches invalidated', {
      serviceId,
      clinicId,
      patterns
    });
  } catch (error) {
    logger.error('Failed to invalidate service caches', { error, serviceId, clinicId });
  }
}

// ==================== EXPORTS ====================

export const serviceService = {
  getById: getServiceById,
  getServices,
  create: createService,
  update: updateService,
  delete: deleteService,
  restore: restoreService,
  getAnalytics: getServiceAnalytics,
  checkAvailability: checkServiceAvailability,
  validate: validateServiceData
};

export type ServiceService = typeof serviceService;
