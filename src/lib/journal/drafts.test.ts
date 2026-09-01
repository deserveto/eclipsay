import { describe, expect, it } from 'vitest';
import { clearJournalDraft, JOURNAL_DRAFT_KEY, readJournalDraft, writeJournalDraft, type JournalDraft } from './drafts';

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
  it('round-trips one active draft', () => {
    const storage = new MemoryStorage();
    writeJournalDraft(draft, storage);
    expect(readJournalDraft('entry-1', storage)).toEqual(draft);
    expect(storage.getItem(JOURNAL_DRAFT_KEY)).not.toBeNull();
  });

  it('ignores a draft for another edit id', () => {
    const storage = new MemoryStorage();
    writeJournalDraft(draft, storage);
    expect(readJournalDraft('entry-2', storage)).toBeNull();
    expect(readJournalDraft(null, storage)).toBeNull();
  });

  it('clears the active draft', () => {
    const storage = new MemoryStorage();
    writeJournalDraft(draft, storage);
    clearJournalDraft(storage);
    expect(readJournalDraft('entry-1', storage)).toBeNull();
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
    expect(() => readJournalDraft(null, broken)).not.toThrow();
    expect(writeJournalDraft({ ...draft, editId: null }, broken)).toBe(false);
    expect(() => clearJournalDraft(broken)).not.toThrow();
  });
});
