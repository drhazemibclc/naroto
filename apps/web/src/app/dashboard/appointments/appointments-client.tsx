// apps/web/src/app/(protected)/dashboard/appointments/appointments-client.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Filter, Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';

import { AppointmentCalendar } from './components/appointment-calendar';
import { AppointmentList } from './components/appointment-list';
import { CreateAppointmentDialog } from './components/create-appointment-dialog';

export function AppointmentsClient() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Fetch appointments with filters
  const { data, isLoading } = useQuery(
    trpc.appointment.list.queryOptions({
      page: 1,
      limit: 50,
      status: status !== 'all' ? [status as any] : undefined,
      startDate: selectedDate,
      endDate: selectedDate
    })
  );

  // Fetch today's appointments for quick view
  const { data: todayAppointments } = useQuery(trpc.appointment.today.queryOptions());

  // Fetch stats
  const { data: stats } = useQuery(trpc.appointment.stats.queryOptions({ period: 'month' }));

  const appointments = data?.items || [];
  const todayList = todayAppointments || [];

  const filteredAppointments = appointments.filter(app =>
    `${app.patient.firstName} ${app.patient.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className='p-4 md:p-8'>
        {/* Header */}
        <div className='mb-8 flex items-center justify-between'>
          <div>
            <h1 className='font-bold text-3xl tracking-tight'>Appointments</h1>
            <p className='text-muted-foreground'>Manage and schedule patient appointments</p>
          </div>
          <CreateAppointmentDialog>
            <Button>
              <Plus className='mr-2 h-4 w-4' />
              New Appointment
            </Button>
          </CreateAppointmentDialog>
        </div>

        {/* Stats Cards */}
        <div className='mb-8 grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='font-medium text-sm'>Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='font-bold text-2xl'>{todayList.length}</div>
              <p className='text-muted-foreground text-xs'>
                {todayList.filter((a: any) => a.status === 'SCHEDULED').length} scheduled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='font-medium text-sm'>This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='font-bold text-2xl'>{stats?.total || 0}</div>
              <p className='text-muted-foreground text-xs'>{stats?.byStatus?.COMPLETED || 0} completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='font-medium text-sm'>Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='font-bold text-2xl'>{todayList.filter((a: any) => a.status === 'CHECKED_IN').length}</div>
              <p className='text-muted-foreground text-xs'>Waiting to be seen</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='font-medium text-sm'>No Shows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='font-bold text-2xl'>{stats?.byStatus?.NO_SHOW || 0}</div>
              <p className='text-muted-foreground text-xs'>This month</p>
            </CardContent>
          </Card>
        </div>

        {/* View Toggle & Filters */}
        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <Tabs
            onValueChange={v => setView(v as 'list' | 'calendar')}
            value={view}
          >
            <TabsList>
              <TabsTrigger value='list'>List View</TabsTrigger>
              <TabsTrigger value='calendar'>Calendar View</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className='flex gap-2'>
            <div className='relative'>
              <Search className='absolute top-2.5 left-2 h-4 w-4 text-muted-foreground' />
              <Input
                className='pl-8'
                onChange={e => setSearch(e.target.value)}
                placeholder='Search patients...'
                value={search}
              />
            </div>

            <Select
              onValueChange={setStatus}
              value={status}
            >
              <SelectTrigger className='w-[140px]'>
                <Filter className='mr-2 h-4 w-4' />
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All</SelectItem>
                <SelectItem value='SCHEDULED'>Scheduled</SelectItem>
                <SelectItem value='CONFIRMED'>Confirmed</SelectItem>
                <SelectItem value='CHECKED_IN'>Checked In</SelectItem>
                <SelectItem value='IN_PROGRESS'>In Progress</SelectItem>
                <SelectItem value='COMPLETED'>Completed</SelectItem>
                <SelectItem value='CANCELLED'>Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        <Tabs
          className='w-full'
          value={view}
        >
          <TabsContent value='list'>
            <AppointmentList
              appointments={filteredAppointments}
              isLoading={isLoading}
              onRefresh={() => {}}
            />
          </TabsContent>
          <TabsContent value='calendar'>
            <AppointmentCalendar
              appointments={appointments}
              onDateChange={setSelectedDate}
              selectedDate={selectedDate}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
