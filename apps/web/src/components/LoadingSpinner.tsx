'use client';

import { motion } from 'motion/react';

export function LoadingSpinner() {
  return (
    <output
      aria-live='polite'
      className='relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-green-900 to-emerald-900'
    >
      <motion.div
        animate={{ rotate: 360 }}
        className='h-12 w-12 rounded-full border-4 border-white border-t-transparent'
        transition={{
          duration: 1,
          ease: 'linear',
          repeat: Number.POSITIVE_INFINITY
        }}
      />
    </output>
  );
}
