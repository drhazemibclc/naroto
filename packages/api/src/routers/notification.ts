import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '..';

const recentSchema = z.object({
  limit: z.number().min(1).max(50).default(10),
  cursor: z.string().optional()
});

const markAsReadSchema = z.object({
  id: z.string()
});

export const notificationsRouter = createTRPCRouter({
  /**
   * Get recent notifications
   */
  recent: protectedProcedure.input(recentSchema).query(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const { limit, cursor } = input;

    const notifications = await ctx.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined
    });

    let nextCursor: typeof cursor | undefined;
    if (notifications.length > limit) {
      const nextItem = notifications.pop();
      nextCursor = nextItem?.id;
    }

    return {
      items: notifications,
      nextCursor
    };
  }),

  /**
   * Get unread count
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const count = await ctx.db.notification.count({
      where: {
        userId,
        read: false
      }
    });

    return count;
  }),

  /**
   * Mark notification as read
   */
  markAsRead: protectedProcedure.input(markAsReadSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const { id } = input;

    await ctx.db.notification.update({
      where: {
        id,
        userId // Ensure ownership
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    return { success: true };
  }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;

    await ctx.db.notification.updateMany({
      where: {
        userId,
        read: false
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    return { success: true };
  }),

  /**
   * Delete notification
   */
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const { id } = input;

    await ctx.db.notification.delete({
      where: {
        id,
        userId // Ensure ownership
      }
    });

    return { success: true };
  })
});
