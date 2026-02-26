// packages/db/src/repositories/service.repo.ts

import type Decimal from 'decimal.js';

import type { Prisma, PrismaClient } from '../../generated/client';
import type { ServiceCategory, Status } from '../types';
import type { ServiceFilters } from '../zodSchemas';

/**
 * 🔷 SERVICE REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

export interface ServiceCreateInput {
  category?: ServiceCategory;
  clinicId?: string;
  color?: string;
  description: string;
  duration?: number;
  icon?: string;
  id: string;
  isAvailable?: boolean;
  price: Decimal;
  serviceName: string;
  status?: Status; // Added status to input
}

export interface ServiceUpdateInput {
  category?: ServiceCategory;
  color?: string;
  description: string;
  duration?: number;
  icon?: string;
  isAvailable?: boolean;
  price: Decimal;
  serviceName: string;
  status?: Status; // Added status to input
}

// ==================== READ OPERATIONS ====================

export async function findServices(db: PrismaClient, clinicId: string) {
  return db.service.findMany({
    where: { clinicId, isDeleted: false },
    orderBy: { serviceName: 'asc' }
  });
}
export async function findRecentServices(db: PrismaClient, clinicId: string, limit: number, offset: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return db.service.findMany({
    where: { clinicId, isDeleted: false, appointments: { some: { appointmentDate: { gte: today } } } },
    orderBy: { serviceName: 'asc' },
    take: limit,
    skip: offset
  });
}

export async function countServices(db: PrismaClient, clinicId: string) {
  return db.service.count({
    where: { clinicId, isDeleted: false }
  });
}

export async function findById(db: PrismaClient, id: string, clinicId: string) {
  return db.service.findFirst({
    where: { id, clinicId, isDeleted: false }
  });
}

export async function checkNameExists(
  db: PrismaClient,
  clinicId: string | undefined,
  name: string,
  excludeId?: string
) {
  const count = await db.service.count({
    where: {
      ...(clinicId ? { clinicId } : {}),
      serviceName: { equals: name, mode: 'insensitive' },
      id: excludeId ? { not: excludeId } : undefined,
      isDeleted: false
    }
  });
  return count > 0;
}

export async function getUsageStats(db: PrismaClient, serviceId: string, dateRange?: { from: Date; to: Date }) {
  const where = {
    serviceId,
    isDeleted: false,
    ...(dateRange
      ? {
          appointmentDate: {
            gte: dateRange.from,
            lte: dateRange.to
          }
        }
      : {})
  };

  const [totalAppointments, completedAppointments, revenue] = await Promise.all([
    db.appointment.count({ where }),
    db.appointment.count({ where: { ...where, status: 'COMPLETED' } }),
    db.appointment.aggregate({
      where: { ...where, status: 'COMPLETED' },
      _sum: { appointmentPrice: true }
    })
  ]);

  return {
    appointmentsCount: totalAppointments, // Keep for backward compatibility if needed
    lastUsed: new Date(), // Placeholder
    totalAppointments,
    completedAppointments,
    totalRevenue: revenue._sum.appointmentPrice?.toNumber() || 0,
    completionRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0
  };
}

export async function findServiceById(db: PrismaClient, id: string, clinicId?: string) {
  return db.service.findFirst({
    where: {
      id,
      ...(clinicId ? { clinicId } : {}),
      isDeleted: false
    },
    select: {
      id: true,
      serviceName: true,
      description: true,
      price: true,
      isAvailable: true,
      clinicId: true,
      category: true,
      duration: true,
      icon: true,
      color: true,
      status: true, // Added status
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function findServicesWithUsage(db: PrismaClient, clinicId: string) {
  return db.service.findMany({
    where: { clinicId, isDeleted: false },
    include: {
      appointments: {
        where: { isDeleted: false },
        select: {
          id: true,
          appointmentDate: true,
          status: true
        },
        take: 5
      }
    },
    take: 10,
    orderBy: { serviceName: 'asc' }
  });
}

export async function countAppointmentsByService(db: PrismaClient, serviceId: string, clinicId: string) {
  return db.appointment.count({
    where: {
      serviceId,
      clinicId,
      isDeleted: false,
      status: { not: 'CANCELLED' }
    }
  });
}

export async function countBillsByService(db: PrismaClient, serviceId: string, clinicId: string) {
  return db.patientBill.count({
    where: {
      serviceId,
      payment: {
        clinicId,
        isDeleted: false
      }
    }
  });
}

export async function checkServiceInUse(db: PrismaClient, serviceId: string) {
  return db.appointment.count({
    where: {
      serviceId,
      status: { not: 'CANCELLED' },
      isDeleted: false
    }
  });
}

export async function findServiceByName(db: PrismaClient, name: string, clinicId: string) {
  return db.service.findFirst({
    where: {
      serviceName: { equals: name, mode: 'insensitive' },
      clinicId,
      isDeleted: false
    }
  });
}

// ==================== CREATE OPERATIONS ====================

export async function createService(db: PrismaClient, data: ServiceCreateInput) {
  return db.service.create({
    data: {
      ...data,
      status: data.status || 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
}

// ==================== UPDATE OPERATIONS ====================

export async function updateService(
  db: PrismaClient,
  id: string,
  clinicId: string,
  data: ServiceUpdateInput & { updatedAt: Date }
) {
  return db.service.update({
    where: {
      id,
      clinicId
    },
    data: {
      ...data,
      status: data.status
    }
  });
}

export async function softDeleteService(
  db: PrismaClient,
  id: string,
  clinicId: string,
  data: {
    isDeleted: boolean;
    isAvailable?: boolean;
    deletedAt: Date | null;
    updatedAt: Date;
  }
) {
  return db.service.update({
    where: {
      id,
      clinicId
    },
    data,
    select: {
      id: true,
      serviceName: true,
      isDeleted: true,
      deletedAt: true
    }
  });
}

export async function restoreService(db: PrismaClient, id: string) {
  return db.service.update({
    where: {
      id
    },
    data: {
      isDeleted: false,
      deletedAt: null,
      updatedAt: new Date()
    }
  });
}

// ==================== DELETE OPERATIONS ====================

export async function deleteService(db: PrismaClient, id: string, clinicId: string) {
  return db.service.delete({
    where: {
      id,
      clinicId
    },
    select: {
      id: true,
      serviceName: true,
      clinicId: true
    }
  });
}

// ==================== NEW FUNCTIONS FOR SERVICE LAYER ====================

export async function findWithFilters(db: PrismaClient, filters: ServiceFilters & { clinicId?: string }) {
  const where: Prisma.ServiceWhereInput = {
    ...(filters.clinicId ? { clinicId: filters.clinicId } : {}),
    isDeleted: false
  } as Prisma.ServiceWhereInput;
  if (filters.category) where.category = filters.category as ServiceCategory;
  if (filters.search) where.serviceName = { contains: filters.search, mode: 'insensitive' };
  if (filters.minPrice) where.price = { gte: filters.minPrice };
  if (filters.maxPrice) where.price = { lte: filters.maxPrice };
  if (filters.isAvailable !== undefined) where.isAvailable = filters.isAvailable;

  return db.service.findMany({
    where,
    skip: filters.pagination?.offset || 0,
    take: filters.pagination?.limit || 20,
    orderBy:
      filters.pagination?.sortBy && typeof filters.pagination.sortBy === 'string'
        ? { [filters.pagination.sortBy]: (filters.pagination.sortOrder as Prisma.SortOrder) || 'asc' }
        : { createdAt: 'desc' }
  });
}

export async function count(db: PrismaClient, filters: ServiceFilters & { clinicId?: string }) {
  const where: Prisma.ServiceWhereInput = {
    ...(filters.clinicId ? { clinicId: filters.clinicId } : {}),
    isDeleted: false
  } as Prisma.ServiceWhereInput;
  if (filters.category) where.category = filters.category as ServiceCategory;
  if (filters.search) where.serviceName = { contains: filters.search, mode: 'insensitive' };
  if (filters.minPrice) where.price = { gte: filters.minPrice };
  if (filters.maxPrice) where.price = { lte: filters.maxPrice };
  if (filters.isAvailable !== undefined) where.isAvailable = filters.isAvailable;

  return db.service.count({ where });
}

export async function exists(db: PrismaClient, id: string) {
  const count = await db.service.count({ where: { id, isDeleted: false } });
  return count > 0;
}

export async function permanentDelete(db: PrismaClient, id: string) {
  return db.service.delete({ where: { id } });
}

export async function getStats(db: PrismaClient, clinicId: string) {
  return db.service.aggregate({
    where: { clinicId, isDeleted: false },
    _count: true,
    _avg: { price: true },
    _min: { price: true },
    _max: { price: true }
  });
}

export async function getCategoryStats(db: PrismaClient, clinicId: string) {
  return db.service.groupBy({
    by: ['category'],
    where: { clinicId, isDeleted: false },
    _count: true,
    _avg: { price: true }
  });
}

// Aliases to match service usage
export const softDelete = softDeleteService;
export const create = createService;
export const update = updateService;
export const restore = restoreService;
export const findByClinic = findServices;
export const findByIdWithRelations = findServiceById;
export const findWithUsage = findServicesWithUsage;
