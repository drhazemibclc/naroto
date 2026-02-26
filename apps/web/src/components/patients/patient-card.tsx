// src/components/patients/patient-card.tsx
'use client';

import { format } from 'date-fns';
import { Calendar, MoreHorizontal, Phone } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface Patient {
  _count?: {
    appointments: number;
    medicalRecords: number;
    prescriptions: number;
  };
  appointments?: Array<{
    appointmentDate: Date;
  }>;
  colorCode: string | null;
  createdAt: Date;
  dateOfBirth: Date;
  email: string | null;
  firstName: string;
  gender: 'MALE' | 'FEMALE';
  id: string;
  image: string | null;
  lastName: string;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DORMANT' | null;
}

interface PatientCardProps {
  isDeleting?: boolean;
  onDelete?: (id: string) => void;
  patient: Patient;
}

function calculateAge(dateOfBirth: Date): string {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 1) {
    const months = monthDiff < 0 ? 12 + monthDiff : monthDiff;
    return `${months} month${months !== 1 ? 's' : ''}`;
  }

  return `${age} year${age !== 1 ? 's' : ''}`;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function PatientCard({ patient, onDelete, isDeleting }: PatientCardProps) {
  const lastVisit = patient.appointments?.[0]?.appointmentDate;

  return (
    <Card className='overflow-hidden'>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <Avatar className='h-12 w-12'>
              <AvatarImage
                alt={patient.firstName}
                src={patient.image ?? undefined}
              />
              <AvatarFallback
                className='text-white'
                style={{
                  backgroundColor: patient.colorCode ?? '#4ECDC4'
                }}
              >
                {getInitials(patient.firstName, patient.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className='text-lg'>
                {patient.firstName} {patient.lastName}
              </CardTitle>
              <CardDescription>
                {calculateAge(patient.dateOfBirth)} • {patient.gender === 'MALE' ? 'Male' : 'Female'}
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className='h-8 w-8'
                size='icon'
                variant='ghost'
              >
                <MoreHorizontal className='h-4 w-4' />
                <span className='sr-only'>Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/patients/${patient.id}`}>View details</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/patients/${patient.id}/edit`}>Edit patient</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onDelete && (
                <DropdownMenuItem
                  className='text-destructive focus:text-destructive'
                  disabled={isDeleting}
                  onClick={() => onDelete(patient.id)}
                >
                  Delete patient
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className='grid gap-2 text-sm'>
        <div className='flex items-center gap-2 text-muted-foreground'>
          {patient.phone && (
            <>
              <Phone className='h-3.5 w-3.5' />
              <span>{patient.phone}</span>
            </>
          )}
        </div>
        <div className='flex items-center gap-2 text-muted-foreground'>
          {lastVisit && (
            <>
              <Calendar className='h-3.5 w-3.5' />
              <span>Last visit: {format(new Date(lastVisit), 'MMM d, yyyy')}</span>
            </>
          )}
        </div>
        <div className='mt-2 flex items-center justify-between'>
          <Badge
            variant={patient.status === 'ACTIVE' ? 'default' : patient.status === 'INACTIVE' ? 'secondary' : 'outline'}
          >
            {patient.status?.toLowerCase() ?? 'unknown'}
          </Badge>
          <span className='text-muted-foreground text-xs'>{patient._count?.appointments ?? 0} visits</span>
        </div>
      </CardContent>
    </Card>
  );
}
