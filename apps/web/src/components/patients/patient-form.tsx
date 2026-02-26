// src/components/patients/patient-form.tsx
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTRPC } from '@/trpc/client';

interface PatientFormProps {
  clinicId: string;
  defaultValues?: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date | string;
    gender: 'MALE' | 'FEMALE';
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    emergencyContactName?: string | null;
    emergencyContactNumber?: string | null;
    allergies?: string | null;
    medicalConditions?: string | null;
    medicalHistory?: string | null;
    bloodGroup?: string | null;
  };
  patientId?: string;
}

export function PatientForm({ patientId, clinicId: _clinicId, defaultValues }: PatientFormProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    firstName: defaultValues?.firstName ?? '',
    lastName: defaultValues?.lastName ?? '',
    dateOfBirth: defaultValues?.dateOfBirth ? new Date(defaultValues.dateOfBirth).toISOString().split('T')[0] : '',
    gender: defaultValues?.gender ?? 'MALE',
    email: defaultValues?.email ?? '',
    phone: defaultValues?.phone ?? '',
    address: defaultValues?.address ?? '',
    emergencyContactName: defaultValues?.emergencyContactName ?? '',
    emergencyContactNumber: defaultValues?.emergencyContactNumber ?? '',
    allergies: defaultValues?.allergies ?? '',
    medicalConditions: defaultValues?.medicalConditions ?? '',
    medicalHistory: defaultValues?.medicalHistory ?? '',
    bloodGroup: defaultValues?.bloodGroup ?? ''
  });

  const createMutation = useMutation(
    trpc.patient.create.mutationOptions({
      onSuccess: () => {
        toast.success('Patient created successfully');
        queryClient.invalidateQueries({ queryKey: ['patient'] });
        router.push('/dashboard/patients');
        router.refresh();
      },
      onError: error => {
        toast.error(error.message);
      }
    })
  );

  const updateMutation = useMutation(
    trpc.patient.update.mutationOptions({
      onSuccess: () => {
        toast.success('Patient updated successfully');
        queryClient.invalidateQueries({ queryKey: ['patient'] });
        router.push('/dashboard/patients');
        router.refresh();
      },
      onError: error => {
        toast.error(error.message);
      }
    })
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const onSubmit = () => {
    const data = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      dateOfBirth: new Date(formData.dateOfBirth),
      gender: formData.gender as 'MALE' | 'FEMALE',
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      emergencyContactName: formData.emergencyContactName || null,
      emergencyContactNumber: formData.emergencyContactNumber || null,
      allergies: formData.allergies || null,
      medicalConditions: formData.medicalConditions || null,
      medicalHistory: formData.medicalHistory || null,
      bloodGroup: formData.bloodGroup || null
    };

    if (patientId) {
      updateMutation.mutate({ id: patientId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className='space-y-6'>
      <div className='grid gap-6 sm:grid-cols-2'>
        <div>
          <Label htmlFor='firstName'>First Name *</Label>
          <Input
            className='mt-2'
            id='firstName'
            onChange={e => handleChange('firstName', e.target.value)}
            placeholder='John'
            value={formData.firstName}
          />
        </div>
        <div>
          <Label htmlFor='lastName'>Last Name *</Label>
          <Input
            className='mt-2'
            id='lastName'
            onChange={e => handleChange('lastName', e.target.value)}
            placeholder='Doe'
            value={formData.lastName}
          />
        </div>
      </div>

      <div className='grid gap-6 sm:grid-cols-2'>
        <div>
          <Label htmlFor='dateOfBirth'>Date of Birth *</Label>
          <Input
            className='mt-2'
            id='dateOfBirth'
            onChange={e => handleChange('dateOfBirth', e.target.value)}
            type='date'
            value={formData.dateOfBirth}
          />
        </div>
        <div>
          <Label htmlFor='gender'>Gender *</Label>
          <Select
            onValueChange={value => handleChange('gender', value)}
            value={formData.gender}
          >
            <SelectTrigger
              className='mt-2'
              id='gender'
            >
              <SelectValue placeholder='Select gender' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='MALE'>Male</SelectItem>
              <SelectItem value='FEMALE'>Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='grid gap-6 sm:grid-cols-2'>
        <div>
          <Label htmlFor='email'>Email</Label>
          <Input
            className='mt-2'
            id='email'
            onChange={e => handleChange('email', e.target.value)}
            placeholder='john@example.com'
            type='email'
            value={formData.email}
          />
        </div>
        <div>
          <Label htmlFor='phone'>Phone</Label>
          <Input
            className='mt-2'
            id='phone'
            onChange={e => handleChange('phone', e.target.value)}
            placeholder='+1234567890'
            value={formData.phone}
          />
        </div>
      </div>

      <div>
        <Label htmlFor='address'>Address</Label>
        <Textarea
          className='mt-2'
          id='address'
          onChange={e => handleChange('address', e.target.value)}
          placeholder='123 Main St, City, Country'
          rows={2}
          value={formData.address}
        />
      </div>

      <div className='grid gap-6 sm:grid-cols-2'>
        <div>
          <Label htmlFor='emergencyContactName'>Emergency Contact Name</Label>
          <Input
            className='mt-2'
            id='emergencyContactName'
            onChange={e => handleChange('emergencyContactName', e.target.value)}
            placeholder='Parent/Guardian name'
            value={formData.emergencyContactName}
          />
        </div>
        <div>
          <Label htmlFor='emergencyContactNumber'>Emergency Contact Phone</Label>
          <Input
            className='mt-2'
            id='emergencyContactNumber'
            onChange={e => handleChange('emergencyContactNumber', e.target.value)}
            placeholder='+1234567890'
            value={formData.emergencyContactNumber}
          />
        </div>
      </div>

      <div>
        <Label htmlFor='bloodGroup'>Blood Group</Label>
        <Select
          onValueChange={value => handleChange('bloodGroup', value)}
          value={formData.bloodGroup}
        >
          <SelectTrigger
            className='mt-2'
            id='bloodGroup'
          >
            <SelectValue placeholder='Select blood group' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='A+'>A+</SelectItem>
            <SelectItem value='A-'>A-</SelectItem>
            <SelectItem value='B+'>B+</SelectItem>
            <SelectItem value='B-'>B-</SelectItem>
            <SelectItem value='AB+'>AB+</SelectItem>
            <SelectItem value='AB-'>AB-</SelectItem>
            <SelectItem value='O+'>O+</SelectItem>
            <SelectItem value='O-'>O-</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor='allergies'>Allergies</Label>
        <Textarea
          className='mt-2'
          id='allergies'
          onChange={e => handleChange('allergies', e.target.value)}
          placeholder='List any allergies (medications, food, etc.)'
          rows={2}
          value={formData.allergies}
        />
      </div>

      <div>
        <Label htmlFor='medicalConditions'>Medical Conditions</Label>
        <Textarea
          className='mt-2'
          id='medicalConditions'
          onChange={e => handleChange('medicalConditions', e.target.value)}
          placeholder='List any chronic medical conditions'
          rows={2}
          value={formData.medicalConditions}
        />
      </div>

      <div>
        <Label htmlFor='medicalHistory'>Medical History</Label>
        <Textarea
          className='mt-2'
          id='medicalHistory'
          onChange={e => handleChange('medicalHistory', e.target.value)}
          placeholder='Brief medical history'
          rows={3}
          value={formData.medicalHistory}
        />
      </div>

      <div className='flex justify-end gap-4'>
        <Button
          disabled={isPending}
          onClick={() => router.back()}
          type='button'
          variant='outline'
        >
          Cancel
        </Button>
        <LoadingButton
          loading={isPending}
          onClick={onSubmit}
        >
          {patientId ? 'Update Patient' : 'Create Patient'}
        </LoadingButton>
      </div>
    </div>
  );
}
