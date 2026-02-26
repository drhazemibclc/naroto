'use client';

import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { HealthCheck } from './tech-stack';

export function SystemHealthBanner() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      className='border-y bg-muted/40'
      onOpenChange={setIsOpen}
      open={isOpen}
    >
      <div className='container mx-auto px-4'>
        <div className='flex items-center justify-between py-2'>
          <div className='flex items-center gap-2'>
            <Activity className='h-4 w-4 text-muted-foreground' />
            <span className='font-medium text-sm'>System Health</span>
            <span className='rounded-full bg-green-100 px-2 py-0.5 text-green-700 text-xs dark:bg-green-900 dark:text-green-300'>
              Operational
            </span>
          </div>

          <CollapsibleTrigger asChild>
            <Button
              size='sm'
              variant='ghost'
            >
              {isOpen ? (
                <>
                  Hide Details <ChevronUp className='ml-1 h-4 w-4' />
                </>
              ) : (
                <>
                  View Details <ChevronDown className='ml-1 h-4 w-4' />
                </>
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className='pt-3 pb-4'>
          <HealthCheck />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
