'use client';

import type { ThemeProviderProps } from 'next-themes';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { FC, ReactNode } from 'react';

const EStorageKeys = {
  theme: 'SMART-CLINIC-APP-THEME'
};

// upstream props omit `children`, so add it locally for usage here
type Props = ThemeProviderProps & { children?: ReactNode };

// cast the imported provider to a variant that allows children
const NextThemesProviderTyped = NextThemesProvider as FC<Props>;

export default function ThemeProvider({ children, ...properties }: Props) {
  return (
    <NextThemesProviderTyped
      attribute='class'
      defaultTheme='system'
      disableTransitionOnChange
      enableSystem
      storageKey={EStorageKeys.theme}
      {...properties}
    >
      {children}
    </NextThemesProviderTyped>
  );
}
