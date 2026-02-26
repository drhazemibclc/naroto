'use client';

import { Activity, BarChart, Eye, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: string;
}

interface AnalyticsStats {
  activeSessions: number;
  recentEvents: AnalyticsEvent[];
  totalEvents: number;
  totalSessions: number;
}

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      fetch('/api/analytics?type=stats')
        .then(res => res.json())
        .then(data => {
          setStats(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch analytics:', err);
          setLoading(false);
        });
    }
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (loading) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='font-medium text-sm'>Total Events</CardTitle>
          <BarChart className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='font-bold text-2xl'>{stats?.totalEvents || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='font-medium text-sm'>Total Sessions</CardTitle>
          <Users className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='font-bold text-2xl'>{stats?.totalSessions || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='font-medium text-sm'>Active Sessions</CardTitle>
          <Activity className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='font-bold text-2xl'>{stats?.activeSessions || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='font-medium text-sm'>Page Views</CardTitle>
          <Eye className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='font-bold text-2xl'>
            {stats?.recentEvents?.filter(e => e.name === 'page_view').length || 0}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
