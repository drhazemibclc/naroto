'use client';

import React, { useContext, useMemo } from 'react';

import { type authClient, useSession } from '../../lib/auth-client';

export type Session = typeof authClient.$Infer.Session;
export type User = Session['user'];

// ------------ CONTEXT ------------
type UserWithRole = User & { role: string };

export interface AuthSession {
  session: Session | null;
  user: UserWithRole | null;
}

const AuthContext = React.createContext<AuthSession | null>(null);

export function AuthProvider(props: React.PropsWithChildren<{ auth: AuthSession | null }>) {
  const { data: session } = useSession();

  const authState = useMemo<AuthSession>(() => {
    if (session) {
      return {
        user: session.user as UserWithRole,
        session
      };
    }
    return { user: null, session: null };
  }, [session]);

  return <AuthContext.Provider value={authState}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthSession {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
