'use client';

import { Activity, Calendar, FileText, History, Syringe, UserPlus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

export function QuickActions() {
  const { hasPermission, isPatient } = usePermissions();

  // 1. Define standard Clinical actions
  const staffActions = [
    {
      label: 'New Patient',
      href: '/dashboard/patients/new',
      icon: UserPlus,
      color: 'blue',
      permission: PERMISSIONS.PATIENTS.CREATE
    },
    {
      label: 'Book Appt.',
      href: '/dashboard/appointments/new',
      icon: Calendar,
      color: 'green',
      permission: PERMISSIONS.APPOINTMENTS.CREATE
    },
    {
      label: 'Medical Record',
      href: '/dashboard/medical-records/new',
      icon: FileText,
      color: 'purple',
      permission: PERMISSIONS.RECORDS.CREATE
    },
    {
      label: 'Vaccination',
      href: '/dashboard/immunizations/new',
      icon: Syringe,
      color: 'orange',
      permission: PERMISSIONS.IMMUNIZATION.CREATE
    }
  ];

  // 2. Define specific Patient actions
  const patientActions = [
    {
      label: 'My Schedule',
      href: '/dashboard/appointments',
      icon: Calendar,
      color: 'green',
      permission: PERMISSIONS.APPOINTMENTS.READ
    },
    {
      label: 'My Records',
      href: '/dashboard/medical-records',
      icon: History,
      color: 'blue',
      permission: PERMISSIONS.RECORDS.READ
    },
    {
      label: 'Growth Tracker',
      href: '/dashboard/growth',
      icon: Activity,
      color: 'pink',
      permission: PERMISSIONS.GROWTH.READ
    }
  ];

  // 3. Select list based on isPatient status
  const baseActions = isPatient ? patientActions : staffActions;

  // 4. Filter by permission (Ensure PERMISSIONS object matches better-auth shape)
  const visibleActions = baseActions.filter(action =>
    hasPermission(action.permission as unknown as Record<string, string[]>)
  );

  if (visibleActions.length === 0) return null;

  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
      {visibleActions.map(action => {
        const Icon = action.icon;

        // Dynamic tailwind classes for consistency
        const bgClass = `bg-${action.color}-500/10`;
        const textClass = `text-${action.color}-600`;

        return (
          <Button
            asChild
            className='h-auto flex-col gap-3 p-4 transition-all hover:border-primary/50 hover:bg-accent'
            key={action.href}
            variant='outline'
          >
            <Link href={action.href}>
              <div className={cn('rounded-full p-3', bgClass)}>
                <Icon className={cn('h-5 w-5', textClass)} />
              </div>
              <span className='text-center font-medium text-xs'>{action.label}</span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
