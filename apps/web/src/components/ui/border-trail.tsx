import { type AnimationDefinition, type MotionStyle, motion, type Transition } from 'motion/react';

import { cn } from '@/lib/utils';

export interface BorderTrailProps {
  className?: string;
  delay?: number;
  onAnimationComplete?: (definition: AnimationDefinition) => void; // <- correct type
  size?: number;
  style?: Partial<MotionStyle>;
  transition?: Transition;
}

const BASE_TRANSITION: Transition<string> = {
  duration: 5,
  ease: 'linear',
  repeat: Number.POSITIVE_INFINITY
};

function removeUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined)) as T;
}
export function BorderTrail({
  className,
  size = 60,
  transition,
  delay,
  onAnimationComplete,
  style = {}
}: BorderTrailProps) {
  const safeTransition: Transition = {
    ...BASE_TRANSITION,
    ...transition,
    ...(delay !== undefined ? { delay } : {})
  };

  return (
    <div className='pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]'>
      <motion.div
        animate={{ offsetDistance: ['0%', '100%'] }}
        className={cn('absolute aspect-square bg-zinc-500', className)}
        {...(onAnimationComplete ? { onAnimationComplete } : {})} // <- only if defined
        style={removeUndefined<MotionStyle>({
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          width: size,
          ...style
        })}
        transition={safeTransition}
      />
    </div>
  );
}
