'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDataMode } from '@/hooks/use-data-mode';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { dueGuestFollowUps, updateFollowUpStatus } from '@/lib/guest/store';
import { track } from '@/lib/analytics';
import type { FollowUp } from '@/lib/types';
import { toast } from 'sonner';

// In-app follow-up banner (PRD §46): warm, no guilt copy.
type Due = { id: string; sessionId: string | null; dueAt: string };

function humanGap(dueAt: string): string {
  const days = Math.max(1, Math.round((Date.now() - new Date(dueAt).getTime()) / (24 * 60 * 60 * 1000)));
  if (days <= 1) return 'yesterday';
  if (days < 7) return `after ${days} days`;
  const weeks = Math.round(days / 7);
  return `after one week`.replace('one week', weeks === 1 ? 'one week' : `${weeks} weeks`);
}

const SNOOZE_KEY = 'eclipsay.followups.snoozed';

// "Later" persists per browser for 24h so the banner stays gone across
// navigation and remounts; expired entries simply stop matching.
function readSnoozed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, string>;
    const now = Date.now();
    return new Set(
      Object.entries(parsed)
        .filter(([, until]) => new Date(until).getTime() > now)
        .map(([id]) => id),
    );
  } catch {
    return new Set();
  }
}

function snoozeUntil(id: string): void {
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    parsed[id] = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    window.localStorage.setItem(SNOOZE_KEY, JSON.stringify(parsed));
  } catch {
    // Storage unavailable: snooze stays session-only.
  }
}

export function FollowUpBanner() {
  const { mode } = useDataMode();
  const router = useRouter();
  const [due, setDue] = useState<Due | null>(null);
  const [snoozed, setSnoozed] = useState<Set<string>>(() => readSnoozed());

  useEffect(() => {
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('follow_ups')
          .select('id, session_id, due_at')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .lte('due_at', new Date().toISOString())
          .order('due_at', { ascending: true })
          .limit(1);
        const row = data?.[0];
        if (row) setDue({ id: row.id, sessionId: row.session_id, dueAt: row.due_at });
      })();
      return;
    }
    const check = () => {
      const [first] = dueGuestFollowUps();
      if (first) setDue({ id: first.id, sessionId: first.session_id, dueAt: first.due_at });
    };
    check();
    window.addEventListener('eclipsay:guest-store-changed', check);
    return () => window.removeEventListener('eclipsay:guest-store-changed', check);
  }, [mode]);

  if (!due || snoozed.has(due.id)) return null;

  const setStatus = async (status: 'revisited' | 'dismissed') => {
    if (mode === 'account' && isSupabaseConfigured()) {
      const res = await fetch('/api/followups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: due.id, status }),
      });
      if (!res.ok) toast.error('Could not update the check-in. It may reappear.');
      return;
    }
    updateFollowUpStatus(due.id, status);
  };

  const revisit = () => {
    void setStatus('revisited');
    track('followup_revisited');
    setDue(null);
    if (due.sessionId) router.push(`/reflect/${due.sessionId}?followup=${due.id}`);
    else router.push('/reflect');
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary px-4 py-2.5"
    >
      <p className="text-sm">
        <span className="font-medium">A reflection is ready to revisit.</span>{' '}
        <span className="text-muted-foreground">
          You asked to check in on this reflection {humanGap(due.dueAt)}.
        </span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={revisit}>
          Revisit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            // "Later" must survive navigation: persist until tomorrow, not
            // just component state.
            snoozeUntil(due.id);
            setSnoozed((prev) => new Set(prev).add(due.id));
          }}
        >
          Later
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void setStatus('dismissed').then(() => {
              setDue(null);
            });
          }}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export type { FollowUp };
