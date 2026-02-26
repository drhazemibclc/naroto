// src/components/patients/patient-table.tsx
'use client';

import { format } from 'date-fns';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

interface PatientTableProps {
  isDeleting: boolean;
  onDelete: (id: string) => void;
  patients: Patient[];
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

export function PatientTable({ patients, onDelete, isDeleting }: PatientTableProps) {
  if (patients.length === 0) {
    return (
      <div className='py-8 text-center text-muted-foreground'>
        No patients found. Add your first patient to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Gender</TableHead>
          <TableHead>Age</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Visit</TableHead>
          <TableHead className='text-right'>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map(patient => (
          <TableRow key={patient.id}>
            <TableCell>
              <Link
                className='flex items-center gap-3 hover:underline'
                href={`/dashboard/patients/${patient.id}`}
              >
                <Avatar className='h-8 w-8'>
                  <AvatarImage
                    alt={patient.firstName}
                    src={patient.image ?? undefined}
                  />
                  <AvatarFallback
                    style={{
                      backgroundColor: patient.colorCode ?? '#4ECDC4'
                    }}
                  >
                    {getInitials(patient.firstName, patient.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className='font-medium'>
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className='text-muted-foreground text-xs'>{patient._count?.appointments ?? 0} visits</p>
                </div>
              </Link>
            </TableCell>
            <TableCell>{patient.gender === 'MALE' ? 'Male' : 'Female'}</TableCell>
            <TableCell>{calculateAge(patient.dateOfBirth)}</TableCell>
            <TableCell>
              <div className='text-sm'>
                {patient.phone && <p>{patient.phone}</p>}
                {patient.email && <p className='text-muted-foreground'>{patient.email}</p>}
              </div>
            </TableCell>
            <TableCell>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  patient.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-800'
                    : patient.status === 'INACTIVE'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {patient.status?.toLowerCase() ?? 'unknown'}
              </span>
            </TableCell>
            <TableCell>
              {patient.appointments?.[0]?.appointmentDate
                ? format(new Date(patient.appointments[0].appointmentDate), 'MMM d, yyyy')
                : '-'}
            </TableCell>
            <TableCell className='text-right'>
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
                  <DropdownMenuItem
                    className='text-destructive focus:text-destructive'
                    disabled={isDeleting}
                    onClick={() => onDelete(patient.id)}
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    Delete patient
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
