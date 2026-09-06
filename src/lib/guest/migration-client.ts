import { clearGuestData, loadGuestStore } from '@/lib/guest/store';
import { track } from '@/lib/analytics';

// Guest → account import (PRD §13, §64; audits A04/A11). Shared by the
// post-verify MigrationDialog and the Settings import action so both paths
// behave identically: one POST, and local data is cleared ONLY after the
// server confirms the whole transaction landed.

export type ImportResult = { ok: true; imported: number } | { ok: false };

export function buildMigrationPayload() {
  const store = loadGuestStore();
  const sessions = store.sessions.map((s) => ({
    id: s.id,
    title: s.title,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));
  const readings = store.sessions.flatMap((s) =>
    s.readings.map((r) => ({
      id: r.id,
      session_id: r.session_id || s.id,
      spread_id: r.spread_id,
      seed: r.seed,
      cards: r.cards,
      created_at: r.created_at,
    })),
  );
  const messages = store.sessions.flatMap((s) =>
    s.messages.map((m) => ({
      id: m.id,
      session_id: m.session_id || s.id,
      role: m.role,
      content: m.content,
      meta: m.meta as Record<string, unknown>,
      created_at: m.created_at,
    })),
  );
  const journal = [...store.journal, ...store.insights].map((e) => ({
    id: e.id,
    entry_type: e.entry_type,
    title: e.title,
    body: e.body,
    mood: e.mood,
    tags: e.tags,
    ai_notes: e.ai_notes as unknown[],
    source_session_id: e.source_session_id,
    source_reading_id: e.source_reading_id,
    parent_entry_id: e.parent_entry_id,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }));
  const memories = store.memories.map((m) => ({
    id: m.id,
    category: m.category,
    content: m.content,
    source: m.source,
    active: m.active,
    created_at: m.created_at,
    updated_at: m.updated_at,
  }));
  // Audit A04: reminders and profile preferences cross the boundary in the
  // same transaction — they were previously dropped silently.
  const followUps = store.followUps.map((f) => ({
    id: f.id,
    session_id: f.session_id,
    journal_entry_id: f.journal_entry_id,
    due_at: f.due_at,
    status: f.status,
    created_at: f.created_at,
  }));
  const profile = {
    reflection_goal: store.profile.reflectionGoal ?? null,
    tarot_familiarity: store.profile.tarotFamiliarity ?? null,
    memory_enabled: store.profile.memoryEnabled,
  };
  return { sessions, readings, messages, journal, memories, followUps, profile };
}

export async function importGuestData(): Promise<ImportResult> {
  const payload = buildMigrationPayload();
  try {
    const res = await fetch('/api/migrate/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false };
    const { imported }: { imported?: number } = (await res.json()) as { imported?: number };
    track('guest_data_imported');
    clearGuestData();
    return { ok: true, imported: typeof imported === 'number' ? imported : 0 };
  } catch {
    return { ok: false };
  }
}
