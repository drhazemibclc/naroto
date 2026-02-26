// apps/web/src/app/(protected)/dashboard/appointments/page.tsx

import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getSession } from '@/lib/auth-server';
import { HydrateClient, prefetch } from '@/trpc/server';
import { trpc } from '@/utils/trpc';

import { AppointmentsClient } from './appointments-client';
import { AppointmentsSkeleton } from './components/appointments-skeleton';

export default async function AppointmentsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }

  // Prefetch appointments data
  void prefetch(
    trpc.appointment.list.queryOptions({
      page: 1,
      limit: 20
    })
  );

  return (
    <HydrateClient>
      <Suspense fallback={<AppointmentsSkeleton />}>
        <AppointmentsClient />
      </Suspense>
    </HydrateClient>
  );
}
