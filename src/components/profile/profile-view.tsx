'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useDataMode } from '@/hooks/use-data-mode';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

// Profile summary (plan: Accounts §7): account users see full name, nickname,
// and email — never the birth date. Guests get separate Login / Create
// account routes (the old sign-in modal is gone).

export function ProfileView() {
  const { mode } = useDataMode();
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'account' || !isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    supabase
      .from('profiles')
      .select('full_name, display_name')
      .limit(1)
      .then(({ data }) => {
        const profile = data?.[0];
        if (profile) {
          setFullName(profile.full_name ?? null);
          setDisplayName(profile.display_name ?? null);
        }
      });
  }, [mode]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Profile</h1>
      {mode === 'account' ? (
        <div className="space-y-4">
          <dl className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-xs text-muted-foreground">Full name</dt>
              <dd className="text-sm">{fullName ?? '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-xs text-muted-foreground">Nickname</dt>
              <dd className="text-sm">{displayName ?? '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="truncate text-sm">{email ?? '—'}</dd>
            </div>
          </dl>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!isSupabaseConfigured()) return;
              await createClient().auth.signOut();
              window.location.href = '/';
            }}
          >
            Sign out
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You are reflecting as a guest — everything stays in this browser.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/signup?${new URLSearchParams({ next: '/profile' })}`}>Create account</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/login?${new URLSearchParams({ next: '/profile' })}`}>Log in</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
