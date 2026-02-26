'use client';

import { Server } from 'lucide-react';

import type { HealthMetrics } from '@/types/health';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

// import { formatBytes } from '@/utils/health'

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = 2;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function MemoryUsageCard({ metrics }: { metrics: HealthMetrics }) {
  const usedMemory = metrics.usedMemory ?? 0;
  const totalMemory = metrics.totalMemory ?? 0;
  const memoryPercentage = totalMemory ? Math.round((usedMemory / totalMemory) * 100) : 0;

  return (
    <Card>
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
