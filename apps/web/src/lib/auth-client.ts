'use client';

import { passkeyClient } from '@better-auth/passkey/client';
import type { auth } from '@naroto/auth';
import { ac, roles } from '@naroto/auth/roles';
import { adminClient, customSessionClient, inferAdditionalFields, magicLinkClient } from 'better-auth/client/plugins';
import type { AccessControl } from 'better-auth/plugins';
import { createAuthClient } from 'better-auth/react';

export type UserRoles = 'ADMIN' | 'DOCTOR' | 'STAFF' | 'PATIENT';

// build the plugin separately so we can cast `ac`
const adminPlugin = adminClient({
  ac: ac as unknown as AccessControl,
  roles // This is crucial - pass your custom roles
});

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  fetchOptions: {
    onError: ctx => {
      const err = ctx.error;
      console.error('❌ Auth error:', err);

      // Only redirect if status is 401
      if (err && typeof err === 'object' && 'status' in err && err.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
    onSuccess: ctx => {
      console.log('✅ Auth request succeeded:', ctx.response?.url ?? 'unknown URL');
    }
  },

  plugins: [
    magicLinkClient(),
    passkeyClient(),
    inferAdditionalFields<typeof auth>(),
    customSessionClient<typeof auth>(),
    adminPlugin
  ]
});

// Extract hooks and functions
export const { useSession } = authClient;
export const {
  signIn,
  signOut,
  signUp,
  updateUser,
  changePassword,
  changeEmail,
  deleteUser,
  revokeSession,
  resetPassword,
  linkSocial,
  listAccounts,
  listSessions,
  revokeOtherSessions,
  revokeSessions
} = authClient;

// Custom auth hook
export function useAuth() {
  const { data: session, isPending, error } = useSession();

  const status = isPending ? 'loading' : session ? 'authenticated' : 'unauthenticated';

  return {
    error,
    isAuthenticated: status === 'authenticated',
    isLoading: isPending,
    session: session ?? null,
    status,
    role: session?.user.role,
    user: session?.user ?? null
  };
}

// Permission checker utility
export const createPermissionChecker = (client: typeof authClient) => ({
  hasPermission: (permissions: Record<string, string[]>, role: UserRoles) => {
    return client.admin.checkRolePermission({
      permissions,
      role: role.toLowerCase()
    } as Parameters<typeof client.admin.checkRolePermission>[0]);
  }
});
export type Session = typeof authClient.$Infer.Session;
