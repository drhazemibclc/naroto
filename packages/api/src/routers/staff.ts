// server/api/routers/staff.ts

import { auth } from '@naroto/auth';
import type { Prisma } from '@naroto/db';
import { staffCreateSchema, staffUpdateSchema } from '@naroto/db/schemas/admin.schema';
import { generateRandomColor } from '@naroto/db/utils/index';
import { TRPCError } from '@trpc/server';
import { headers } from 'next/headers';
import z from 'zod';

import { adminProcedure, createTRPCRouter, publicProcedure } from '..';

const GetAllStaffSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  search: z.string().optional().default('')
});

const createStaff = staffCreateSchema.extend({
  password: z.string()
});

export const staffRouter = createTRPCRouter({
  // -----------------------------------------------------
  // 1. getAllStaff (Paginated List)
  // -----------------------------------------------------
  getAllStaff: publicProcedure.input(GetAllStaffSchema).query(async ({ ctx, input }) => {
    const { search, page, limit } = input;
    const offset = (page - 1) * limit;

    try {
      const where: Prisma.StaffWhereInput = search
        ? {
            OR: [{ name: { contains: search } }, { phone: { contains: search } }, { email: { contains: search } }]
          }
        : {};

      const [staffData, totalCount] = await Promise.all([
        ctx.db.staff.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        ctx.db.staff.count({ where })
      ]);
      return {
        data: staffData,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
      };
    } catch (error) {
      console.error('Error fetching staff records:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve staff records.'
      });
    }
  }),

  // -----------------------------------------------------
  // 2. createNewStaff
  // -----------------------------------------------------
  createNewStaff: adminProcedure.input(createStaff).mutation(async ({ input: data, ctx }) => {
    try {
      // 1. Create Auth User via Better Auth API
      const newUser = await auth.api.createUser({
        body: {
          email: data.email,
          password: data.password,
          name: data.name,
          role: 'staff',
          data: {
            role: data.role
          }
        },
        headers: await headers()
      });

      if (!newUser?.user?.id) {
        throw new Error('Auth user creation failed');
      }

      // 2. Create Staff Record linked to Auth ID
      await ctx.db.staff.create({
        data: {
          userId: newUser.user.id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          role: data.role,
          img: data.img,
          hireDate: data.hireDate,
          licenseNumber: data.licenseNumber,
          salary: data.salary,
          colorCode: generateRandomColor(),
          status: 'ACTIVE',
          address: data.address,
          department: data.department
        }
      });

      return { success: true, message: 'Staff member added successfully' };
    } catch (error) {
      console.error('[createNewStaff]', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to add staff member.'
      });
    }
  }),

  // -----------------------------------------------------
  // 3. updateStaff
  // -----------------------------------------------------
  updateStaff: adminProcedure.input(staffUpdateSchema).mutation(async ({ input, ctx }) => {
    try {
      const { id, ...data } = input;

      const updated = await ctx.db.staff.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      return { success: true, data: updated, error: true };
    } catch (error) {
      console.error('[updateStaff]', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update staff member.'
      });
    }
  }),

  // -----------------------------------------------------
  // 4. deleteStaff
  // -----------------------------------------------------
  deleteStaff: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    try {
      await ctx.db.staff.delete({
        where: { id: input.id }
      });

      return { success: true };
    } catch (error) {
      console.error('[deleteStaff]', error);

      if (error instanceof Error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Staff member not found or already deleted.'
        });
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete staff member.'
      });
    }
  }),

  // -----------------------------------------------------
  // 5. getStaffById
  // -----------------------------------------------------
  getStaffById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    try {
      const staff = await ctx.db.staff.findUnique({
        where: { id: input.id },
        include: {
          user: true,
          immunizations: true
        }
      });

      if (!staff) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Staff member not found.'
        });
      }

      return { success: true, data: staff };
    } catch (error) {
      console.error('[getStaffById]', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve staff member.'
      });
    }
  })
});
