'use client';

import { Activity, AlertCircle, Clock, Server, XCircle } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
export interface HealthData {
  affectedServices?: string[];
  environment?: string;
  maintenanceScheduled?: boolean;
  status: 'healthy' | 'degraded' | 'down';
  version?: string;
}

export interface HealthMetrics {
  responseTime: number;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
}

function StatusCard({ health }: { health: HealthData | null | undefined; isLoading: boolean }) {
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
          <Server className='h-4 w-4' />
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

function formatDuration(seconds: number) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);

  return parts.join(' ');
}

export function UptimeCard({ metrics }: { metrics: HealthMetrics }) {
  const isHealthy = metrics.status === 'healthy';

  return (
    <Card className='relative overflow-hidden'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='flex items-center gap-2 font-medium text-muted-foreground text-sm'>
          <Clock className='h-4 w-4' />
          System Uptime
        </CardTitle>
        {/* Real-time pulse indicator */}
        <span className='relative flex h-2 w-2'>
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />
        </span>
      </CardHeader>

      <CardContent>
        <div className='flex items-baseline justify-between'>
          <div className='font-bold text-2xl tracking-tight'>{formatDuration(metrics.uptime)}</div>
          <Badge
            className='font-medium font-mono'
            variant={isHealthy ? 'secondary' : 'destructive'}
          >
            <Activity className='mr-1 h-3 w-3' />
            99.9%
          </Badge>
        </div>
        <p className='mt-1 text-muted-foreground text-xs'>Since last system deployment</p>
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
