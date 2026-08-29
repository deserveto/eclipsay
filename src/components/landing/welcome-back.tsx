'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadGuestStore } from '@/lib/guest/store';

function warmGap(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

// Returning guests arrive with history (PRD §2): continuity on the entry moment,
// without app chrome around the first-run greeting (PRD §11.1). Renders nothing
// until the guest store proves it, so first-timers see the pure hero.
export function WelcomeBack() {
  const [recent, setRecent] = useState<{ id: string; title: string; updated_at: string }[]>([]);

  useEffect(() => {
    const store = loadGuestStore();
    setRecent(
      [...store.sessions]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 3)
        .map((s) => ({ id: s.id, title: s.title, updated_at: s.updated_at })),
    );
  }, []);

  if (recent.length === 0) return null;

  return (
    <div className="space-y-1 border-t border-border pt-8 text-left">
      <p className="px-3 pb-1 text-sm font-medium">Welcome back</p>
      {recent.map((s) => (
        <Link
          key={s.id}
          href={`/reflect/${s.id}`}
          className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="truncate">{s.title}</span>
          <span className="shrink-0 text-xs">{warmGap(s.updated_at)}</span>
        </Link>
      ))}
      <Link
        href="/journal"
        className="block rounded-lg px-3 py-2 text-sm text-primary underline-offset-4 hover:underline"
      >
        Open your journal →
      </Link>
    </div>
  );
}
