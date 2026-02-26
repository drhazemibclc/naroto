// components/home/dev-ascii-art.tsx
'use client';

import { Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export const TITLE_TEXT = `
 ██████╗ ███████╗██████╗ ██╗ █████╗  ██████╗ █████╗ ██████╗ ███████╗
 ██╔══██╗██╔════╝██╔══██╗██║██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝
 ██████╔╝█████╗  ██║  ██╝██║███████║██║     ███████║██████╔╝█████╗
 ██╔═══╝ ██╔══╝  ██║  ██╗██║██╔══██║██║     ██╔══██║██╔══██╗██╔══╝
 ██║     ███████╗███████║██║██║  ██║╚██████╗██║  ██║██║  ██║███████╗
 ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝

 ██╗  ██╗███████╗ █████╗ ██╗     ████████╗██╗  ██╗     ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗
 ██║  ██║██╔════╝██╔══██╗██║     ╚══██╔══╝██║  ██║    ██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝
 ███████║█████╗  ███████║██║        ██║   ███████║    ██║     ███████║█████╗  ██║     █████╔╝
 ██╔══██║██╔══╝  ██╔══██║██║        ██║   ██╔══██║    ██║     ██╔══██║██╔══╝  ██║     ██╔═██╗
 ██║  ██║███████╗██║  ██║███████╗   ██║   ██║  ██║    ╚██████╗██║  ██║███████╗╚██████╗██║  ██╗
 ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝     ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝
`;

const SYSTEM_INFO = `
System Status: ONLINE
Environment: ${typeof process !== 'undefined' && process.env?.NODE_ENV ? process.env.NODE_ENV : 'production'}
Version: ${typeof process !== 'undefined' && process.env?.npm_package_version ? process.env.npm_package_version : '1.0.0'}
Node: ${typeof process !== 'undefined' && process.version ? process.version : 'v20.0.0'}
Platform: ${typeof process !== 'undefined' && process.platform ? process.platform : 'web'}
`;

export function DevAsciiArt() {
  const [showAscii, setShowAscii] = useState(false);
  const [showSystemInfo, setShowSystemInfo] = useState(false);

  // All hooks must be called unconditionally - moved before any returns
  useEffect(() => {
    // Only set up the event listener if in development
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    let count = 0;
    let timer: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~') {
        count++;
        clearTimeout(timer);
        timer = setTimeout(() => {
          count = 0;
        }, 1000);

        if (count === 3) {
          setShowAscii(prev => !prev);
          count = 0;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, []); // Empty dependency array - only run once on mount

  // Don't render anything in production
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!showAscii) {
    return null;
  }

  return (
    <div className='fixed inset-x-0 top-0 z-50 p-4'>
      <Alert className='mx-auto max-w-4xl border-2 border-primary bg-background/95 backdrop-blur'>
        <Terminal className='h-4 w-4' />
        <AlertTitle className='flex items-center justify-between'>
          <span>Developer Console</span>
          <div className='flex gap-2'>
            <Button
              onClick={() => setShowSystemInfo(!showSystemInfo)}
              size='sm'
              variant='ghost'
            >
              {showSystemInfo ? 'Hide Info' : 'Show Info'}
            </Button>
            <Button
              onClick={() => setShowAscii(false)}
              size='sm'
              variant='ghost'
            >
              Close
            </Button>
          </div>
        </AlertTitle>
        <AlertDescription>
          <div className='mt-4 space-y-4'>
            <pre className='overflow-x-auto rounded-lg bg-muted p-4 font-mono text-primary text-xs'>{TITLE_TEXT}</pre>

            {showSystemInfo && (
              <pre className='overflow-x-auto rounded-lg bg-muted p-4 font-mono text-muted-foreground text-xs'>
                {SYSTEM_INFO}
              </pre>
            )}

            <div className='flex gap-2 text-muted-foreground text-xs'>
              <span className='rounded-full bg-green-100 px-2 py-1 text-green-700 dark:bg-green-900 dark:text-green-300'>
                API: Connected
              </span>
              <span className='rounded-full bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-900 dark:text-blue-300'>
                DB: Operational
              </span>
              <span className='rounded-full bg-yellow-100 px-2 py-1 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'>
                Cache: 85%
              </span>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
