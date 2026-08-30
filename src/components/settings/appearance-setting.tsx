'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const APPEARANCES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

type AppearanceValue = (typeof APPEARANCES)[number]['value'];

function isAppearanceValue(value: string | undefined): value is AppearanceValue {
  return value === 'light' || value === 'dark' || value === 'system';
}

// Appearance switch (single home: Settings). Segmented control on an Oat track;
// the active segment lifts as a Paper White chip — tone, not copper, so the
// page keeps its One Voice for the primary action.
export function AppearanceSetting() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current: AppearanceValue = mounted && isAppearanceValue(theme) ? theme : 'system';

  return (
    <div role="group" aria-label="Appearance" className="inline-flex h-8 items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {APPEARANCES.map(({ value, label, icon: Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active ? 'bg-card text-foreground ring-1 ring-foreground/10' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
