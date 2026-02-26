// app/dashboard/dashboard-client.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar, FileText, TrendingUp, Users } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Session } from '@/lib/auth-client';

import { trpc } from '../../utils/trpc';

interface DashboardClientProps {
  session: Session;
}

export default function DashboardClient({ session }: DashboardClientProps) {
  // Use the Options Proxy pattern with TanStack Query
  const { data: stats, isLoading } = useQuery(trpc.dashboard.getStats.queryOptions({ clinicId: session.user.id }));

  const { data: recentAppointments } = useQuery(trpc.clinic.getRecentAppointments.queryOptions(undefined));

  const statCards = [
    {
      title: 'Total Patients',
      value: stats?.totalPatients ?? 0,
      description: 'Active patients in clinic',
      icon: Users,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Appointments',
      value: stats?.todayAppointments ?? 0,
      description: 'Total appointments',
      icon: Calendar,
      color: 'bg-green-100 text-green-600'
    },
    {
      title: "Today's Appointments",
      value: stats?.todayAppointments ?? 0,
      description: 'Scheduled for today',
      icon: FileText,
      color: 'bg-orange-100 text-orange-600'
    },
    {
      title: 'Revenue',
      value: stats?.monthlyRevenue ? `$${stats.monthlyRevenue}` : '$0',
      description: 'Monthly revenue',
      icon: TrendingUp,
      color: 'bg-purple-100 text-purple-600'
    }
  ];

  return (
    <DashboardLayout>
      <div className='p-4 md:p-8'>
        <div className='mb-8'>
          <h1 className='font-bold text-3xl tracking-tight'>Dashboard</h1>
          <p className='text-muted-foreground'>Welcome back, {session.user.name} to your pediatric clinic</p>
        </div>

        {/* Stats Grid */}
        <div className='mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {statCards.map(stat => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='font-medium text-sm'>{stat.title}</CardTitle>
                  <div className={`rounded-lg p-2 ${stat.color}`}>
                    <Icon className='h-4 w-4' />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='font-bold text-2xl'>
                    {isLoading ? <div className='h-8 w-16 animate-pulse rounded bg-gray-200' /> : stat.value}
                  </div>
                  <p className='text-muted-foreground text-xs'>{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className='grid gap-4 md:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Recent Appointments</CardTitle>
              <CardDescription>Your upcoming appointments</CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(recentAppointments) ? (
                <div className='space-y-4'>
                  {recentAppointments.map(appointment => (
                    <div
                      className='flex items-center justify-between border-b pb-4 last:border-0 last:pb-0'
                      key={appointment.id}
                    >
                      <div>
                        <p className='font-medium'>{`${appointment.patient.firstName} ${appointment.patient.lastName}`}</p>
                        <p className='text-muted-foreground text-sm'>
                          {appointment.time} - {appointment.type}
                        </p>
                      </div>
                      <span
                        className={`rounded px-2 py-1 text-sm ${
                          appointment.status?.toUpperCase() === 'SCHEDULED'
                            ? 'bg-green-100 text-green-800'
                            : appointment.status?.toUpperCase() === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {appointment.status
                          ? appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).toLowerCase()
                          : 'Unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='space-y-4'>
                  {[1, 2, 3].map(i => (
                    <div
                      className='flex items-center justify-between border-b pb-4 last:border-0 last:pb-0'
                      key={i}
                    >
                      <div className='space-y-2'>
                        <div className='h-4 w-32 animate-pulse rounded bg-gray-200' />
                        <div className='h-3 w-24 animate-pulse rounded bg-gray-200' />
                      </div>
                      <div className='h-6 w-20 animate-pulse rounded bg-gray-200' />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                <a
                  className='block rounded-lg bg-blue-50 p-3 font-medium text-blue-600 hover:bg-blue-100'
                  href='/dashboard/patients/new'
                >
                  + New Patient
                </a>
                <a
                  className='block rounded-lg bg-purple-50 p-3 font-medium text-purple-600 hover:bg-purple-100'
                  href='/dashboard/prescriptions/new'
                >
                  + Write Prescription
                </a>
                <a
                  className='block rounded-lg bg-green-50 p-3 font-medium text-green-600 hover:bg-green-100'
                  href='/dashboard/appointments/new'
                >
                  + Schedule Appointment
                </a>
                <a
                  className='block rounded-lg bg-orange-50 p-3 font-medium text-orange-600 hover:bg-orange-100'
                  href='/dashboard/growth-charts'
                >
                  View Growth Charts
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
