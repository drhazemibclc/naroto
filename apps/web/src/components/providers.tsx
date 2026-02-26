'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Suspense, useEffect, useState } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/utils/trpc';

import ThemeProvider from './theme-provider';

// Loading component for suspense
function ProvidersLoading() {
  return (
    <div className='fixed inset-0 flex items-center justify-center bg-background'>
      <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
    </div>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <ProvidersLoading />;
  }

  return (
    <Suspense fallback={<ProvidersLoading />}>
      <ThemeProvider
        attribute='class'
        defaultTheme='system'
        disableTransitionOnChange
        enableSystem
        storageKey='pediatric-clinic-theme'
      >
        <TooltipProvider
          delayDuration={300}
          skipDelayDuration={500}
        >
          <QueryClientProvider client={queryClient}>
            {children}
            {process.env.NODE_ENV === 'development' && <ReactQueryDevtools buttonPosition='bottom-right' />}
          </QueryClientProvider>
        </TooltipProvider>

        {/* Toast notifications */}
        <Toaster
          closeButton
          duration={4000}
          expand={true}
          position='top-right'
          richColors
        />
      </ThemeProvider>
    </Suspense>
  );
}
