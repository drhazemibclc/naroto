// packages/db/src/services/staff.service.ts

import { prisma } from '../client';
import type { StaffCreateInput } from '../repositories/staff.repo';
import * as staffRepo from '../repositories/staff.repo';
import { generateRandomColor } from '../utils/index';

export class StaffService {
  constructor(private readonly db = prisma) {}

  /**
   * Get all staff for a specific clinic
   */
  async getAllStaff(clinicId: string, params: { search?: string; page: number; limit: number }) {
    const result = await staffRepo.findStaffPaginated(this.db, clinicId, {
      page: params.page,
      pageSize: params.limit,
      search: params.search
    });

    return {
      data: result.items,
      totalRecords: result.total,
      totalPages: result.totalPages,
      currentPage: params.page
    };
  }

  /**
   * Create staff record (Auth user must be created in the router/caller first)
   */
  async createStaff(clinicId: string, input: StaffCreateInput) {
    // We assume input already contains the userId created by the Auth layer
    return staffRepo.createStaff(this.db, {
      ...input,
      clinicId,
      id: input.id || crypto.randomUUID(),
      colorCode: input.colorCode || generateRandomColor(),
      status: input.status || 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Get staff by ID scoped to clinic
   */
  async getStaffById(id: string, clinicId: string) {
    const staff = await staffRepo.findStaffById(this.db, id, clinicId);
    if (!staff) throw new Error('Staff member not found');
    return staff;
  }

  /**
   * Update staff record scoped to clinic
   */
  async updateStaff(id: string, clinicId: string, data: Partial<StaffCreateInput>) {
    return staffRepo.updateStaff(this.db, id, clinicId, {
      ...data,
      updatedAt: new Date()
    });
  }

  /**
   * Delete staff record scoped to clinic
   */
  async deleteStaff(id: string, clinicId: string) {
    return staffRepo.deleteStaff(this.db, id, clinicId);
  }
}

export const staffService = new StaffService();
