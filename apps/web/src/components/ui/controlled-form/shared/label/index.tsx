import { FormLabel as SCN_FormLabel } from '@/components/ui/form';
import { cn } from '@/lib/utils';

import OptionalBadge from './optional-badge';

interface TFormLabel {
  className?: string;
  isRequired?: boolean;
  label?: string;
  name: string;
}

export default function FormLabel({ name, label, isRequired, className }: Readonly<TFormLabel>) {
  if (!label) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-x-2.5', className)}>
      <SCN_FormLabel
        className='leading-none'
        data-testid={`${name}-error-message`}
      >
        {label}
      </SCN_FormLabel>
      {!isRequired && <OptionalBadge />}
    </div>
  );
}
