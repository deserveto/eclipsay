'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { SignInDialog } from '@/components/auth/sign-in-dialog';
import { useDataMode } from '@/hooks/use-data-mode';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { clearGuestData, clearGuestHistory, loadGuestStore, saveGuestProfile } from '@/lib/guest/store';
import type { Profile, ReflectionGoal, TarotFamiliarity } from '@/lib/types';
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
  const [signInOpen, setSignInOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [goal, setGoal] = useState<ReflectionGoal | ''>('');
  const [familiarity, setFamiliarity] = useState<TarotFamiliarity | ''>('');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

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
          setProfile(p);
          setDisplayName(p.display_name ?? '');
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
    const row = {
      id: user.id,
      display_name: displayName.trim() || null,
      reflection_goal: goal || null,
      tarot_familiarity: familiarity || null,
      memory_enabled: memoryEnabled,
    };
    const { error } = await supabase.from('profiles').upsert(row);
    if (error) {
      toast.error('Could not save your settings.');
      return;
    }
    setProfile(row as Profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exportData = async () => {
    let payload: unknown;
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      const [sessions, messages, readings, journal, memories, followUps] = await Promise.all([
        supabase.from('reflection_sessions').select('*'),
        supabase.from('messages').select('*'),
        supabase.from('tarot_readings').select('*'),
        supabase.from('journal_entries').select('*'),
        supabase.from('memories').select('*'),
        supabase.from('follow_ups').select('*'),
      ]);
      payload = {
        exportedAt: new Date().toISOString(),
        sessions: sessions.data ?? [],
        messages: messages.data ?? [],
        readings: readings.data ?? [],
        journal: journal.data ?? [],
        memories: memories.data ?? [],
        followUps: followUps.data ?? [],
      };
    } else {
      payload = loadGuestStore();
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
      const supabase = createClient();
      const { error } = await supabase.from('reflection_sessions').select('id').limit(1);
      if (error) return;
      await supabase.from('follow_ups').delete().neq('id', crypto.randomUUID());
      await supabase.from('reflection_sessions').delete().neq('id', crypto.randomUUID());
      toast.success('History cleared.');
      return;
    }
    clearGuestHistory();
    toast.success('Guest history cleared.');
  };

  const deleteAccount = async () => {
    const res = await fetch('/api/account/delete', { method: 'POST' });
    if (!res.ok) {
      toast.error('Account deletion failed. Try again or contact support.');
      return;
    }
    if (isSupabaseConfigured()) {
      await createClient().auth.signOut();
    }
    window.location.href = '/';
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Profile</h2>
        {mode === 'account' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we greet you?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal">Reflection goal</Label>
              <select
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value as ReflectionGoal)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Not set</option>
                {FAMILIARITY.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3">
              <div>
                <Label htmlFor="memory">Let Eclipsay remember</Label>
                <p className="text-xs text-muted-foreground">
                  Only what you explicitly save is remembered, and only while this is on.
                </p>
              </div>
              <Switch id="memory" checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
            </div>
            <Button onClick={saveProfile}>{saved ? 'Saved' : 'Save changes'}</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => saveGuestProfile({ reflectionGoal: g.value })}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    loadGuestStore().profile.reflectionGoal === g.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={() => setSignInOpen(true)}>
              Create an account
            </Button>
            {!isSupabaseConfigured() && (
              <p className="text-xs text-muted-foreground">
                Accounts need Supabase credentials in .env.local — you are currently a guest.
              </p>
            )}
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Privacy &amp; Data</h2>
        {mode === 'guest' && (
          <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3">
            <div>
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
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportData}>
            Export my data (JSON)
          </Button>
          {mode === 'account' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (window.confirm('Clear your entire reflection history? Journal and memories stay.')) {
                    void clearHistory();
                  }
                }}
              >
                Clear History
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm('Delete your account and ALL of its data? This cannot be undone.')) {
                    void deleteAccount();
                  }
                }}
              >
                Delete account
              </Button>
              </>
          )}
        </div>
      </section>

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
      {profile === null && mode === 'guest' ? null : null}
    </div>
  );
}
