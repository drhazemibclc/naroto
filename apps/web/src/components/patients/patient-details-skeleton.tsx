// src/components/patients/patient-details-skeleton.tsx
'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export function PatientDetailsSkeleton() {
  return (
    <div className='p-4 md:p-8'>
      <div className='mb-6 flex items-center gap-4'>
        <Skeleton className='h-10 w-10' />
        <Skeleton className='h-8 w-40' />
      </div>

      <div className='grid gap-6 lg:grid-cols-3'>
        <div className='space-y-6 lg:col-span-2'>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-6 w-40' />
            </CardHeader>
            <CardContent>
              <div className='flex items-start gap-6'>
                <Skeleton className='h-20 w-20 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-7 w-48' />
                  <Skeleton className='h-5 w-32' />
                  <div className='mt-4 flex gap-4'>
                    <Skeleton className='h-4 w-24' />
                    <Skeleton className='h-4 w-32' />
                  </div>
                </div>
              </div>
              <Separator className='my-6' />
              <div className='grid gap-4 sm:grid-cols-2'>
                <Skeleton className='h-12 w-full' />
                <Skeleton className='h-12 w-full' />
                <Skeleton className='h-12 w-full' />
                <Skeleton className='h-12 w-full' />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className='h-6 w-40' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-20 w-full' />
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <Skeleton className='h-6 w-32' />
            </CardHeader>
            <CardContent className='space-y-3'>
              <Skeleton className='h-8 w-full' />
              <Skeleton className='h-8 w-full' />
              <Skeleton className='h-8 w-full' />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className='h-6 w-32' />
            </CardHeader>
            <CardContent className='space-y-3'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className='h-6 w-32' />
            </CardHeader>
            <CardContent className='space-y-3'>
              <Skeleton className='h-8 w-full' />
              <Skeleton className='h-8 w-full' />
              <Skeleton className='h-8 w-full' />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
