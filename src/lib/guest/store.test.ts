import { describe, expect, it } from 'vitest';
import {
  appendMessage,
  clearGuestData,
  deleteGuestSession,
  emptyGuestStore,
  getGuestSession,
  renameGuestSession,
  saveGuestProfile,
  loadGuestStore,
  saveInsight,
  saveJournalEntry,
  saveMemory,
  saveReading,
  saveSession,
} from './store';
import type { JournalEntry, Memory, StoredMessage, TarotReading } from '../types';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

// Test shim: the node test env has no window; the store only calls dispatchEvent.
const win = globalThis as { window?: { dispatchEvent: (event: unknown) => boolean } };
win.window = { dispatchEvent: () => true };


const storage = new MemoryStorage();
const session = {
  id: 's1',
  user_id: '',
  title: 'New Reflection',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  messages: [] as StoredMessage[],
  readings: [] as TarotReading[],
};

const message: StoredMessage = {
  id: 'm1',
  session_id: 's1',
  user_id: '',
  role: 'user',
  content: 'I feel stuck.',
  meta: {},
  created_at: '2026-01-01T00:01:00.000Z',
};

const reading: TarotReading = {
  id: 'r1',
  session_id: 's1',
  user_id: '',
  spread_id: 'one_card',
  seed: 42,
  cards: [],
  created_at: '2026-01-01T00:02:00.000Z',
};

const entry: JournalEntry = {
  id: 'j1',
  user_id: '',
  entry_type: 'freeform',
  title: null,
  body: 'A note.',
  mood: null,
  tags: [],
  ai_notes: [],
  source_session_id: null,
  source_reading_id: null,
  parent_entry_id: null,
  created_at: '2026-01-01T00:03:00.000Z',
  updated_at: '2026-01-01T00:03:00.000Z',
};

const memory: Memory = {
  id: 'mem1',
  user_id: '',
  category: 'preference',
  content: 'Short explanations.',
  source: 'Reflection preferences',
  active: true,
  created_at: '2026-01-01T00:04:00.000Z',
  updated_at: '2026-01-01T00:04:00.000Z',
};

describe('guest store round-trip', () => {
  it('persists every record type and reloads identically', () => {
    saveSession(session, storage);
    appendMessage('s1', message, storage);
    saveReading('s1', reading, storage);
    saveJournalEntry(entry, storage);
    saveInsight({ ...entry, id: 'j2', entry_type: 'insight', body: 'A realization.' }, storage);
    saveMemory(memory, storage);

    const store = loadGuestStore(storage);
    expect(store.version).toBe(1);
    expect(store.sessions).toHaveLength(1);
    expect(store.sessions[0].messages).toEqual([message]);
    expect(store.sessions[0].readings).toEqual([reading]);
    expect(store.journal).toHaveLength(2);
    expect(store.insights).toHaveLength(1);
    expect(store.memories).toEqual([memory]);
  });

  it('does not duplicate an appended message id', () => {
    appendMessage('s1', message, storage);
    expect(getGuestSession('s1', storage)?.messages).toHaveLength(1);
  });

  it('returns an empty store for missing or corrupt data', () => {
    storage.setItem('eclipsay.guest.v1', '{not json');
    expect(loadGuestStore(storage)).toEqual(emptyGuestStore());
    clearGuestData(storage);
    expect(loadGuestStore(storage)).toEqual(emptyGuestStore());
  });
});

describe('guest memory flag', () => {
  it('defaults memoryEnabled to true for legacy records without the flag', () => {
    storage.setItem(
      'eclipsay.guest.v1',
      JSON.stringify({ version: 1, profile: { reflectionGoal: 'growth' } }),
    );
    expect(loadGuestStore(storage).profile.memoryEnabled).toBe(true);
  });

  it('persists a disabled memory toggle across a round-trip', () => {
    saveGuestProfile({ memoryEnabled: false }, storage);
    expect(loadGuestStore(storage).profile.memoryEnabled).toBe(false);
    saveGuestProfile({ memoryEnabled: true }, storage);
    expect(loadGuestStore(storage).profile.memoryEnabled).toBe(true);
  });
});

describe('session rename and delete', () => {
  const isolated = new MemoryStorage();

  it('renames a session without touching its position or timestamps', () => {
    saveSession({ ...session, updated_at: '2026-01-02T00:00:00.000Z' }, isolated);
    renameGuestSession('s1', 'The stuck decision', isolated);
    const renamed = getGuestSession('s1', isolated);
    expect(renamed?.title).toBe('The stuck decision');
    expect(renamed?.updated_at).toBe('2026-01-02T00:00:00.000Z');
  });

  it('removes only the targeted session', () => {
    saveSession({ ...session, id: 's2', title: 'Second' }, isolated);
    deleteGuestSession('s2', isolated);
    expect(getGuestSession('s2', isolated)).toBeUndefined();
    expect(getGuestSession('s1', isolated)?.title).toBe('The stuck decision');
  });

  it('ignores renames and deletes for unknown sessions', () => {
    renameGuestSession('missing', 'Nope', isolated);
    deleteGuestSession('missing', isolated);
    expect(getGuestSession('s1', isolated)).toBeDefined();
  });
});
