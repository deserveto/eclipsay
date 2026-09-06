'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EntryDeletedError, appendAiNote, listEntries, makeEntry, persistEntry, removeEntry } from '@/lib/journal/entries';
import { clearJournalDraft, guestDraftOwner, readJournalDraft, writeJournalDraft, type JournalDraft } from '@/lib/journal/drafts';
import { guestSaveToast } from '@/lib/account-nudge';
import { useDataMode } from '@/hooks/use-data-mode';
import { createClient } from '@/lib/supabase/client';
import type { AiNoteType, JournalEntry, Mood } from '@/lib/types';
import { toast } from 'sonner';

const MOODS: Mood[] = ['Low', 'Anxious', 'Neutral', 'Good', 'Energized'];

const ASSIST_ACTIONS: { type: AiNoteType; label: string }[] = [
  { type: 'unpack', label: 'Help me unpack this' },
  { type: 'prompts', label: 'Give me reflection prompts' },
  { type: 'insight', label: 'Extract an insight' },
  { type: 'summary', label: 'Summarize what I\u2019m feeling' },
];

// Audit A20: an edit target loads asynchronously — the form stays closed
// until the entry resolved, and "missing"/"error" are explicit states.
type LoadState = 'loading' | 'ready' | 'missing' | 'error';

function normalizeDraft(draft: JournalDraft): JournalDraft {
  return {
    editId: draft.editId,
    title: draft.title.trim(),
    body: draft.body,
    mood: draft.mood,
    tags: draft.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .join(', '),
  };
}

function ComposerInner() {
  const router = useRouter();
  const { mode, resolving } = useDataMode();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<Mood | ''>('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [assistBusy, setAssistBusy] = useState<AiNoteType | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [draftSaved, setDraftSaved] = useState(false);
  // Audit A09: drafts carry their owner (guest vs account user id) inside the
  // stored payload; reads only restore drafts written by the same identity.
  const [draftOwner, setDraftOwner] = useState<string>(guestDraftOwner());
  const [hydrateNonce, setHydrateNonce] = useState(0);
  const draftTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoadState(editId ? 'loading' : 'ready');
    setDraftSaved(false);
    if (draftTimer.current !== null) {
      window.clearTimeout(draftTimer.current);
      draftTimer.current = null;
    }

    const applyValues = (nextEntry: JournalEntry | null, savedDraft: JournalDraft | null) => {
      if (!active) return;
      const baseline: JournalDraft = {
        editId,
        title: nextEntry?.title ?? '',
        body: nextEntry?.body ?? '',
        mood: nextEntry?.mood ?? '',
        tags: nextEntry?.tags.join(', ') ?? '',
      };
      const values = savedDraft ?? baseline;
      setEntry(nextEntry);
      setTitle(values.title);
      setBody(values.body);
      setMood((values.mood as Mood) || '');
      setTags(values.tags);
      setLoadState(nextEntry || !editId ? 'ready' : 'missing');
    };

    const resolveOwner = async (): Promise<string> => {
      // Audit A09: the owner must be resolved BEFORE any draft is read or
      // written, so an account user never inherits a guest draft (or the
      // reverse). Guests resolve synchronously.
      if (mode !== 'account') return guestDraftOwner();
      try {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        return user?.id ?? guestDraftOwner();
      } catch {
        return guestDraftOwner();
      }
    };

    const hydrate = async () => {
      const owner = await resolveOwner();
      if (!active) return;
      setDraftOwner(owner);
      if (!editId) {
        applyValues(null, readJournalDraft(owner, null));
        return;
      }
      const result = await listEntries();
      if (!active) return;
      if (result.status === 'error') {
        // Audit A13: a failed read is an explicit error state with retry —
        // never an empty editor masquerading as a missing entry.
        setLoadState('error');
        return;
      }
      const found = result.entries.find((e) => e.id === editId) ?? null;
      applyValues(found, found ? readJournalDraft(owner, editId) : null);
    };

    if (!resolving) void hydrate();
    return () => {
      active = false;
    };
  }, [editId, mode, resolving, hydrateNonce]);

  const currentDraft: JournalDraft = { editId, title, body, mood, tags };
  const persistedDraft: JournalDraft = {
    editId,
    title: entry?.title ?? '',
    body: entry?.body ?? '',
    mood: entry?.mood ?? '',
    tags: entry?.tags.join(', ') ?? '',
  };
  const draftDirty =
    loadState === 'ready' && JSON.stringify(normalizeDraft(currentDraft)) !== JSON.stringify(normalizeDraft(persistedDraft));

  useEffect(() => {
    if (resolving || loadState !== 'ready') return;
    if (!draftDirty) {
      clearJournalDraft();
      setDraftSaved(false);
      return;
    }

    setDraftSaved(false);
    draftTimer.current = window.setTimeout(() => {
      // Audit A09: drafts persist for BOTH modes (device-local, per owner +
      // entry), so account users lose nothing when the exit message points
      // them to the draft.
      if (writeJournalDraft(draftOwner, { editId, title, body, mood, tags })) {
        setDraftSaved(true);
      }
      draftTimer.current = null;
    }, 250);

    return () => {
      if (draftTimer.current !== null) {
        window.clearTimeout(draftTimer.current);
        draftTimer.current = null;
      }
    };
  }, [body, draftDirty, draftOwner, editId, loadState, mode, mood, resolving, tags, title]);

  const save = async () => {
    if (body.trim().length === 0 || loadState !== 'ready') return;
    setBusy(true);
    try {
      const base =
        entry ??
        makeEntry({
          body: '',
          entry_type: 'freeform',
        });
      const updated: JournalEntry = {
        ...base,
        title: title.trim() || null,
        body: body.trim(),
        mood: mood || null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        updated_at: new Date().toISOString(),
      };
      await persistEntry(updated);
      clearJournalDraft();
      setDraftSaved(false);
      if (mode === 'guest') {
        // Value moment after a local save (PRD §14, plan: Accounts §5).
        guestSaveToast('Saved to your journal.', router.push);
      } else {
        toast.success('Saved to your journal.');
      }
      router.push('/journal');
    } catch {
      toast.error('Could not save. Your text is still here — try again.');
    } finally {
      setBusy(false);
    }
  };

  const runAssist = async (type: AiNoteType) => {
    if (body.trim().length === 0 || !entry) return;
    setAssistBusy(type);
    try {
      const res = await fetch('/api/journal-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: type, content: body }),
      });
      if (!res.ok) throw new Error();
      const { note } = (await res.json()) as { note: string };
      // Audit A02: the note lands on the entry's CURRENT state — a save that
      // happened while the assist ran is preserved, and a deleted entry makes
      // the append fail instead of resurrecting the row.
      const updated = await appendAiNote(entry.id, type, note);
      setEntry(updated);
      toast.success('AI note added below — your entry is unchanged.');
    } catch (error) {
      if (error instanceof EntryDeletedError) {
        toast.error('This entry was just deleted — the AI note was not added.');
        setLoadState('missing');
        setEntry(null);
      } else {
        toast.error('The assist did not work just now. Try again in a moment.');
      }
    } finally {
      setAssistBusy(null);
    }
  };

  const confirmExit = () =>
    body.trim().length === 0 ||
    // Audit A09: truthful copy — the draft lives in sessionStorage and dies
    // with this tab. It never leaves the device.
    window.confirm('Leave this entry? Your draft is kept on this device until you close this tab.');

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (body.trim().length === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [body]);

  const loading = loadState === 'loading';

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <Link
          href="/journal"
          onClick={(e) => {
            if (!confirmExit()) e.preventDefault();
          }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Journal
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">{editId ? 'Edit entry' : 'New entry'}</h1>
      </header>

      {loadState === 'error' && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm">Your entry couldn&apos;t be loaded just now. Nothing is lost — try again.</p>
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={() => setHydrateNonce((n) => n + 1)}>
              Try again
            </Button>
          </div>
        </div>
      )}
      {loadState === 'missing' && (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3" role="status">
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find that entry — it may have been deleted. Saving will create a new entry with what you have here.
          </p>
        </div>
      )}

      <div className={loading ? 'pointer-events-none space-y-4 opacity-50' : 'space-y-4'} aria-busy={loading}>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title (optional)</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is this about?" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body">Your entry</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Write for yourself — no one else will see this unless you choose to share it."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mood">Mood (optional)</Label>
            <Select value={mood || undefined} onValueChange={(v) => setMood(v as Mood)}>
              <SelectTrigger id="mood" className="w-full">
                <SelectValue placeholder="Skip" />
              </SelectTrigger>
              <SelectContent>
                {MOODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (optional, comma-separated)</Label>
            <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="work, decisions" />
          </div>
        </div>

        {entry && entry.ai_notes.length > 0 && (
          <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/40 p-4" aria-label="AI notes">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">AI notes</p>
            {entry.ai_notes.map((note) => (
              <div key={note.id} className="rounded-lg bg-card px-3 py-2 text-sm leading-6">
                <p className="text-[11px] tracking-wide text-primary uppercase">{note.type}</p>
                <p className="whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={busy || loading || body.trim().length === 0}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {entry && (
            <>
              {ASSIST_ACTIONS.map(({ type, label }) => (
                <Button key={type} variant="secondary" size="sm" disabled={assistBusy !== null || busy} onClick={() => runAssist(type)}>
                  {assistBusy === type ? 'Thinking…' : label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                disabled={assistBusy !== null || busy}
                onClick={() => {
                  // Audit A21: the tarot starter carries structured intent
                  // into the chat composer — never the entry text.
                  router.push('/reflect?intent=tarot');
                }}
              >
                Reflect with tarot
              </Button>
            </>
          )}
        </div>
        {draftSaved && draftDirty && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Draft saved on this device (kept until you close this tab)
          </p>
        )}

        {entry && (
          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (window.confirm('Delete this journal entry? This cannot be undone.')) {
                  void removeEntry(entry.id)
                    .then(() => {
                      clearJournalDraft();
                      router.push('/journal');
                    })
                    .catch(() => toast.error('Could not delete the entry. Try again.'));
                }
              }}
            >
              Delete entry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary under App Router.
export function JournalComposer() {
  return (
    <Suspense fallback={null}>
      <ComposerInner />
    </Suspense>
  );
}
