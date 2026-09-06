'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listEntries } from '@/lib/journal/entries';
import type { JournalEntry } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  freeform: 'JOURNAL',
  reflection: 'REFLECTION',
  tarot: 'TAROT REFLECTION',
  insight: 'INSIGHT',
  mood: 'MOOD CHECK-IN',
  followup: 'FOLLOW-UP',
  intention: 'INTENTION',
};

// Audit A22: group by the FULL local calendar date (year included). The old
// month/day label merged "September 6" from different years into one group.
function dayKey(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

// Journal timeline (PRD §36): chronological, grouped by day, type badges.
export function JournalView() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  // Audit A13: read failures render an explicit error + retry, never an
  // empty timeline and never a silent guest-data fallback.
  const [loadError, setLoadError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setEntries(null);
    setLoadError(false);
    listEntries().then((result) => {
      if (!active) return;
      if (result.status === 'error') setLoadError(true);
      else setEntries(result.entries);
    });
    return () => {
      active = false;
    };
  }, [nonce]);

  const groups = new Map<string, JournalEntry[]>();
  for (const entry of entries ?? []) {
    const day = dayKey(entry.created_at);
    const list = groups.get(day) ?? [];
    list.push(entry);
    groups.set(day, list);
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Journal</h1>
        <Button asChild size="sm">
          <Link href="/journal/new">
            <Plus className="size-4" aria-hidden />
            New entry
          </Link>
        </Button>
      </header>

      {entries === null && !loadError && <p className="text-sm text-muted-foreground">Loading…</p>}
      {loadError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm">Your journal couldn&apos;t be loaded just now. Nothing is lost — try again.</p>
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={() => setNonce((n) => n + 1)}>
              Try again
            </Button>
          </div>
        </div>
      )}
      {entries !== null && !loadError && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing here yet. Saved insights, reflections, and freeform entries all live here.
        </p>
      )}

      {[...groups.entries()].map(([day, list]) => (
        <section key={day} aria-label={list[0] ? dayLabel(list[0].created_at) : day} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{list[0] ? dayLabel(list[0].created_at) : day}</h2>
          {list.map((entry) => (
            <Link
              key={entry.id}
              href={`/journal/new?id=${entry.id}`}
              className="block rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-accent"
            >
              <p className="text-[11px] font-medium tracking-wide text-primary">{TYPE_LABEL[entry.entry_type] ?? entry.entry_type}</p>
              {entry.title && <p className="mt-1 text-sm font-medium">{entry.title}</p>}
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{entry.body}</p>
              {entry.mood && <p className="mt-1.5 text-xs text-muted-foreground">Mood: {entry.mood}</p>}
              {entry.ai_notes.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.ai_notes.length} AI note{entry.ai_notes.length > 1 ? 's' : ''}
                </p>
              )}
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
