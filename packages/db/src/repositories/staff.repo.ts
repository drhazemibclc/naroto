import type { PrismaClient } from '../../generated/client';
import type { Status, UserRole } from '../types';

/**
 * 🔷 STAFF REPOSITORY
 * - ONLY raw Prisma queries
 * - NO business logic
 * - NO date calculations
 * - NO dedupeQuery
 */

export interface StaffCreateInput {
  address: string;
  clinicId: string;
  colorCode?: string | null;
  department?: string;
  email?: string;
  hireDate?: Date | null;
  id: string;
  img?: string | null;
  name: string;
  phone?: string;
  role: UserRole;
  status?: Status | null;
  userId?: string;
}

// ==================== READ OPERATIONS ====================

export async function findStaffList(db: PrismaClient, clinicId: string) {
  return db.staff.findMany({
    where: { clinicId, deletedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      department: true,
      status: true,
      hireDate: true,
      img: true,
      colorCode: true,
      userId: true,
      role: true
    }
  });
}

export async function findStaffById(db: PrismaClient, id: string, clinicId: string) {
  return db.staff.findUnique({
    where: {
      id,
      clinicId,
      deletedAt: null
    }
  });
}

export async function findStaffByEmail(db: PrismaClient, email: string, clinicId: string) {
  return db.staff.findFirst({
    where: { email, clinicId, deletedAt: null }
  });
}

// ==================== CREATE OPERATIONS ====================

export async function createStaff(db: PrismaClient, data: StaffCreateInput & { createdAt: Date; updatedAt: Date }) {
  return db.staff.create({
    data
  });
}

// ==================== UPDATE OPERATIONS ====================

export async function archiveStaff(db: PrismaClient, id: string, clinicId: string, data: { deletedAt: Date }) {
  return db.staff.update({
    where: { id, clinicId },
    data
  });
}

export async function updateStaff(
  db: PrismaClient,
  id: string,
  clinicId: string,
  data: Partial<StaffCreateInput> & { updatedAt: Date }
) {
  return db.staff.update({
    where: { id, clinicId },
    data
  });
}

export async function updateStaffStatus(
  db: PrismaClient,
  id: string,
  clinicId: string,
  status: Status,
  reason?: string
) {
  return db.staff.update({
    where: { id, clinicId },
    data: { status, updatedAt: new Date(), ...(reason ? { statusReason: reason } : {}) }
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
// ==================== DELETE OPERATIONS ====================

export async function deleteStaff(db: PrismaClient, id: string, clinicId: string) {
  return db.staff.delete({
    where: { id, clinicId }
  });
}
