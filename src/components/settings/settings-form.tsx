'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AppearanceSetting } from '@/components/settings/appearance-setting';
import { useDataMode } from '@/hooks/use-data-mode';
import { completeProfileSchema, thirteenYearCutoff, zodFieldErrors } from '@/lib/auth/validation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { clearGuestData, clearGuestHistory, guestStoreHasData, loadGuestStore, saveGuestProfile } from '@/lib/guest/store';
import { importGuestData } from '@/lib/guest/migration-client';
import type { ReflectionGoal, TarotFamiliarity } from '@/lib/types';
import { toast } from 'sonner';

const GOALS: { value: ReflectionGoal; label: string }[] = [
  { value: 'feelings', label: 'Understand my feelings' },
  { value: 'decisions', label: 'Think through decisions' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'growth', label: 'Personal growth' },
  { value: 'exploring', label: 'Just exploring' },
];

const FAMILIARITY: { value: TarotFamiliarity; label: string }[] = [
  { value: 'new', label: 'New to tarot' },
  { value: 'some', label: 'A little familiar' },
  { value: 'very', label: 'Very familiar' },
];

export function SettingsForm() {
  const { mode } = useDataMode();
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [identityErrors, setIdentityErrors] = useState<Record<string, string>>({});
  const [goal, setGoal] = useState<ReflectionGoal | ''>('');
  const [familiarity, setFamiliarity] = useState<TarotFamiliarity | ''>('');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  // Audit A14: account deletion gets a busy guard against double-clicks.
  const [deleting, setDeleting] = useState(false);
  // Audit A11: guest data present on a signed-in browser can always be
  // imported explicitly from Settings, not just via the post-signup dialog.
  const [guestDataAvailable, setGuestDataAvailable] = useState(false);
  const [importing, setImporting] = useState(false);
  // Guest profile read once per store event — loadGuestStore() parses the
  // whole store on every call, so it must never run inside render.
  const [guestGoal, setGuestGoal] = useState<ReflectionGoal | undefined>(undefined);
  useEffect(() => {
    if (mode !== 'guest') return;
    const read = () => setGuestGoal(loadGuestStore().profile.reflectionGoal);
    read();
    window.addEventListener('eclipsay:guest-store-changed', read);
    return () => window.removeEventListener('eclipsay:guest-store-changed', read);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'account') {
      setGuestDataAvailable(false);
      return;
    }
    const read = () => setGuestDataAvailable(guestStoreHasData());
    read();
    window.addEventListener('eclipsay:guest-store-changed', read);
    return () => window.removeEventListener('eclipsay:guest-store-changed', read);
  }, [mode]);

  const importGuest = async () => {
    setImporting(true);
    const result = await importGuestData();
    setImporting(false);
    if (!result.ok) {
      toast.error('We could not import right now. Your local reflections are untouched — try again.');
      return;
    }
    setGuestDataAvailable(false);
    toast.success(`Imported your local reflections (${result.imported} records).`);
  };

  useEffect(() => {
    if (mode !== 'account' || !isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('*')
      .limit(1)
      .then(({ data }) => {
        const p = data?.[0];
        if (p) {
          setFullName(p.full_name ?? '');
          setDisplayName(p.display_name ?? '');
          setDateOfBirth(p.date_of_birth ?? '');
          setGoal(p.reflection_goal ?? '');
          setFamiliarity(p.tarot_familiarity ?? '');
          setMemoryEnabled(p.memory_enabled);
        }
      });
  }, [mode]);

  const saveProfile = async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // Identity edits pass the same boundary as signup/complete-profile
    // (plan: Accounts §7) — including the 13+ rule on the corrected date.
    const identity = completeProfileSchema.safeParse({ fullName, displayName, dateOfBirth });
    if (!identity.success) {
      setIdentityErrors(zodFieldErrors(identity.error));
      return;
    }
    setIdentityErrors({});
    const row = {
      id: user.id,
      full_name: identity.data.fullName,
      display_name: identity.data.displayName,
      date_of_birth: identity.data.dateOfBirth,
      reflection_goal: goal || null,
      tarot_familiarity: familiarity || null,
      memory_enabled: memoryEnabled,
    };
    const { error } = await supabase.from('profiles').upsert(row);
    if (error) {
      toast.error('Could not save your settings.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exportData = async () => {
    // Audit A08: an export must be COMPLETE or clearly failed. Every table
    // is paginated past the API row limit, profiles/preferences are included,
    // the payload is versioned, and any read error aborts with no download.
    const fail = () => toast.error('The export failed — nothing was downloaded. Try again.');
    let payload: unknown;
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      const PAGE = 500;
      const readAll = async (table: string): Promise<unknown[] | null> => {
        const rows: unknown[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
          if (error) return null;
          rows.push(...(data ?? []));
          if (!data || data.length < PAGE) return rows;
        }
      };
      const [profile, sessions, messages, readings, journal, memories, followUps] = await Promise.all([
        supabase.from('profiles').select('*').maybeSingle(),
        readAll('reflection_sessions'),
        readAll('messages'),
        readAll('tarot_readings'),
        readAll('journal_entries'),
        readAll('memories'),
        readAll('follow_ups'),
      ]);
      if (
        !sessions ||
        !messages ||
        !readings ||
        !journal ||
        !memories ||
        !followUps ||
        profile.error
      ) {
        fail();
        return;
      }
      payload = {
        schema: 'eclipsay-export.v1',
        exportedAt: new Date().toISOString(),
        profile: profile.data ?? null,
        sessions,
        messages,
        readings,
        journal,
        memories,
        followUps,
      };
    } else {
      payload = { schema: 'eclipsay-export.v1', exportedAt: new Date().toISOString(), guestStore: loadGuestStore() };
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eclipsay-data.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Your data has been exported.');
  };

  const clearHistory = async () => {
    if (mode === 'account' && isSupabaseConfigured()) {
      // Audit A14: the two old independent deletes could half-clear; the
      // migration adds an atomic SECURITY DEFINER RPC scoped to auth.uid().
      const supabase = createClient();
      const { error } = await supabase.rpc('clear_my_history');
      if (error) {
        toast.error('History could not be cleared — nothing was deleted. Try again.');
        return;
      }
      toast.success('History cleared.');
      return;
    }
    clearGuestHistory();
    toast.success('Guest history cleared.');
  };

  const deleteAccount = async () => {
    // Audit A14: one deletion at a time, network failures reported honestly.
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) {
        toast.error('Account deletion failed. Try again or contact support.');
        return;
      }
      if (isSupabaseConfigured()) {
        await createClient().auth.signOut();
      }
      window.location.href = '/';
    } catch {
      toast.error('Account deletion failed. Try again or contact support.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Tune your experience and manage your data.</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-base font-medium">Profile</h2>
        {mode === 'account' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                aria-invalid={identityErrors.fullName ? true : undefined}
                aria-describedby={identityErrors.fullName ? 'fullName-error' : undefined}
              />
              {identityErrors.fullName && (
                <p id="fullName-error" className="text-xs text-destructive">
                  {identityErrors.fullName}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">What should we call you?</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="nickname"
                aria-invalid={identityErrors.displayName ? true : undefined}
                aria-describedby={identityErrors.displayName ? 'displayName-error' : undefined}
              />
              {identityErrors.displayName && (
                <p id="displayName-error" className="text-xs text-destructive">
                  {identityErrors.displayName}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={thirteenYearCutoff()}
                autoComplete="bday"
                aria-invalid={identityErrors.dateOfBirth ? true : undefined}
                aria-describedby={identityErrors.dateOfBirth ? 'dateOfBirth-error' : 'dateOfBirth-hint'}
              />
              {identityErrors.dateOfBirth ? (
                <p id="dateOfBirth-error" className="text-xs text-destructive">
                  {identityErrors.dateOfBirth}
                </p>
              ) : (
                <p id="dateOfBirth-hint" className="text-xs text-muted-foreground">
                  Editable for corrections only — Eclipsay supports ages 13 and up, and this is never displayed.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal">Reflection goal</Label>
              <select
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value as ReflectionGoal)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              >
                <option value="">Not set</option>
                {GOALS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="familiarity">Tarot familiarity</Label>
              <select
                id="familiarity"
                value={familiarity}
                onChange={(e) => setFamiliarity(e.target.value as TarotFamiliarity)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              >
                <option value="">Not set</option>
                {FAMILIARITY.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3.5 py-3">
              <div className="min-w-0">
                <Label htmlFor="memory">Let Eclipsay remember</Label>
                <p className="text-xs text-muted-foreground">
                  Only what you explicitly save is remembered, and only while this is on.
                </p>
              </div>
              <Switch id="memory" checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
            </div>
            <div aria-live="polite">
              <Button onClick={saveProfile}>{saved ? 'Saved' : 'Save changes'}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm">What brings you to Eclipsay?</p>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    aria-pressed={guestGoal === g.value}
                    onClick={() => saveGuestProfile({ reflectionGoal: g.value })}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      guestGoal === g.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Button variant="secondary" asChild>
                <Link href="/signup?next=%2Fsettings">Create an account</Link>
              </Button>
            </div>
            {!isSupabaseConfigured() && (
              <p className="text-xs text-muted-foreground">
                Accounts need Supabase credentials in .env.local — you are currently a guest.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Appearance</h2>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-border px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm">Theme</p>
            <p className="text-xs text-muted-foreground">Choose how Eclipsay looks on this device.</p>
          </div>
          <AppearanceSetting />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Privacy &amp; data</h2>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-border px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm">Export my data</p>
            <p className="text-xs text-muted-foreground">
              Download everything Eclipsay stores for you as a JSON file.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={exportData}>
            Export
          </Button>
        </div>
        {mode === 'guest' ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-border px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm">Clear guest data</p>
              <p className="text-xs text-muted-foreground">
                Removes every reflection, journal entry, and memory stored in this browser.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (window.confirm('Clear all guest data from this browser? This cannot be undone.')) {
                  clearGuestData();
                  toast.success('Guest data cleared.');
                }
              }}
            >
              Clear
            </Button>
          </div>
        ) : (
          <>
            {guestDataAvailable && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-sm">Import guest data</p>
                  <p className="text-xs text-muted-foreground">
                    This browser holds reflections that were saved without an account. Bring them into yours.
                  </p>
                </div>
                <Button variant="secondary" size="sm" disabled={importing} onClick={() => void importGuest()}>
                  {importing ? 'Importing…' : 'Import'}
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-border px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm">Clear history</p>
                <p className="text-xs text-muted-foreground">
                  Removes every reflection session. Journal entries and memories stay.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (window.confirm('Clear your entire reflection history? Journal and memories stay.')) {
                    void clearHistory();
                  }
                }}
              >
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-border px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm">Delete account</p>
                <p className="text-xs text-muted-foreground">
                  Permanently deletes your account and all of its data. This cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm('Delete your account and ALL of its data? This cannot be undone.')) {
                    void deleteAccount();
                  }
                }}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </>
        )}
      </section>

    </div>
  );
}
