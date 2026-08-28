import type {
  JournalEntry,
  Memory,
  Profile,
  ReflectionGoal,
  ReflectionSession,
  StoredMessage,
  TarotFamiliarity,
  TarotReading,
} from '../types';

// Guest data lives entirely in localStorage (PRD §13) — nothing is uploaded
// until an explicit migration. Row shapes mirror lib/types.ts 1:1 so the
// migration route can insert records unchanged.

export const GUEST_STORE_KEY = 'eclipsay.guest.v1';

export type GuestProfile = {
  reflectionGoal?: ReflectionGoal;
  tarotFamiliarity?: TarotFamiliarity;
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
};

export function emptyGuestStore(): GuestStore {
  return { version: 1, profile: {}, sessions: [], journal: [], insights: [], memories: [] };
}

function defaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function readStore(storage: Storage | null): GuestStore {
  if (!storage) return emptyGuestStore();
  const raw = storage.getItem(GUEST_STORE_KEY);
  if (!raw) return emptyGuestStore();
  try {
    const parsed = JSON.parse(raw) as GuestStore;
    if (parsed.version !== 1) return emptyGuestStore();
    return {
      ...emptyGuestStore(),
      ...parsed,
      profile: parsed.profile ?? {},
      sessions: parsed.sessions ?? [],
      journal: parsed.journal ?? [],
      insights: parsed.insights ?? [],
      memories: parsed.memories ?? [],
    };
  } catch {
    return emptyGuestStore();
  }
}

function writeStore(store: GuestStore, storage: Storage | null): void {
  storage?.setItem(GUEST_STORE_KEY, JSON.stringify(store));
}

function mutate(fn: (store: GuestStore) => void, storage?: Storage): void {
  const target = storage ?? defaultStorage();
  const store = readStore(target);
  fn(store);
  writeStore(store, target);
  window.dispatchEvent(new CustomEvent('eclipsay:guest-store-changed'));
}

export function loadGuestStore(storage?: Storage): GuestStore {
  return readStore(storage ?? defaultStorage());
}


export function saveGuestProfile(patch: GuestProfile & { onboardingDone?: boolean }, storage?: Storage): void {
  mutate((store) => {
    const { onboardingDone, ...profilePatch } = patch;
    store.profile = { ...store.profile, ...profilePatch };
    if (onboardingDone !== undefined) store.onboardingDone = onboardingDone;
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
  }, storage);
}

export function deleteGuestSession(id: string, storage?: Storage): void {
  mutate((store) => {
    store.sessions = store.sessions.filter((s) => s.id !== id);
  }, storage);
}

export function clearGuestData(storage?: Storage): void {
  (storage ?? defaultStorage())?.removeItem(GUEST_STORE_KEY);
  window.dispatchEvent(new CustomEvent('eclipsay:guest-store-changed'));
}

// Profile field mapping between micro-onboarding answers and the profiles row.
export function goalToDb(goal: ReflectionGoal | undefined): Profile['reflection_goal'] {
  return goal ?? null;
}

export function familiarityToDb(f: TarotFamiliarity | undefined): Profile['tarot_familiarity'] {
  return f ?? null;
}
