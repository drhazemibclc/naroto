'use client';

import { AlertCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

import type { HealthData, HealthMetrics } from '@/types/health';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';

function StatusCard({ health, isLoading }: { health: HealthData | null | undefined; isLoading: boolean }) {
  const hasIssues = health?.status === 'degraded' || health?.status === 'down';

  return (
    <Alert
      className='border-2 shadow-lg'
      variant={hasIssues ? 'destructive' : 'default'}
    >
      {hasIssues ? <XCircle className='h-4 w-4' /> : <AlertCircle className='h-4 w-4' />}
      <AlertTitle>System Status: {health?.status === 'degraded' ? 'Degraded' : 'Operational'}</AlertTitle>
      <AlertDescription className='space-y-3'>
        <p className='text-sm'>
          {health?.status === 'degraded' ? 'Some services may be experiencing issues.' : 'System is fully operational.'}
        </p>
        {health?.affectedServices && health.affectedServices.length > 0 && (
          <div className='text-xs'>
            <p className='font-medium'>Affected services:</p>
            <ul className='list-inside list-disc'>
              {health.affectedServices.map(service => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          </div>
        )}
        <div className='flex gap-2'>
          <Button
            asChild
            size='sm'
            variant='outline'
          >
            <Link href='/system-status'>View Details</Link>
          </Button>
          {health?.maintenanceScheduled && (
            <Button
              asChild
              size='sm'
              variant='ghost'
            >
              <Link href='/maintenance'>Maintenance Info</Link>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function ApiStatusCard({ health, isLoading }: { health: HealthData | null | undefined; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 font-medium text-sm'>
          <server className='h-4 w-4' />
          API Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex items-center gap-2'>
          <div
            className={`h-3 w-3 rounded-full ${
              health?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
            } ${health?.status === 'healthy' ? 'animate-pulse' : ''}`}
          />
          <span className='font-medium text-lg'>
            {isLoading ? 'Checking...' : health ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {health && (
          <p className='mt-2 text-muted-foreground text-xs'>
            Version: {health.version} | Environment: {health.environment}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ResponseTimeCard({ metrics }: { metrics: HealthMetrics }) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 font-medium text-sm'>
          <i className='h-4 w-4' />
          Response Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex items-baseline gap-1'>
          <span className='font-medium text-2xl'>{metrics.responseTime}</span>
          <span className='text-muted-foreground text-sm'>ms</span>
        </div>
        <Progress
          className='mt-2 h-1'
          value={Math.min((metrics.responseTime / 200) * 100, 100)}
        />
      </CardContent>
    </Card>
  );
}

function UptimeCard({ metrics }: { metrics: HealthMetrics }) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 font-medium text-sm'>
          <i className='h-4 w-4' />
          Uptime
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span className='font-medium text-2xl'>{/* {formatUptime(metrics.uptime)} */}</span>
        <Badge
          className='ml-2'
          variant='outline'
        >
          99.9%
        </Badge>
      </CardContent>
    </Card>
  );
}

export function StatusOverview({
  health,
  metrics,
  isLoading
}: {
  health: HealthData | null | undefined;
  metrics: HealthMetrics;
  isLoading: boolean;
}) {
  return (
    <div className='grid gap-6 md:grid-cols-3'>
      <StatusCard
        health={health}
        isLoading={isLoading}
      />
      <ApiStatusCard
        health={health}
        isLoading={isLoading}
      />
      <ResponseTimeCard metrics={metrics} />
      <UptimeCard metrics={metrics} />
    </div>
  );
}
