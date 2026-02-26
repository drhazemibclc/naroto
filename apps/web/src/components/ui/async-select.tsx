'use client';

import type { PopoverContentProps } from '@radix-ui/react-popover';
import { useDebouncedEffect, useMap, useMountEffect } from '@react-hookz/web';
import { CheckIcon, ChevronDownIcon, Loader2Icon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface AsyncSelectProps<T> {
  className?: string;
  clearable?: boolean;
  disabled?: boolean;
  fetcherAction: (query?: string) => Promise<T[]>;
  filterFnAction?: (option: T, query: string) => boolean;
  getDisplayValueAction: (options: T[]) => React.ReactNode;
  getOptionValueAction: (option: T) => string;
  isInvalid?: boolean;
  label: string;
  loadingSkeleton?: React.ReactNode;
  multiple?: boolean;
  noResultsMessage?: string;
  notFound?: React.ReactNode;
  onChangeAction: (value: T[]) => void;
  placeholder?: string;
  popoverContentProps?: PopoverContentProps;
  preload?: boolean;
  renderOptionAction: (option: T) => React.ReactNode;
  searchPlaceholder?: string;
  triggerClassName?: string;
  value: T[];
}

export function AsyncSelect<T>({
  fetcherAction,
  preload,
  filterFnAction,
  renderOptionAction,
  getOptionValueAction,
  getDisplayValueAction,
  notFound,
  loadingSkeleton,
  label,
  placeholder = 'Select...',
  searchPlaceholder,
  value,
  onChangeAction,
  disabled = false,
  className,
  triggerClassName,
  noResultsMessage,
  clearable = true,
  multiple = false,
  isInvalid = false,
  popoverContentProps
}: AsyncSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<T[]>([]);
  const [originalOptions, setOriginalOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const cache = useMap<string, T[]>();

  const getCachedData = useCallback(
    (cacheKey: string, query?: string) => {
      if (!cache.has(cacheKey)) return false;
      const cachedData = cache.get(cacheKey) ?? [];
      setOptions(cachedData);
      if (!query) setOriginalOptions(cachedData);
      return true;
    },
    [cache]
  );

  const fetchOptions = useCallback(
    async (query?: string) => {
      const cacheKey = query ?? '__initial__';
      if (getCachedData(cacheKey, query)) return;
      try {
        setLoading(true);
        setError(null);
        const data = await fetcherAction(query);
        cache.set(cacheKey, data);
        setOptions(data);
        if (!query) setOriginalOptions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch options');
      } finally {
        setLoading(false);
      }
    },
    [fetcherAction, cache, getCachedData]
  );

  const clearSearch = useCallback(() => setOptions(value), [value]);

  useDebouncedEffect(
    () => {
      if (preload) return;
      if (searchTerm) {
        fetchOptions(searchTerm);
      } else {
        clearSearch();
      }
    },
    [searchTerm, preload, fetchOptions],
    preload ? 0 : 500
  );

  useMountEffect(() => value.length === 0 && fetchOptions());

  useEffect(() => {
    if (!preload) return;
    if (searchTerm) {
      setOptions(originalOptions.filter(option => (filterFnAction ? filterFnAction(option, searchTerm) : true)));
    } else {
      setOptions(originalOptions);
    }
  }, [preload, filterFnAction, originalOptions, searchTerm]);

  const handleSelect = useCallback(
    (currentValue: string) => {
      const selectedOption = options.find(opt => getOptionValueAction(opt) === currentValue);
      if (!selectedOption) return;

      const isCurrentlySelected = value.some(v => getOptionValueAction(v) === currentValue);

      let newValues: T[];

      if (multiple) {
        newValues = isCurrentlySelected
          ? value.filter(v => getOptionValueAction(v) !== currentValue)
          : [...value, selectedOption];
      } else {
        newValues = clearable && isCurrentlySelected ? [] : [selectedOption];
        setOpen(false);
      }

      onChangeAction(newValues);
    },
    [value, onChangeAction, clearable, multiple, options, getOptionValueAction]
  );

  const showSkeleton = loading && options.length === 0;
  const showNotFound = !(loading || error) && options.length === 0;
  const showLoader = loading && options.length > 0;

  return (
    <Popover
      onOpenChange={setOpen}
      open={open}
    >
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-invalid={isInvalid}
          className={cn(
            'group/async-select w-full justify-between font-normal',
            disabled && 'cursor-not-allowed opacity-50',
            triggerClassName
          )}
          disabled={disabled}
          type='button'
        >
          {value.length === 0 ? placeholder : getDisplayValueAction(value)}
          <ChevronDownIcon
            className='opacity-50 group-hover/async-select:opacity-100'
            size={10}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className={cn('p-0', className)}
        {...popoverContentProps}
      >
        <Command className='[&_div[cmdk-input-wrapper]]:px-3'>
          <div className='relative'>
            <CommandInput
              className='rounded-none border-none focus-visible:ring-0'
              onValueChange={setSearchTerm}
              placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}...`}
              value={searchTerm}
            />
            {showLoader && (
              <div className='absolute top-1/2 right-2 flex -translate-y-1/2 transform items-center'>
                <Loader2Icon className='h-4 w-4 animate-spin' />
              </div>
            )}
          </div>

          <CommandList>
            {error && <div className='p-4 text-center text-destructive'>{error}</div>}
            {showSkeleton && (loadingSkeleton || <DefaultLoadingSkeleton />)}
            {showNotFound &&
              (notFound || <CommandEmpty>{noResultsMessage ?? `No ${label.toLowerCase()} found.`}</CommandEmpty>)}
            <CommandGroup forceMount>
              {options.map(option => (
                <CommandItem
                  key={getOptionValueAction(option)}
                  onSelect={handleSelect}
                  value={getOptionValueAction(option)}
                >
                  {renderOptionAction(option)}
                  <CheckIcon
                    className={cn(
                      'ml-auto size-4',
                      value.some(v => getOptionValueAction(v) === getOptionValueAction(option))
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DefaultLoadingSkeleton() {
  return (
    <CommandGroup forceMount>
      {[1, 2, 3].map(i => (
        <CommandItem
          disabled
          key={i}
        >
          <div className='flex w-full items-center gap-2'>
            <div className='h-6 w-6 animate-pulse rounded-full bg-border' />
            <div className='flex flex-1 flex-col gap-1'>
              <div className='h-4 w-40 animate-pulse rounded bg-border' />
              <div className='h-3 w-32 animate-pulse rounded bg-border' />
            </div>
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
