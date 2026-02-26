// components/home/quick-actions.tsx
'use client';

import { Activity, Calendar, FileText, Pill, Syringe, UserPlus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions/constants';

export function QuickActions() {
  const { hasPermission } = usePermissions();

  // Define actions with their required permissions
  const actions = [
    {
      label: 'New Patient',
      href: '/dashboard/patients/new',
      icon: UserPlus,
      color: 'bg-blue-500',
      permission: PERMISSIONS.PATIENT.CREATE
    },
    {
      label: 'Book Appointment',
      href: '/dashboard/appointments/new',
      icon: Calendar,
      color: 'bg-green-500',
      permission: PERMISSIONS.APPOINTMENT.CREATE
    },
    {
      label: 'Medical Record',
      href: '/dashboard/medical-records/new',
      icon: FileText,
      color: 'bg-purple-500',
      permission: PERMISSIONS.MEDICAL_RECORD.CREATE
    },
    {
      label: 'Log Vaccination',
      href: '/dashboard/immunizations/new',
      icon: Syringe,
      color: 'bg-orange-500',
      permission: PERMISSIONS.IMMUNIZATION.CREATE
    },
    {
      label: 'Write Prescription',
      href: '/dashboard/prescriptions/new',
      icon: Pill,
      color: 'bg-indigo-500',
      permission: PERMISSIONS.PRESCRIPTION.CREATE
    },
    {
      label: 'Growth Chart',
      href: '/dashboard/growth/add',
      icon: Activity,
      color: 'bg-pink-500',
      permission: PERMISSIONS.GROWTH.CREATE
    }
  ];

  const visibleActions = actions.filter(action => hasPermission(action.permission));

  return (
    <div className='grid grid-cols-2 gap-3 md:grid-cols-6'>
      {visibleActions.map(action => {
        const Icon = action.icon;
        return (
          <Button
            asChild
            className='h-auto flex-col gap-2 p-4'
            key={action.href}
            variant='outline'
          >
            <Link href={action.href}>
              <div className={`rounded-full p-3 ${action.color} bg-opacity-10`}>
                <Icon className={`h-5 w-5 ${action.color.replace('bg-', 'text-')}`} />
              </div>
              <span className='text-center text-xs'>{action.label}</span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
