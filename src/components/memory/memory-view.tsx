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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

// Memory management (PRD §41, §42): explicit, editable, forgettable.
export function MemoryView() {
  const { mode } = useDataMode();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('context');

  useEffect(() => {
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      void (async () => {
        const { data: memoriesData } = await supabase
          .from('memories')
          .select('*')
          .order('created_at', { ascending: false });
        setMemories((memoriesData ?? []) as unknown as Memory[]);
        const { data: profileData } = await supabase.from('profiles').select('memory_enabled').limit(1);
        setMemoryEnabled(profileData?.[0]?.memory_enabled ?? true);
      })();
      return;
    }
    const guestStore = loadGuestStore();
    setMemories(guestStore.memories);
    setMemoryEnabled(guestStore.profile.memoryEnabled);
  }, [mode]);

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
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      void supabase.from('memories').delete().eq('id', id).then(reload);
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
      void supabase.from('memories').update({ content: updated.content }).eq('id', memory.id).then(reload);
    } else {
      saveMemory(updated);
      reload();
    }
    setEditingId(null);
  };

  const toggleMaster = async (enabled: boolean) => {
    setMemoryEnabled(enabled);
    if (mode === 'account' && isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.from('profiles').update({ memory_enabled: enabled }).eq('id', (await supabase.auth.getUser()).data.user?.id ?? '');
      toast(enabled ? 'Eclipsay will remember what you save.' : 'Eclipsay will stop using memories.');
    } else {
      // Guests persist locally (PRD §13); the toggle keeps the same promise (PRD §41).
      saveGuestProfile({ memoryEnabled: enabled });
      toast(enabled ? 'Eclipsay will remember what you save.' : 'Eclipsay will stop using memories.');
    }
  };

  const addManual = () => {
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
      const supabase = createClient();
      void supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user) return;
        await supabase.from('memories').insert({ ...memory, user_id: data.user.id });
        reload();
      });
    } else {
      saveMemory(memory);
      reload();
    }
    setNewContent('');
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Add something for Eclipsay to remember…"
          aria-label="New memory"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          aria-label="Memory category"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button onClick={addManual} disabled={newContent.trim().length === 0}>
          Remember this
        </Button>
      </div>

      {memories === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {memories !== null && memories.length === 0 && (
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
