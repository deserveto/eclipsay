'use client';

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';

function ThemedToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-center"
      theme={theme === 'light' || theme === 'dark' ? theme : 'system'}
    />
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="eclipsay.theme"
      disableTransitionOnChange
    >
      {children}
      <ThemedToaster />
    </NextThemesProvider>
  );
}
