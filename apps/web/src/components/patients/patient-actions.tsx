// src/components/patients/patient-actions.tsx
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Edit, Loader2, MoreHorizontal, Pill, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { trpc } from '@/utils/trpc';

interface PatientActionsProps {
  clinicId: string;
  patientId: string;
  patientName: string;
}

export function PatientActions({ patientId, clinicId }: PatientActionsProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    trpc.patient.delete.mutationOptions({
      onSuccess: result => {
        if (result.success) {
          toast.success('Patient deleted successfully');
          queryClient.invalidateQueries(trpc.patient.getAllPatients.queryFilter({ clinicId }));
          window.location.href = '/dashboard/patients';
        }
      },
      onError: error => {
        toast.error(error.message);
      }
    })
  );

  const handleDelete = () => deleteMutation.mutate(patientId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className='inline-flex h-9 items-center justify-center rounded-md bg-transparent px-3 font-medium text-sm transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'
          type='button'
        >
          <MoreHorizontal className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/patients/${patientId}`}>
            <Calendar className='mr-2 h-4 w-4' />
            View Details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/patients/${patientId}/edit`}>
            <Edit className='mr-2 h-4 w-4' />
            Edit Patient
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/appointments/new?patientId=${patientId}`}>
            <Calendar className='mr-2 h-4 w-4' />
            Schedule Appointment
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/prescriptions/new?patientId=${patientId}`}>
            <Pill className='mr-2 h-4 w-4' />
            Write Prescription
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='text-destructive focus:text-destructive'
          disabled={deleteMutation.isPending}
          onClick={handleDelete}
        >
          {deleteMutation.isPending ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Trash2 className='mr-2 h-4 w-4' />
          )}
          Delete Patient
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
