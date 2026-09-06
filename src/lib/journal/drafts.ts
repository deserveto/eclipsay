export const JOURNAL_DRAFT_KEY = 'eclipsay.journal-draft.v1';

export type JournalDraft = {
  editId: string | null;
  title: string;
  body: string;
  mood: string;
  tags: string;
};

export type JournalDraftOwner = string;

/**
 * Audit A09: drafts are scoped to their owner (`guest`, or the account user
 * id) AND the entry they belong to. A draft written by one identity is never
 * restored into another's editor — on shared browsers this keeps account
 * drafts out of guest hands and vice versa. sessionStorage is the deliberate
 * privacy policy: drafts die with the tab, never leave the device, and the
 * composer copy says exactly that.
 */
export function guestDraftOwner(): JournalDraftOwner {
  return 'guest';
}

type StoredDraft = { owner: JournalDraftOwner; draft: JournalDraft };

function defaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isJournalDraft(value: unknown): value is JournalDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return (
    (draft.editId === null || typeof draft.editId === 'string') &&
    typeof draft.title === 'string' &&
    typeof draft.body === 'string' &&
    typeof draft.mood === 'string' &&
    typeof draft.tags === 'string'
  );
}

function parseStored(raw: string, owner: JournalDraftOwner, editId: string | null): JournalDraft | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const stored = parsed as Partial<StoredDraft>;
    if (stored.owner !== owner) return null;
    if (!isJournalDraft(stored.draft)) return null;
    return stored.draft.editId === editId ? stored.draft : null;
  } catch {
    return null;
  }
}

export function readJournalDraft(owner: JournalDraftOwner, editId: string | null, storage?: Storage): JournalDraft | null {
  const target = storage ?? defaultStorage();
  if (!target) return null;
  try {
    const raw = target.getItem(JOURNAL_DRAFT_KEY);
    if (!raw) return null;
    return parseStored(raw, owner, editId);
  } catch {
    return null;
  }
}

export function writeJournalDraft(owner: JournalDraftOwner, draft: JournalDraft, storage?: Storage): boolean {
  const target = storage ?? defaultStorage();
  if (!target) return false;
  try {
    const stored: StoredDraft = { owner, draft };
    target.setItem(JOURNAL_DRAFT_KEY, JSON.stringify(stored));
    return true;
  } catch {
    // Browser storage is optional; the in-memory editor remains authoritative.
    return false;
  }
}

export function clearJournalDraft(storage?: Storage): void {
  const target = storage ?? defaultStorage();
  if (!target) return;
  try {
    target.removeItem(JOURNAL_DRAFT_KEY);
  } catch {
    // Browser storage is optional and must never block the editor.
  }
}
