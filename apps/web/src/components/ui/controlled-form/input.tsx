'use client';

import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { Control, FieldValues, Path } from 'react-hook-form';

import LucideIcon from '@/components/common/lucide';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { Input as SCN_Input } from '@/components/ui/form/input';
import { cn } from '@/lib/utils';

import FormErrorMessage from './shared/error-message';
import FormLabel from './shared/label';

type TInput<TFormSchema extends FieldValues> = ComponentProps<'input'> & {
  control: Control<TFormSchema>;
  name: Path<TFormSchema>;
  label?: string;
  isRequired?: boolean;
};

export default function Input<TFormSchema extends FieldValues>({
  control,
  name,
  label,
  isRequired,
  type,
  className,
  disabled,
  ...otherProperties
}: TInput<TFormSchema>) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = useMemo(() => type === 'password', [type]);
  const onPasswordButtonClick = useCallback(() => {
    setIsPasswordVisible(!isPasswordVisible);
  }, [isPasswordVisible]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('w-full', className)}>
          <FormLabel
            isRequired={isRequired ?? true}
            label={label ?? ''}
            name={name}
          />
          <div className='relative'>
            <FormControl>
              <SCN_Input
                className='pr-10.5 placeholder:italic'
                disabled={disabled}
                type={isPassword && isPasswordVisible ? 'text' : type}
                {...otherProperties}
                {...field}
              />
            </FormControl>

            {isPassword && (
              <button
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                className='absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground disabled:pointer-events-none disabled:opacity-50'
                disabled={disabled}
                onClick={onPasswordButtonClick}
                tabIndex={-1}
                type='button'
              >
                <LucideIcon name={isPasswordVisible ? 'EyeOff' : 'Eye'} />
              </button>
            )}
          </div>

          <FormErrorMessage name={name} />
        </FormItem>
      )}
    />
  );
}
