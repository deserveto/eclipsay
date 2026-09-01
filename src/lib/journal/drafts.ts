export const JOURNAL_DRAFT_KEY = 'eclipsay.journal-draft.v1';

export type JournalDraft = {
  editId: string | null;
  title: string;
  body: string;
  mood: string;
  tags: string;
};

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

export function readJournalDraft(editId: string | null, storage?: Storage): JournalDraft | null {
  const target = storage ?? defaultStorage();
  if (!target) return null;
  try {
    const raw = target.getItem(JOURNAL_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isJournalDraft(parsed) || parsed.editId !== editId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeJournalDraft(draft: JournalDraft, storage?: Storage): boolean {
  const target = storage ?? defaultStorage();
  if (!target) return false;
  try {
    target.setItem(JOURNAL_DRAFT_KEY, JSON.stringify(draft));
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
