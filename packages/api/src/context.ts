import { auth, type Session, type User } from '@naroto/auth';
import { prisma } from '@naroto/db';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

export type Context = {
  session: Session | null;
  user: User | null;
  clinicId?: string | undefined;
  db: unknown;
  headers: Headers;
};

export async function createContext(req: NextRequest): Promise<Context> {
  const session = (await auth.api.getSession({ headers: req.headers })) as Session | null;

  const user = (session?.user ?? null) as User | null;
  const clinicId = (user?.clinic?.id as string | undefined) ?? undefined;

  return {
    session,
    user,
    clinicId,
    db: prisma as unknown,
    headers: (await headers()) as Headers
  };
}
