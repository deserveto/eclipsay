import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

// Shared chrome for every in-app surface (landing stays unshelled at src/app/page.tsx).
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
