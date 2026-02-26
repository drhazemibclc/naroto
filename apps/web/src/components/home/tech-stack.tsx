// components/home/health-check.tsx
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Download,
  HardDrive,
  RefreshCw,
  Server,
  Wifi,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useTRPC } from '@/trpc/client';

import { useSession } from '../../lib/auth/client';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { TITLE_TEXT } from './dev-art';

// Types
interface ServiceStatus {
  lastChecked: Date;
  latency: number;
  message?: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down';
}

interface HealthMetrics {
  activeUsers: number;
  cpuUsage: number;
  databaseConnections: number;
  diskSpace: number;
  lastBackup: string | null;
  memoryUsage: number;
  responseTime: number;
  totalMemory?: number;
  uptime: number;
  usedMemory?: number;
}

// Constants
const DEFAULT_METRICS: HealthMetrics = {
  uptime: 0,
  responseTime: 0,
  databaseConnections: 0,
  activeUsers: 0,
  memoryUsage: 0,
  cpuUsage: 0,
  diskSpace: 0,
  lastBackup: null,
  usedMemory: 0,
  totalMemory: 0
};

// Mock data - In production, this should come from the API
const MOCK_SERVICES: ServiceStatus[] = [
  {
    name: 'API Server',
    status: 'healthy',
    latency: 45,
    lastChecked: new Date()
  },
  {
    name: 'Database',
    status: 'healthy',
    latency: 12,
    lastChecked: new Date()
  },
  {
    name: 'Redis Cache',
    status: 'healthy',
    latency: 3,
    lastChecked: new Date()
  },
  {
    name: 'Storage Service',
    status: 'healthy',
    latency: 87,
    lastChecked: new Date()
  },
  {
    name: 'Email Service',
    status: 'healthy',
    latency: 156,
    lastChecked: new Date()
  },
  {
    name: 'SMS Gateway',
    status: 'healthy',
    latency: 234,
    lastChecked: new Date()
  }
];

// Utility functions
const formatUptime = (seconds: number): string => {
  if (seconds <= 0) return '0d 0h 0m';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
};

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = 2;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'healthy':
      return 'bg-green-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'down':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className='h-4 w-4 text-green-500' />;
    case 'degraded':
      return <AlertCircle className='h-4 w-4 text-yellow-500' />;
    case 'down':
      return <XCircle className='h-4 w-4 text-red-500' />;
    default:
      return <Activity className='h-4 w-4 text-gray-500' />;
  }
};
export type SystemStatus = 'healthy' | 'degraded' | 'down' | 'loading' | string;

export interface HealthData {
  /** List of service names currently experiencing issues */
  affectedServices?: string[];
  environment: string;
  /** Flag to indicate if there is an upcoming or active maintenance window */
  maintenanceScheduled?: boolean;
  status: SystemStatus;
  /** Timestamp of the check */
  timestamp?: string;
  version: string;
}

// Sub-components for better organization and memoization
// Update your StatusOverview component props:
function StatusOverview({
  health,
  metrics,
  isLoading
}: {
  health: HealthData | null | undefined;
  metrics: HealthMetrics;
  isLoading: boolean;
}) {
  // Logic remains the same, but now with type safety!
  const hasIssues = health?.status === 'degraded' || health?.status === 'down';
  return (
    <div className='mb-8 grid gap-6 md:grid-cols-3'>
      {/* API Status Card */}
      <Alert
        className='border-2 shadow-lg'
        variant={hasIssues ? 'destructive' : 'default'}
      >
        {hasIssues ? <XCircle className='h-4 w-4' /> : <AlertCircle className='h-4 w-4' />}
        <AlertTitle>System Status: {health?.status === 'degraded' ? 'Degraded' : 'Operational'}</AlertTitle>

        <AlertDescription className='space-y-3'>
          <p className='text-sm'>
            {health?.status === 'degraded'
              ? 'Some services may be experiencing issues.'
              : 'System is fully operational.'}
          </p>
          {health?.affectedServices && health.affectedServices.length > 0 && (
            <div className='text-xs'>
              <p className='font-medium'>Affected services:</p>
              <ul className='list-inside list-disc'>
                {health.affectedServices.map((service: string) => (
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

      {/* Response Time Card */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 font-medium text-sm'>
            <Clock className='h-4 w-4' />
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

      {/* Uptime Card */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 font-medium text-sm'>
            <Activity className='h-4 w-4' />
            Uptime
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className='font-medium text-2xl'>{formatUptime(metrics.uptime)}</span>
          <Badge
            className='ml-2'
            variant='outline'
          >
            99.9%
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function MemoryUsageCard({ metrics }: { metrics: HealthMetrics }) {
  const usedMemory = metrics.usedMemory ?? 0;
  const totalMemory = metrics.totalMemory ?? 0;
  const memoryPercentage = totalMemory ? Math.round((usedMemory / totalMemory) * 100) : 0;

  return (
    <Card className='mb-8'>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 font-medium text-sm'>
          <Server className='h-4 w-4' />
          Memory Usage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span className='font-medium text-2xl'>
          {formatBytes(usedMemory)} / {formatBytes(totalMemory)}
        </span>
        <Badge
          className='ml-2'
          variant='outline'
        >
          {memoryPercentage}%
        </Badge>
      </CardContent>
    </Card>
  );
}

function ServicesList({ services, expanded }: { services: ServiceStatus[]; expanded: boolean }) {
  const displayedServices = expanded ? services : services.slice(0, 3);

  return (
    <div className='grid gap-3'>
      {displayedServices.map(service => (
        <div
          className='flex items-center justify-between rounded-lg border p-3'
          key={service.name}
        >
          <div className='flex items-center gap-3'>
            {getStatusIcon(service.status)}
            <div>
              <p className='font-medium'>{service.name}</p>
              <p className='text-muted-foreground text-xs'>Last checked: {service.lastChecked.toLocaleTimeString()}</p>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <span className='text-sm'>{service.latency}ms</span>
            <div className={`h-2 w-2 rounded-full ${getStatusColor(service.status)}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DatabaseMetrics({ metrics }: { metrics: HealthMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Database className='h-5 w-5' />
          Database Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Connections</span>
          <span className='font-medium'>{metrics.databaseConnections}</span>
        </div>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Query Performance</span>
          <span className='font-medium'>23ms avg</span>
        </div>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Active Users</span>
          <span className='font-medium'>{metrics.activeUsers}</span>
        </div>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Last Backup</span>
          <span className='font-medium'>
            {metrics.lastBackup ? new Date(metrics.lastBackup).toLocaleString() : 'Never'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemResources({ metrics }: { metrics: HealthMetrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <HardDrive className='h-5 w-5' />
          System Resources
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div>
          <div className='mb-1 flex justify-between'>
            <span className='text-muted-foreground'>Memory Usage</span>
            <span className='font-medium'>{metrics.memoryUsage}%</span>
          </div>
          <Progress
            className='h-2'
            value={metrics.memoryUsage}
          />
        </div>
        <div>
          <div className='mb-1 flex justify-between'>
            <span className='text-muted-foreground'>CPU Usage</span>
            <span className='font-medium'>{metrics.cpuUsage}%</span>
          </div>
          <Progress
            className='h-2'
            value={metrics.cpuUsage}
          />
        </div>
        <div>
          <div className='mb-1 flex justify-between'>
            <span className='text-muted-foreground'>Disk Space</span>
            <span className='font-medium'>{metrics.diskSpace}%</span>
          </div>
          <Progress
            className='h-2'
            value={metrics.diskSpace}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Main Component
export function HealthCheck() {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { data: session, isPending: sessionLoading } = useSession();

  // Check if user is authenticated - memoized to prevent recalculations
  const isAuthenticated = Boolean(session?.user && !sessionLoading);

  // 1. Health check query - always enabled when authenticated
  const healthQuery = useQuery(
    trpc.health.healthCheck.queryOptions(undefined, {
      retry: 3,
      staleTime: 30_000, // 30 seconds
      refetchInterval: 60_000, // 1 minute
      refetchOnWindowFocus: true,
      enabled: isAuthenticated
    })
  );

  // 2. Detailed health query - only when expanded and authenticated
  const detailedHealthQuery = useQuery(
    trpc.health.detailed.queryOptions(undefined, {
      enabled: expanded && isAuthenticated,
      refetchInterval: 60_000,
      staleTime: 30_000
    })
  );

  // Memoize derived data to prevent unnecessary recalculations
  const metrics = useMemo(
    () => ({
      ...DEFAULT_METRICS,
      ...detailedHealthQuery.data?.metrics
    }),
    [detailedHealthQuery.data]
  );

  // Memoize services list
  const services = useMemo(() => MOCK_SERVICES, []);

  // Early returns after all hooks
  if (!isAuthenticated) {
    return null;
  }

  const { data: health, isLoading: healthLoading, error: healthError } = healthQuery;

  // Don't show anything if there's an error or no data
  if (healthError || healthLoading || !health) {
    return null;
  }

  const handleRefresh = () => {
    // Invalidate and refetch both queries
    queryClient.invalidateQueries(trpc.health.pathFilter());
  };

  const handleToggleExpand = () => {
    setExpanded(prev => !prev);
  };

  return (
    <div className='container mx-auto max-w-5xl px-4 py-8'>
      {/* ASCII Art Header - Only show when expanded */}
      {expanded && <pre className='mb-8 overflow-x-auto font-mono text-primary text-xs md:text-sm'>{TITLE_TEXT}</pre>}

      <StatusOverview
        health={health}
        isLoading={healthLoading}
        metrics={metrics}
      />

      <MemoryUsageCard metrics={metrics} />

      {/* Services Status */}
      <Card className='mb-6'>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='flex items-center gap-2'>
              <Wifi className='h-5 w-5' />
              Service Health
            </CardTitle>
            <Button
              className='gap-1'
              onClick={handleToggleExpand}
              size='sm'
              variant='ghost'
            >
              {expanded ? 'Show Less' : 'Show Details'}
              {expanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ServicesList
            expanded={expanded}
            services={services}
          />
        </CardContent>
      </Card>

      {/* Detailed Metrics (Conditional) */}
      {expanded && (
        <div className='grid gap-6 md:grid-cols-2'>
          <DatabaseMetrics metrics={metrics} />
          <SystemResources metrics={metrics} />
        </div>
      )}

      {/* Actions Footer */}
      <div className='mt-8 flex items-center justify-between border-t pt-6'>
        <div className='flex items-center gap-2 text-muted-foreground text-sm'>
          <Activity className='h-4 w-4' />
          Last updated: {new Date().toLocaleTimeString()}
        </div>
        <div className='flex gap-2'>
          <Button
            disabled={healthLoading || detailedHealthQuery.isFetching}
            onClick={handleRefresh}
            size='sm'
            variant='outline'
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${healthLoading || detailedHealthQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            size='sm'
            variant='outline'
          >
            <Download className='mr-2 h-4 w-4' />
            Export Report
          </Button>
        </div>
      </div>
    </div>
  );
}
