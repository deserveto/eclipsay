import type { AiNote, AiNoteType, JournalEntry } from '@/lib/types';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { deleteJournalEntry, loadGuestStore, updateGuestEntry } from '@/lib/guest/store';

// Mode-aware journal access: guest store vs Supabase.

/** Thrown when the entry disappeared while an async operation was in flight (audit A02). */
export class EntryDeletedError extends Error {
  constructor() {
    super('entry_deleted');
  }
}

export type EntriesReadResult =
  | { status: 'ok'; entries: JournalEntry[] }
  // Audit A13: a failed account read is NEVER reported as an empty journal
  // and never silently degrades to guest data.
  | { status: 'error' };

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

export async function listEntries(): Promise<EntriesReadResult> {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) return { status: 'error' };
      return { status: 'ok', entries: (data ?? []) as unknown as JournalEntry[] };
    }
  }
  return { status: 'ok', entries: guestAllEntries() };
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
  updateGuestEntry(entry);
}

export async function removeEntry(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('journal_entries').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return;
    }
  }
  deleteJournalEntry(id);
}

// Audit A02: notes are appended ATOMICALLY against the entry's current
// server/local state — never by replaying a stale full-row object. A save or
// delete that lands while the assist is in flight therefore wins:
//  · a concurrently saved entry keeps its newer body/title/tags (only
//    ai_notes is updated);
//  · a deleted entry makes the append fail with EntryDeletedError instead of
//    recreating the row.
export async function appendAiNote(entryId: string, type: AiNoteType, content: string): Promise<JournalEntry> {
  const note: AiNote = { id: crypto.randomUUID(), type, content, createdAt: new Date().toISOString() };
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: row } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('id', entryId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!row) throw new EntryDeletedError();
      const current = row as unknown as JournalEntry;
      const ai_notes = [...current.ai_notes, note];
      const updated_at = new Date().toISOString();
      // Partial update: body/title/tags/mood are never sent, so a newer save
      // cannot be clobbered by the late assist response.
      const { error } = await supabase
        .from('journal_entries')
        .update({ ai_notes, updated_at })
        .eq('id', entryId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return { ...current, ai_notes, updated_at };
    }
  }
  const store = loadGuestStore();
  const existing = [...store.journal, ...store.insights].find((e) => e.id === entryId);
  if (!existing) throw new EntryDeletedError();
  const updated: JournalEntry = {
    ...existing,
    ai_notes: [...existing.ai_notes, note],
    updated_at: new Date().toISOString(),
  };
  updateGuestEntry(updated);
  return updated;
}
