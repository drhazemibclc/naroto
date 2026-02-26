// src/components/patients/patient-history.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar, ChevronRight, FileText, Pill } from 'lucide-react';
import Link from 'next/link';
import { useId, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTRPC } from '@/trpc/client';

interface PatientHistoryProps {
  clinicId: string;
  limit?: number;
  patientId: string;
}

function AppointmentSkeleton() {
  return (
    <div className='flex items-center justify-between border-b py-3'>
      <div className='space-y-1'>
        <Skeleton className='h-4 w-24' />
        <Skeleton className='h-3 w-32' />
      </div>
      <Skeleton className='h-6 w-16' />
    </div>
  );
}

export function PatientHistory({ patientId, clinicId: _clinicId, limit: _limit = 5 }: PatientHistoryProps) {
  const trpc = useTRPC();

  const { data: stats, isLoading } = useQuery(trpc.patient.getDashboardStats.queryOptions({ id: patientId }));
  const baseId = useId();

  // 1. Generate stable IDs for the skeletons
  const skeletonIds = useMemo(
    () => Array.from({ length: 3 }, (_, i) => `${baseId}-appointment-skeleton-${i}`),
    [baseId]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Calendar className='h-4 w-4' />
            Recent Visits
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {' '}
          {/* Added spacing for better look */}
          {skeletonIds.map(id => (
            <AppointmentSkeleton key={id} />
          ))}
        </CardContent>
      </Card>
    );
  }

  const recentVisits = stats?.last5Records ?? [];
  const totalAppointments = stats?.totalAppointments ?? 0;
  const totalRecords = stats?.totalRecords ?? 0;
  const activePrescriptions = stats?.activePrescriptions ?? 0;

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Calendar className='h-4 w-4' />
            Recent Visits
          </CardTitle>
          <Button
            asChild
            size='sm'
            variant='ghost'
          >
            <Link href={`/dashboard/appointments?patientId=${patientId}`}>
              View All
              <ChevronRight className='ml-1 h-4 w-4' />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentVisits.length === 0 ? (
            <p className='py-4 text-center text-muted-foreground text-sm'>No appointments found</p>
          ) : (
            <div className='space-y-0'>
              {recentVisits.map(
                (visit: {
                  id: string;
                  appointmentDate: Date;
                  type?: string | null;
                  doctor?: { name: string; specialty: string };
                }) => (
                  <div
                    className='flex items-center justify-between border-b py-3 last:border-0'
                    key={visit.id}
                  >
                    <div>
                      <p className='font-medium text-sm'>{format(new Date(visit.appointmentDate), 'MMMM d, yyyy')}</p>
                      <p className='text-muted-foreground text-xs'>{visit.doctor?.name ?? visit.type ?? 'Visit'}</p>
                    </div>
                    <Button
                      asChild
                      size='sm'
                      variant='ghost'
                    >
                      <Link href={`/dashboard/appointments/${visit.id}`}>View</Link>
                    </Button>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className='grid gap-4 sm:grid-cols-3'>
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 font-normal text-sm'>
              <Calendar className='h-4 w-4' />
              Total Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='font-bold text-2xl'>{totalAppointments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 font-normal text-sm'>
              <FileText className='h-4 w-4' />
              Medical Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='font-bold text-2xl'>{totalRecords}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 font-normal text-sm'>
              <Pill className='h-4 w-4' />
              Active Rx
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='font-bold text-2xl'>{activePrescriptions}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
