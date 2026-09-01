import type { AiNote, AiNoteType, JournalEntry } from '@/lib/types';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { deleteJournalEntry, loadGuestStore, saveJournalEntry } from '@/lib/guest/store';

// Mode-aware journal access: guest store vs Supabase.

export function guestAllEntries(): JournalEntry[] {
  const store = loadGuestStore();
  const byId = new Map<string, JournalEntry>();
  for (const e of [...store.journal, ...store.insights]) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function makeEntry(partial: Partial<JournalEntry> & { body: string }): JournalEntry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    user_id: '',
    entry_type: 'freeform',
    title: null,
    mood: null,
    tags: [],
    ai_notes: [],
    source_session_id: null,
    source_reading_id: null,
    parent_entry_id: null,
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

export async function listEntries(): Promise<JournalEntry[]> {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) return data as unknown as JournalEntry[];
    }
  }
  return guestAllEntries();
}

export async function persistEntry(entry: JournalEntry): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('journal_entries').upsert({ ...entry, user_id: user.id });
      if (error) throw new Error(error.message);
      return;
    }
  }
  saveJournalEntry(entry);
}

export async function removeEntry(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('journal_entries').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
  }
  deleteJournalEntry(id);
}

export async function appendAiNote(entry: JournalEntry, type: AiNoteType, content: string): Promise<JournalEntry> {
  const note: AiNote = { id: crypto.randomUUID(), type, content, createdAt: new Date().toISOString() };
  const updated: JournalEntry = {
    ...entry,
    ai_notes: [...entry.ai_notes, note],
    updated_at: new Date().toISOString(),
  };
  await persistEntry(updated);
  return updated;
}
