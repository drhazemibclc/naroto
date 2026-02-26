import { FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';

interface TFormErrorMessage {
  className?: string;
  name: string;
}

export default function FormErrorMessage({ name, className }: Readonly<TFormErrorMessage>) {
  return (
    <FormMessage
      className={cn('leading-none', className)}
      data-testid={`${name}-error-message`}
    />
  );
}
