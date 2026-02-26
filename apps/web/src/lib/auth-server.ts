import { auth, type Role, type Session } from '@naroto/auth';
import { headers } from 'next/headers';

export async function getSession() {
  const h = await headers();
  return auth.api.getSession({
    headers: h
  });
}

export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}

export const checkRole = async (role: Role) => {
  const session = await getSession();
  return session?.user.role === role.toLowerCase();
};

export const getRole = (session: Session): Role => {
  const role = (session?.user.role?.toUpperCase() as Role) || 'PATIENT';

  return role;
};

// Permission checking with Better Auth access control
export const hasPermission = async (): Promise<boolean> => {
  const result = await auth.api.userHasPermission({
    body: {
      permissions: {
        patients: ['create']
      },
      role: 'patient'
    }
  });
  return result.success;
};
// Optimized getter utilities
export const getUserId = (session: Session) => session?.user?.id ?? null;
export const getUserEmail = (session: Session) => session?.user?.email ?? null;
export const getUserName = (session: Session) => session?.user?.name ?? null;
export const getUserRole = (session: Session) => session?.user?.role ?? null;

// Dashboard access control
export const canAccessDashboard = (session: Session): boolean => {
  const role = getRole(session);
  return ['admin', 'doctor', 'staff', 'patient'].includes(role);
};
