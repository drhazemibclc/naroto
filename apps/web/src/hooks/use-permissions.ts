// hooks/use-permissions.ts
'use client';

import { authClient, type UserRoles, useSession } from '@/lib/auth-client';

export function usePermissions() {
  const { data: session } = useSession();

  const hasPermission = (permissions: Record<string, string[]>) => {
    if (!session?.user?.role) return false;

    const userRole = session.user.role.toLowerCase() as Parameters<
      typeof authClient.admin.checkRolePermission
    >[0]['role'];

    // Use Better Auth's checkRolePermission to verify permissions client-side
    try {
      return authClient.admin.checkRolePermission({
        permissions,
        role: userRole
      });
    } catch (error) {
      console.warn('Permission check failed:', error);
      return false;
    }
  };

  const hasAnyPermission = (permissionsList: Record<string, string[]>[]) => {
    return permissionsList.some(permissions => hasPermission(permissions));
  };

  const hasAllPermissions = (permissionsList: Record<string, string[]>[]) => {
    return permissionsList.every(permissions => hasPermission(permissions));
  };

  const getUserRole = (): UserRoles | null => {
    if (!session?.user?.role) return null;
    return session.user.role.toUpperCase() as UserRoles;
  };

  const isRole = (role: UserRoles) => {
    const userRole = getUserRole();
    return userRole === role;
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getUserRole,
    isRole,
    user: session?.user,
    isAuthenticated: !!session?.user,
    // Convenience role checks
    isAdmin: isRole('ADMIN'),
    isDoctor: isRole('DOCTOR'),
    isStaff: isRole('STAFF'),
    isPatient: isRole('PATIENT')
  };
}
