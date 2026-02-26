// components/dev/auth-bypass.tsx
'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { User } from '../providers/auth-provider';

declare global {
  interface Window {
    __MOCK_AUTH__?: {
      enabled: boolean;
      user: User | null;
    };
  }
}

export function DevAuthBypass() {
  const [isEnabled, setIsEnabled] = useState(typeof window !== 'undefined' && window.__MOCK_AUTH__?.enabled);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const toggleMockAuth = () => {
    if (typeof window !== 'undefined') {
      if (window.__MOCK_AUTH__) {
        window.__MOCK_AUTH__.enabled = !window.__MOCK_AUTH__.enabled;
      } else {
        window.__MOCK_AUTH__ = {
          enabled: true,
          user: {
            id: 'test-user-1',
            name: 'Test Doctor',
            email: 'doctor@test.com',
            role: 'doctor',
            clinic: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            emailVerified: false
          }
        };
      }
      setIsEnabled(window.__MOCK_AUTH__.enabled);
      window.location.reload();
    }
  };

  return (
    <div className='fixed right-4 bottom-4 z-50'>
      <Card className='w-80 shadow-lg'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm'>Dev Tools</CardTitle>
          <CardDescription className='text-xs'>Mock authentication for testing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-between'>
            <span className='text-sm'>Mock Auth: {isEnabled ? '✅ Enabled' : '❌ Disabled'}</span>
            <Button
              onClick={toggleMockAuth}
              size='sm'
              variant={isEnabled ? 'destructive' : 'default'}
            >
              {isEnabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
