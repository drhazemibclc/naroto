'use client';

import { TRPCReactProvider } from '@/trpc/client';

export default function TrpcProvider({ children }: { children: React.ReactNode }) {
  return <TRPCReactProvider>{children}</TRPCReactProvider>;
}
