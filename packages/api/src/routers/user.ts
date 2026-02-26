import type { AnyRouter } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

export const userRouter: AnyRouter = createTRPCRouter({
  /**
   * Get current user
   */
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    return ctx.session?.user;
  }),

  /**
   * Get user's clinics
   */
  clinics: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const memberships = await ctx.db?.clinicMember.findMany({
      where: { userId },
      include: {
        clinic: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            logo: true,
            timezone: true
          }
        }
      }
    });

    return memberships.map(m => ({
      ...m.clinic,
      role: m.role
    }));
  }),

  /**
   * Get user profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    return user;
  }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        timezone: z.string().optional(),
        language: z.string().optional(),
        image: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const user = await ctx.db.user.update({
        where: { id: userId },
        data: input,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true
        }
      });

      return user;
    })
});
