import { auth, type Session } from '@naroto/auth';
import type { roles, UserRoles } from '@naroto/auth/roles';
import type { Clinic } from '@naroto/db';
import { prisma } from '@naroto/db';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { AUTH_ROUTES } from './routes';

interface AuthRedirectOptions {
  redirectTo?: string;
}

/**
 * Retrieves the current session without redirecting.
 *
 * Use this when you need to check authentication status without enforcing it,
 * such as conditionally rendering UI based on auth state or for optional
 * authentication scenarios.
 */
export const getSession = async (): Promise<Session | null> => {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  return session;
};

/**
 * Requires an authenticated session, redirecting to login if not found.
 *
 * Use this in Server Components or Server Actions that require authentication.
 * The function will redirect to the login page if no valid session exists,
 * so the return value is guaranteed to be a valid session.
 *
 * @returns The authenticated session (never `null` due to redirect).
 */
export const requireAuth = async (options: AuthRedirectOptions = {}): Promise<Session> => {
  const session = await getSession();
  const { redirectTo = AUTH_ROUTES.LOGIN } = options;

  if (!session) {
    redirect(redirectTo);
  }

  return session;
};
// Use the proper Better Auth session type that includes user
// Role checking utilities
export const checkRole = (session: BetterAuthSession, roleToCheck: UserRoles): boolean => {
  if (!session?.user?.role) {
    return false;
  }

  // Handle multiple roles (comma-separated)
  const userRoles = session.user.role.split(',').map((r: string) => r.trim().toLowerCase());
  return userRoles.includes(roleToCheck.toLowerCase());
};
export const getRole = (session: BetterAuthSession): UserRoles => {
  const roleString = session?.user?.role?.toLowerCase();

  if (!roleString) {
    return 'patient';
  }

  // Get first role if multiple roles exist
  const primaryRole = roleString.split(',')[0]?.trim();

  switch (primaryRole) {
    case 'admin':
    case 'doctor':
    case 'staff':
    case 'patient':
      return primaryRole as UserRoles;
    default:
      return 'patient';
  }
};

// Permission checking with Better Auth access control
export const hasPermission = // Server-side permission checking
  await auth.api.userHasPermission({
    body: {
      userId: 'user-id',
      permissions: {
        patients: ['create']
      }
    }
  });
// Optimized getter utilities
export const getUser = (session: BetterAuthSession) => session?.user ?? null;
export const getUserId = (session: BetterAuthSession) => session?.user?.id ?? null;
export const getUserEmail = (session: BetterAuthSession) => session?.user?.email ?? null;
export const getUserName = (session: BetterAuthSession) => session?.user?.name ?? null;
export const getUserRole = (session: BetterAuthSession) => session?.user?.role ?? null;

// Dashboard access control
export const canAccessDashboard = (session: BetterAuthSession): boolean => {
  const role = getRole(session);
  return ['admin', 'doctor', 'staff'].includes(role);
};
/**
 * Requires no authenticated session, redirecting away if one exists.
 *
 * Use this for pages that should only be accessible to unauthenticated users,
 * such as login, registration, or password reset pages.
 */
export const requireUnauth = async (options: AuthRedirectOptions = {}): Promise<void> => {
  const { redirectTo = AUTH_ROUTES.DASHBOARD } = options;

  const session = await getSession();

  if (session) {
    redirect(redirectTo);
  }
};

export type UserRole = keyof typeof roles;
export type Role = UserRole['toUpperCase'];
// Export UserRole type for React components
type BetterAuthSession = typeof auth.$Infer.Session | null;

type AuthInstance = typeof auth;
export const createServerRoleChecker = (auth: AuthInstance) => async (session: BetterAuthSession) => {
  if (!session?.user?.id) {
    return null;
  }

  const userRole = getRole(session);

  const [canManagePatients, canCreateAppointments, canViewRecords, canManageStaff] = await Promise.all([
    auth.api.userHasPermission({
      body: {
        role: userRole,
        permissions: { patients: ['update'] }
      }
    }),
    auth.api.userHasPermission({
      body: {
        role: userRole,
        permissions: { appointments: ['create'] }
      }
    }),
    auth.api.userHasPermission({
      body: {
        role: userRole,
        permissions: { records: ['read'] }
      }
    }),
    auth.api.userHasPermission({
      body: {
        role: userRole,
        permissions: { staff: ['update'] }
      }
    })
  ]);

  return {
    role: userRole,
    isAdmin: userRole === 'admin',
    isDoctor: userRole === 'doctor',
    isStaff: userRole === 'staff',
    isPatient: userRole === 'patient',
    canManagePatients,
    canCreateAppointments,
    canViewRecords,
    canManageStaff,

    hasPermission: async (permissions: Record<string, string[]>) => {
      return await auth.api.userHasPermission({
        body: {
          role: userRole,
          permissions
        }
      });
    }
  };
};

export const getCurrentClinic = async (): Promise<Pick<Clinic, 'id' | 'name'> | null> => {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user?.id) {
    return null;
  }

  return session.user.clinic || null;
};
export const getClinicFromHeaders = cache(async (headersList?: Headers) => {
  const headersResolved = headersList || (await headers());
  const clinicId = headersResolved.get('x-clinic-id');

  if (clinicId) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId, isDeleted: false },
      select: { id: true, name: true, timezone: true }
    });
    if (clinic) return clinic;
  }
  // Fallback to first clinic (development only)
  if (process.env.NODE_ENV === 'development') {
    const clinic = await prisma.clinic.findFirst({
      where: { isDeleted: false }
    });
    if (clinic) return clinic;
  }

  throw new Error('No clinic found');
});
