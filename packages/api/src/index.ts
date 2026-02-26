import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';

import type { CacheProfile } from './cache';
import { withCache } from './cache/utils/cache-strategy';
import type { Context } from './context';
import { enhancedErrorFormatter } from './utils/validation';

// Initialize tRPC with proper typing
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: enhancedErrorFormatter
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

export const procedure = t.procedure;
export const createTRPCRouter = t.router;
export const router = t.router;
/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);
const authMiddleware = t.middleware(({ next, ctx }) => {
  if (!(ctx.user && ctx.session)) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User session not found or expired'
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } });
});
const adminMiddleware = t.middleware(async ({ next, ctx }) => {
  const { user } = ctx;
  if (!user) {
    console.log('Admin middleware: No session found');
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }

  if (user.role !== 'admin') {
    console.log('Admin middleware: User is not admin, role:', user.role);
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required'
    });
  }

  return next({ ctx: { ...ctx, user } });
});

// export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(authMiddleware);
export const adminProcedure = t.procedure.use(adminMiddleware);

const clinicAccessMiddleware = t.middleware(async ({ ctx, next }) => {
  const userClinicId = ctx.user?.clinic?.id;
  const userId = ctx.user?.id;

  if (!(userClinicId && userId)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Clinic access required or user session missing'
    });
  }

  // Use the verified userId from context
  const clinicMember = await ctx.db.clinicMember.findFirst({
    where: {
      userId,
      clinicId: userClinicId
      // Ensure the member isn't deleted if you use soft deletes
    }
  });

  if (!clinicMember) {
    console.error(`Access Denied: User ${userId} is not a member of Clinic ${userClinicId}`);
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No access to this clinic'
    });
  }

  return next({
    ctx: {
      ...ctx,
      role: (clinicMember.role as string) || 'STAFF'
    }
  });
});

/**
 * Middleware factory for role-based access control
 */
const createRoleMiddleware = (allowedRoles: string[]) =>
  t.middleware(({ ctx, next }) => {
    const userRole = ctx.user?.role;

    if (!(userRole && allowedRoles.includes(userRole))) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`
      });
    }

    return next({
      ctx: {
        ...ctx,
        userRole
      }
    });
  });
/**
 * Cached procedure factory for pediatric data
 */
export const clinicProcedure = publicProcedure.use(authMiddleware).use(clinicAccessMiddleware);

// Role-specific procedures
export const doctorProcedure = clinicProcedure.use(createRoleMiddleware(['DOCTOR', 'ADMIN']));
export const staffProcedure = clinicProcedure.use(createRoleMiddleware(['STAFF', 'DOCTOR', 'ADMIN']));

// Cached procedures for pediatric data
export const cachedProcedure = (options: { profile: CacheProfile; tags: string[]; prefix?: string }) =>
  protectedProcedure.use(clinicAccessMiddleware).use(
    t.middleware(async ({ ctx, next, path, input: rawInput }) => {
      const { profile, tags, prefix } = options;

      const enhancedFn = withCache(
        async () => {
          return next({
            ctx: {
              ...ctx,
              _cache: {
                profile,
                tags: [...tags, `trpc:${path}`],
                prefix: prefix ?? '',
                input: rawInput
              }
            }
          });
        },
        {
          profile,
          tags: [...tags, `trpc:${path}`],
          prefix: prefix ?? ''
        }
      );

      return enhancedFn();
    })
  );

// Export t instance and router for convenience
export const { middleware } = t;
