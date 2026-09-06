'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useDataMode } from '@/hooks/use-data-mode';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { deleteMemory, loadGuestStore, saveGuestProfile, saveMemory } from '@/lib/guest/store';
import type { Memory } from '@/lib/types';
import { toast } from 'sonner';

const CATEGORY_LABEL: Record<string, string> = {
  preference: 'Preference',
  goal: 'Goal',
  recurring_situation: 'Recurring situation',
  context: 'Important context',
  project: 'Ongoing project',
  relationship: 'Relationship context',
  reflection_preference: 'Reflection preference',
};

const MEMORY_DISABLED_MESSAGE = 'Memory is off. Turn it back on to add memories.';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

// Memory management (PRD §41, §42): explicit, editable, forgettable.
export function MemoryView() {
  const { mode, resolving } = useDataMode();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('context');
  // Audit A13: a failed account read is an explicit error state — never an
  // empty memory list pretending nothing was ever saved.
  const [loadError, setLoadError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (resolving) return;
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      void (async () => {
        const [{ data: memoriesData, error: memoriesError }, { data: profileData }] = await Promise.all([
          supabase.from('memories').select('*').order('created_at', { ascending: false }),
          supabase.from('profiles').select('memory_enabled').limit(1),
        ]);
        if (memoriesError) {
          setLoadError(true);
          return;
        }
        setLoadError(false);
        setMemories((memoriesData ?? []) as unknown as Memory[]);
        setMemoryEnabled(profileData?.[0]?.memory_enabled ?? true);
      })();
      return;
    }
    const guestStore = loadGuestStore();
    setLoadError(false);
    setMemories(guestStore.memories);
    setMemoryEnabled(guestStore.profile.memoryEnabled);
  }, [mode, resolving, nonce]);

  const reload = () => {
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      void supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data }) => setMemories((data ?? []) as unknown as Memory[]));
      return;
    }
    setMemories(loadGuestStore().memories);
  };

  const forget = (id: string) => {
    if (!window.confirm('Forget this memory? Eclipsay will no longer use it.')) return;
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      void supabase
        .from('memories')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) toast.error('Could not forget the memory. Try again.');
          reload();
        });
      return;
    }
    deleteMemory(id);
    reload();
  };

  const saveEdit = (memory: Memory) => {
    if (draft.trim().length === 0) return;
    const updated = { ...memory, content: draft.trim(), updated_at: new Date().toISOString() };
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      void supabase
        .from('memories')
        .update({ content: updated.content })
        .eq('id', memory.id)
        .then(({ error }) => {
          if (error) {
            toast.error('Could not save the edit. The card stays open — try again.');
            return;
          }
          setEditingId(null);
          reload();
        });
      return;
    }
    saveMemory(updated);
    reload();
    setEditingId(null);
  };

  const toggleMaster = async (enabled: boolean) => {
    setMemoryEnabled(enabled);
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const fail = () => {
        setMemoryEnabled(!enabled);
        toast.error('Could not update the memory setting. Try again.');
      };
      if (!user) return fail();
      const { error } = await supabase.from('profiles').update({ memory_enabled: enabled }).eq('id', user.id);
      if (error) return fail();
    } else {
      // Guests persist locally (PRD §13, §41).
      saveGuestProfile({ memoryEnabled: enabled });
    }
    // Success (or guest local persist — PRD §13/§41): confirm the new state.
    toast(enabled ? 'Eclipsay will remember what you save.' : 'Eclipsay will stop using memories.');
  };

  const addManual = () => {
    if (!memoryEnabled) {
      toast.error(MEMORY_DISABLED_MESSAGE);
      return;
    }
    if (newContent.trim().length === 0) return;
    const now = new Date().toISOString();
    const memory: Memory = {
      id: crypto.randomUUID(),
      user_id: '',
      category: newCategory as Memory['category'],
      content: newContent.trim(),
      source: 'Added by you',
      active: true,
      created_at: now,
      updated_at: now,
    };
    if (mode === 'account' && isSupabaseConfigured()) {
      void fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: memory.content,
          category: memory.category,
          source: memory.source,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const payload: unknown = await res.json().catch(() => null);
            const errorCode =
              payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                ? payload.error
                : undefined;
            toast.error(
              errorCode === 'memory_disabled'
                ? MEMORY_DISABLED_MESSAGE
                : 'Could not save the memory. Your text is kept — try again.',
            );
            return;
          }
          setNewContent('');
          reload();
        })
        .catch(() => toast.error('Could not save the memory. Your text is kept — try again.'));
    } else {
      saveMemory(memory);
      reload();
      setNewContent('');
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Memory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only what you explicitly approve lives here. Eclipsay uses it to keep continuity between reflections — never
          to profile you.
        </p>
      </header>

      <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3">
        <Label htmlFor="master" className="text-sm font-normal">
          Let Eclipsay remember
        </Label>
        <Switch id="master" checked={memoryEnabled} onCheckedChange={(v) => void toggleMaster(v)} />
      </div>
      {!memoryEnabled && (
        <p role="status" className="text-sm text-muted-foreground">
          {MEMORY_DISABLED_MESSAGE}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Add something for Eclipsay to remember…"
          aria-label="New memory"
          disabled={!memoryEnabled}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          aria-label="Memory category"
          disabled={!memoryEnabled}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button onClick={addManual} disabled={!memoryEnabled || newContent.trim().length === 0}>
          Remember this
        </Button>
      </div>

      {memories === null && !loadError && <p className="text-sm text-muted-foreground">Loading…</p>}
      {loadError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm">Your memories couldn&apos;t be loaded just now. Nothing is lost — try again.</p>
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={() => setNonce((n) => n + 1)}>
              Try again
            </Button>
          </div>
        </div>
      )}
      {memories !== null && !loadError && memories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing remembered yet. When something worth keeping comes up in a reflection, Eclipsay will ask before
          remembering it.
        </p>
      )}

      <div className="space-y-3">
        {memories?.map((memory) => (
          <div key={memory.id} className="rounded-xl border border-border bg-card px-4 py-3">
            {editingId === memory.id ? (
              <div className="space-y-2">
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit memory" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(memory)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm leading-6">{memory.content}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {CATEGORY_LABEL[memory.category] ?? memory.category} · Saved {fmtDate(memory.created_at)} · Source:{' '}
                  {memory.source}
                  {mode === 'guest' && ' · on this device'}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(memory.id);
                      setDraft(memory.content);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => forget(memory.id)}>
                    Forget
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
