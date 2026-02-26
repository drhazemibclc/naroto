'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { getStatusColor, getStatusIcon } from '@/utils/health';

import { Button } from '../ui/button';

export interface ServiceStatus {
  lastChecked: Date;
  latency: number;
  message?: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down';
}

function ServiceRow({ service }: { service: ServiceStatus }) {
  return (
    <div className='flex items-center justify-between rounded-lg border p-3'>
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
  );
}

export function ServicesList({ services }: { services: ServiceStatus[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayedServices = expanded ? services : services.slice(0, 3);

  return (
    <div className='grid gap-3'>
      {displayedServices.map(service => (
        <ServiceRow
          key={service.name}
          service={service}
        />
      ))}
      {services.length > 3 && (
        <Button
          className='mx-auto w-full'
          onClick={() => setExpanded(!expanded)}
          size='sm'
          variant='ghost'
        >
          {expanded ? (
            <>
              <ChevronUp className='mr-2 h-4 w-4' /> Show Less
            </>
          ) : (
            <>
              <ChevronDown className='mr-2 h-4 w-4' /> Show All Services
            </>
          )}
        </Button>
      )}
    </div>
  );
}
