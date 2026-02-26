import type { Prisma, PrismaClient } from '../../generated/client';
import type { Status, UserRole } from '../types';
import { toNumber } from '../utils';

/**
 * 🔷 STAFF REPOSITORY
 * - Pure data access layer
 * - Scoped by clinicId for multi-tenancy security
 */

export interface StaffCreateInput {
  address: string;
  clinicId: string;
  colorCode?: string | null;
  department?: string;
  email: string;
  hireDate?: Date | null;
  id: string;
  img?: string | null;
  licenseNumber?: string | null;
  name: string;
  phone?: string;
  role: UserRole;
  salary?: number | Prisma.Decimal;
  status?: Status | null;
  userId?: string;
}

// ==================== READ OPERATIONS ====================
export async function deleteAllForClinic(db: PrismaClient, clinicId: string) {
  const result = await db.staff.deleteMany({
    where: {
      clinicId
    }
  });
  return result.count;
}
export async function findStaffList(db: PrismaClient, clinicId: string) {
  return db.staff.findMany({
    where: { clinicId, deletedAt: null },
    orderBy: { name: 'asc' }
  });
}

export async function findStaffPaginated(
  db: PrismaClient,
  clinicId: string,
  params: { page: number; pageSize: number; search?: string }
) {
  const { page, pageSize, search } = params;
  const whereClause: Prisma.StaffWhereInput = {
    clinicId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { department: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {})
  };

  const [items, total] = await Promise.all([
    db.staff.findMany({
      where: whereClause,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' }
    }),
    db.staff.count({ where: whereClause })
  ]);

  return {
    items,
    total,
    totalPages: Math.ceil(total / pageSize),
    currentPage: page
  };
}

export async function findStaffById(db: PrismaClient, id: string, clinicId: string) {
  return db.staff.findFirst({
    where: {
      id,
      clinicId,
      deletedAt: null
    },
    include: {
      user: true // Useful for auth/role checks
    }
  });
}

export async function findStaffByEmail(db: PrismaClient, email: string, clinicId: string) {
  return db.staff.findFirst({
    where: { email, clinicId, deletedAt: null }
  });
}

export async function countActiveStaff(db: PrismaClient, clinicId: string) {
  return db.staff.count({
    where: {
      clinicId,
      deletedAt: null,
      status: 'ACTIVE'
    }
  });
}

/**
 * Check if a staff record exists (useful for validation before creation)
 */
export async function exists(db: PrismaClient, id: string, clinicId: string) {
  const count = await db.staff.count({
    where: { id, clinicId, deletedAt: null }
  });
  return count > 0;
}

// ==================== CREATE OPERATIONS ====================

export async function createStaff(db: PrismaClient, data: StaffCreateInput & { createdAt: Date; updatedAt: Date }) {
  return db.staff.create({
    data: {
      ...data,
      salary: data.salary ? toNumber(data.salary) : undefined
    }
  });
}

// ==================== UPDATE OPERATIONS ====================

export async function updateStaff(
  db: PrismaClient,
  id: string,
  clinicId: string,
  data: Partial<Omit<StaffCreateInput, 'id' | 'clinicId' | 'userId'>> & { updatedAt: Date }
) {
  return db.staff.update({
    where: { id, clinicId },
    data: {
      ...data,
      salary: data.salary ? toNumber(data.salary) : undefined
    }
  });
}

export async function updateStaffStatus(db: PrismaClient, id: string, clinicId: string, status: Status) {
  return db.staff.update({
    where: { id, clinicId },
    data: {
      status,
      updatedAt: new Date()
    }
  });
}

// ==================== DELETE / ARCHIVE OPERATIONS ====================

/**
 * Soft delete (recommended for medical/clinic data integrity)
 */
export async function archiveStaff(db: PrismaClient, id: string, clinicId: string) {
  return db.staff.update({
    where: { id, clinicId },
    data: {
      deletedAt: new Date(),
      status: 'INACTIVE' // Usually archive implies inactive
    }
  });
}

/**
 * Hard delete (use with caution)
 */
export async function deleteStaff(db: PrismaClient, id: string, clinicId: string) {
  return db.staff.delete({
    where: { id, clinicId }
  });
}

/**
 * Bulk delete/archive for multiple IDs
 */
export async function bulkArchiveStaff(db: PrismaClient, ids: string[], clinicId: string) {
  return db.staff.updateMany({
    where: {
      id: { in: ids },
      clinicId
    },
    data: {
      deletedAt: new Date(),
      status: 'INACTIVE'
    }
  });
}
