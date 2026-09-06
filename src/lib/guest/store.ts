import type {
  FollowUp,
  FollowUpStatus,
  JournalEntry,
  Memory,
  Profile,
  ReflectionGoal,
  ReflectionSession,
  StoredMessage,
  TarotFamiliarity,
  TarotReading,
} from '../types';

import { JOURNAL_DRAFT_KEY } from '../journal/drafts';
// Guest data lives entirely in localStorage (PRD §13) — nothing is uploaded
// until an explicit migration. Row shapes mirror lib/types.ts 1:1 so the
// migration route can insert records unchanged.

export const GUEST_STORE_KEY = 'eclipsay.guest.v1';

/** Why a guest-store write/read failed (audit A19) — surfaced on the window. */
export type GuestStoreErrorReason = 'unavailable' | 'quota' | 'corrupt';

export const GUEST_STORE_ERROR_EVENT = 'eclipsay:guest-store-error';

function reportStoreError(reason: GuestStoreErrorReason): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(GUEST_STORE_ERROR_EVENT, { detail: { reason } }));
  } catch {
    // Events are best-effort; never throw from the data layer.
  }
}

export type GuestProfile = {
  reflectionGoal?: ReflectionGoal;
  tarotFamiliarity?: TarotFamiliarity;
  // Master switch for memory use in prompts (PRD §41). Always present in memory:
  // readStore defaults it to true for records written before this field existed.
  memoryEnabled: boolean;
  // Audit A36: the guest eligibility step (13+ product floor; 13–17 gets the
  // conservative teen policy server-side). Absent = unspecified, which the
  // chat route treats conservatively.
  ageBracket?: '13_17' | '18_plus';
};

export type GuestSession = ReflectionSession & {
  messages: StoredMessage[];
  readings: TarotReading[];
};

export type GuestStore = {
  version: 1;
  profile: GuestProfile;
  onboardingDone?: boolean;
  sessions: GuestSession[];
  journal: JournalEntry[];
  insights: JournalEntry[];
  memories: Memory[];
  followUps: FollowUp[];
};

export function emptyGuestStore(): GuestStore {
  return {
    version: 1,
    profile: { memoryEnabled: true },
    sessions: [],
    journal: [],
    insights: [],
    memories: [],
    followUps: [],
  };
}


function defaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  // Audit A19: storage can be denied (SecurityError) or missing; the store
  // degrades to in-memory instead of throwing out of chat actions.
  try {
    return window.localStorage;
  } catch {
    reportStoreError('unavailable');
    return null;
  }
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStore(storage: Storage | null): GuestStore {
  if (!storage) return emptyGuestStore();
  let raw: string | null = null;
  try {
    raw = storage.getItem(GUEST_STORE_KEY);
  } catch {
    reportStoreError('unavailable');
    return emptyGuestStore();
  }
  if (!raw) return emptyGuestStore();
  try {
    const parsed = JSON.parse(raw) as GuestStore;
    if (!isRecordLike(parsed) || parsed.version !== 1) {
      reportStoreError('corrupt');
      return emptyGuestStore();
    }
    // Normalize the profile so records written before memoryEnabled upgrade
    // silently to the default (on) instead of blocking memory use (PRD §41).
    const profileSource: Record<string, unknown> = isRecordLike(parsed.profile) ? parsed.profile : {};
    const profile: GuestProfile = {
      reflectionGoal: profileSource.reflectionGoal as GuestProfile['reflectionGoal'],
      tarotFamiliarity: profileSource.tarotFamiliarity as GuestProfile['tarotFamiliarity'],
      memoryEnabled: profileSource.memoryEnabled !== false,
      ageBracket: profileSource.ageBracket as GuestProfile['ageBracket'],
    };
    // Audit A19: corrupt records are dropped row-wise, never crash readers —
    // and valid siblings stay usable.
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions.filter(isRecordLike) : [];
    const journal = Array.isArray(parsed.journal) ? parsed.journal.filter(isRecordLike) : [];
    const insights = Array.isArray(parsed.insights) ? parsed.insights.filter(isRecordLike) : [];
    const memories = Array.isArray(parsed.memories) ? parsed.memories.filter(isRecordLike) : [];
    const followUps = Array.isArray(parsed.followUps) ? parsed.followUps.filter(isRecordLike) : [];
    return {
      ...emptyGuestStore(),
      ...parsed,
      profile,
      sessions: sessions as GuestStore['sessions'],
      journal: journal as GuestStore['journal'],
      insights: insights as GuestStore['insights'],
      memories: memories as GuestStore['memories'],
      followUps: followUps as GuestStore['followUps'],
    };
  } catch {
    reportStoreError('corrupt');
    return emptyGuestStore();
  }
}

function writeStore(store: GuestStore, storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(GUEST_STORE_KEY, JSON.stringify(store));
    return true;
  } catch {
    // Audit A19: quota/full storage must not throw out of chat or onboarding
    // actions; the UI listens for the error event to explain the state.
    reportStoreError('quota');
    return false;
  }
}
function mutate(fn: (store: GuestStore) => void, storage?: Storage): void {
  const target = storage ?? defaultStorage();
  const store = readStore(target);
  fn(store);
  writeStore(store, target);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eclipsay:guest-store-changed'));
  }
}

export function loadGuestStore(storage?: Storage): GuestStore {
  return readStore(storage ?? defaultStorage());
}


export function saveGuestProfile(patch: Partial<GuestProfile> & { onboardingDone?: boolean }, storage?: Storage): void {
  mutate((store) => {
    const { onboardingDone, ...profilePatch } = patch;
    store.profile = { ...store.profile, ...profilePatch };
    if (onboardingDone !== undefined) store.onboardingDone = onboardingDone;
  }, storage);
}

/** Updates an entry wherever it lives (journal + insights copies stay in sync). */
export function updateGuestEntry(entry: JournalEntry, storage?: Storage): void {
  mutate((store) => {
    const j = store.journal.findIndex((e) => e.id === entry.id);
    if (j >= 0) store.journal[j] = entry;
    const i = store.insights.findIndex((e) => e.id === entry.id);
    if (i >= 0) store.insights[i] = entry;
  }, storage);
}

export function saveSession(session: GuestSession, storage?: Storage): void {
  mutate((store) => {
    const existing = store.sessions.findIndex((s) => s.id === session.id);
    if (existing >= 0) store.sessions[existing] = session;
    else store.sessions.unshift(session);
  }, storage);
}

export function getGuestSession(id: string, storage?: Storage): GuestSession | undefined {
  return readStore(storage ?? defaultStorage()).sessions.find((s) => s.id === id);
}

export function appendMessage(sessionId: string, message: StoredMessage, storage?: Storage): void {
  mutate((store) => {
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    if (session.messages.some((m) => m.id === message.id)) return;
    session.messages.push(message);
    session.updated_at = new Date().toISOString();
  }, storage);
}

export function updateMessageMeta(
  sessionId: string,
  messageId: string,
  patch: Partial<StoredMessage['meta']>,
  storage?: Storage,
): void {
  mutate((store) => {
    const message = store.sessions.find((s) => s.id === sessionId)?.messages.find((m) => m.id === messageId);
    if (!message) return;
    message.meta = { ...message.meta, ...patch };
  }, storage);
}

export function saveReading(sessionId: string, reading: TarotReading, storage?: Storage): void {
  mutate((store) => {
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const existing = session.readings.findIndex((r) => r.id === reading.id);
    if (existing >= 0) session.readings[existing] = reading;
    else session.readings.push(reading);
  }, storage);
}

export function saveJournalEntry(entry: JournalEntry, storage?: Storage): void {
  mutate((store) => {
    const existing = store.journal.findIndex((e) => e.id === entry.id);
    if (existing >= 0) store.journal[existing] = entry;
    else store.journal.unshift(entry);
  }, storage);
}

export function saveInsight(entry: JournalEntry, storage?: Storage): void {
  mutate((store) => {
    if (!store.insights.some((e) => e.id === entry.id)) store.insights.unshift(entry);
    if (!store.journal.some((e) => e.id === entry.id)) store.journal.unshift(entry);
  }, storage);
}

export function saveMemory(memory: Memory, storage?: Storage): void {
  mutate((store) => {
    const existing = store.memories.findIndex((m) => m.id === memory.id);
    if (existing >= 0) store.memories[existing] = memory;
    else store.memories.unshift(memory);
  }, storage);
}

export function deleteMemory(id: string, storage?: Storage): void {
  mutate((store) => {
    store.memories = store.memories.filter((m) => m.id !== id);
  }, storage);
}

export function deleteJournalEntry(id: string, storage?: Storage): void {
  mutate((store) => {
    store.journal = store.journal.filter((e) => e.id !== id);
    store.insights = store.insights.filter((e) => e.id !== id);
    // Audit A12: reminders linked to a deleted entry are deleted with it,
    // mirroring the account-side ON DELETE CASCADE (0001_init.sql).
    store.followUps = store.followUps.filter((f) => f.journal_entry_id !== id);
  }, storage);
}

export function renameGuestSession(id: string, title: string, storage?: Storage): void {
  mutate((store) => {
    const session = store.sessions.find((s) => s.id === id);
    if (!session) return;
    session.title = title;
  }, storage);
}

export function deleteGuestSession(id: string, storage?: Storage): void {
  mutate((store) => {
    store.sessions = store.sessions.filter((s) => s.id !== id);
    // Audit A12: no stale reminder for a deleted reflection.
    store.followUps = store.followUps.filter((f) => f.session_id !== id);
  }, storage);
}

export function clearGuestData(storage?: Storage): void {
  const target = storage ?? defaultStorage();
  target?.removeItem(GUEST_STORE_KEY);
  target?.removeItem(JOURNAL_DRAFT_KEY);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage?.removeItem(JOURNAL_DRAFT_KEY);
    } catch {
      // Session storage is optional and may be blocked.
    }
    window.dispatchEvent(new CustomEvent('eclipsay:guest-store-changed'));
  }
}

/** Whether the store holds any data worth migrating (PRD §64). */
export function guestStoreHasData(storage?: Storage): boolean {
  const store = loadGuestStore(storage);
  return store.sessions.length > 0 || store.journal.length > 0 || store.insights.length > 0 || store.memories.length > 0;
}

// Profile field mapping between micro-onboarding answers and the profiles row.
export function goalToDb(goal: ReflectionGoal | undefined): Profile['reflection_goal'] {
  return goal ?? null;
}

export function familiarityToDb(f: TarotFamiliarity | undefined): Profile['tarot_familiarity'] {
  return f ?? null;
}

export function saveFollowUp(followUp: FollowUp, storage?: Storage): void {
  mutate((store) => {
    if (!store.followUps.some((f) => f.id === followUp.id)) store.followUps.unshift(followUp);
  }, storage);
}

export function updateFollowUpStatus(id: string, status: FollowUpStatus, storage?: Storage): void {
  mutate((store) => {
    const followUp = store.followUps.find((f) => f.id === id);
    if (followUp) followUp.status = status;
  }, storage);
}

export function clearGuestHistory(storage?: Storage): void {
  mutate((store) => {
    store.sessions = [];
    store.followUps = [];
  }, storage);
}

export function clearAllGuestMemories(storage?: Storage): void {
  mutate((store) => {
    store.memories = [];
  }, storage);
}

export function dueGuestFollowUps(now = new Date()): FollowUp[] {
  return loadGuestStore().followUps.filter((f) => f.status === 'pending' && new Date(f.due_at) <= now);
}
