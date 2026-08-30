import Link from 'next/link';
import type { ReactNode } from 'react';

// Shared chrome for the (auth) route group (plan: Accounts §3): warm paper,
// hairline ring around a centered paper-white form surface, no AppShell
// sidebar, no tarot indigo, no resting shadows (DESIGN.md).

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 md:px-8">
        <Link href="/reflect" className="flex items-center gap-2" aria-label="Eclipsay home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="" className="size-7" />
          <span className="text-sm tracking-wide text-primary">ECLIPSAY</span>
        </Link>
        <Link href="/reflect" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Back to reflecting
        </Link>
      </header>
      <main id="main-content" className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 md:pt-10">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
