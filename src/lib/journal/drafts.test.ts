import { describe, expect, it } from 'vitest';
import { clearJournalDraft, guestDraftOwner, JOURNAL_DRAFT_KEY, readJournalDraft, writeJournalDraft, type JournalDraft } from './drafts';

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

const draft: JournalDraft = {
  editId: 'entry-1',
  title: 'A thought',
  body: 'First line.\nSecond line.',
  mood: 'Neutral',
  tags: 'work, decisions',
};

describe('journal draft storage', () => {
  it('round-trips one active draft for its owner', () => {
    const storage = new MemoryStorage();
    const owner = guestDraftOwner();
    writeJournalDraft(owner, draft, storage);
    expect(readJournalDraft(owner, 'entry-1', storage)).toEqual(draft);
    expect(storage.getItem(JOURNAL_DRAFT_KEY)).not.toBeNull();
  });

  it('ignores a draft for another edit id', () => {
    const storage = new MemoryStorage();
    const owner = guestDraftOwner();
    writeJournalDraft(owner, draft, storage);
    expect(readJournalDraft(owner, 'entry-2', storage)).toBeNull();
    expect(readJournalDraft(owner, null, storage)).toBeNull();
  });

  // Audit A09: a draft written by one identity never restores into another's
  // editor — on shared browsers account drafts stay out of guest hands.
  it('never restores a draft across owners', () => {
    const storage = new MemoryStorage();
    writeJournalDraft('user-a', draft, storage);
    expect(readJournalDraft('user-b', 'entry-1', storage)).toBeNull();
    expect(readJournalDraft(guestDraftOwner(), 'entry-1', storage)).toBeNull();
    expect(readJournalDraft('user-a', 'entry-1', storage)).toEqual(draft);
  });

  it('keeps only the newest write per storage (owner payload replaced)', () => {
    const storage = new MemoryStorage();
    writeJournalDraft('user-a', draft, storage);
    const other: JournalDraft = { ...draft, editId: null, body: 'other' };
    writeJournalDraft('user-b', other, storage);
    expect(readJournalDraft('user-a', 'entry-1', storage)).toBeNull();
    expect(readJournalDraft('user-b', null, storage)).toEqual(other);
  });

  it('clears the active draft', () => {
    const storage = new MemoryStorage();
    const owner = guestDraftOwner();
    writeJournalDraft(owner, draft, storage);
    clearJournalDraft(storage);
    expect(readJournalDraft(owner, 'entry-1', storage)).toBeNull();
  });

  it('swallows unavailable storage failures', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(() => readJournalDraft(guestDraftOwner(), null, broken)).not.toThrow();
    expect(writeJournalDraft(guestDraftOwner(), { ...draft, editId: null }, broken)).toBe(false);
    expect(() => clearJournalDraft(broken)).not.toThrow();
  });
});
