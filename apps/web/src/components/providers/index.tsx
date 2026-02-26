import type { PropsWithChildren } from 'react';
import { Suspense } from 'react';

import { AuthProvider } from '@/components/providers/auth-provider';
import ThemeProvider from '@/components/providers/theme-provider';

import { ThemeToastContainer } from './toast-container';
import TrpcProvider from './trpc-provider';

type TRootProvider = PropsWithChildren;

function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthProvider auth={{ user: null, session: null }}>{children}</AuthProvider>
    </Suspense>
  );
}

function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ThemeProvider>{children}</ThemeProvider>
    </Suspense>
  );
}

export default function RootProvider({ children }: Readonly<TRootProvider>) {
  return (
    <TrpcProvider>
      <AuthProviderWrapper>
        <ThemeProviderWrapper>
          {children}
          <ThemeToastContainer />
        </ThemeProviderWrapper>
      </AuthProviderWrapper>
    </TrpcProvider>
  );
}
