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
import { appendAiNote, listEntries, makeEntry, persistEntry, removeEntry } from '@/lib/journal/entries';
import { clearJournalDraft, readJournalDraft, writeJournalDraft, type JournalDraft } from '@/lib/journal/drafts';
import { guestSaveToast } from '@/lib/account-nudge';
import { useDataMode } from '@/hooks/use-data-mode';
import type { AiNoteType, JournalEntry, Mood } from '@/lib/types';
import { toast } from 'sonner';

const MOODS: Mood[] = ['Low', 'Anxious', 'Neutral', 'Good', 'Energized'];

const ASSIST_ACTIONS: { type: AiNoteType; label: string }[] = [
  { type: 'unpack', label: 'Help me unpack this' },
  { type: 'prompts', label: 'Give me reflection prompts' },
  { type: 'insight', label: 'Extract an insight' },
  { type: 'summary', label: 'Summarize what I\u2019m feeling' },
];

function normalizeDraft(draft: JournalDraft): JournalDraft {
  return {
    editId: draft.editId,
    title: draft.title.trim(),
    body: draft.body.trim(),
    mood: draft.mood.trim(),
    tags: draft.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join(', '),
  };
}

function ComposerInner() {
  const router = useRouter();
  const { mode } = useDataMode();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<Mood | ''>('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [assistBusy, setAssistBusy] = useState<AiNoteType | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const draftTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setHydrated(false);
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
      setHydrated(true);
    };

    if (!editId) {
      applyValues(null, mode === 'guest' ? readJournalDraft(null) : null);
      return () => {
        active = false;
      };
    }

    listEntries()
      .then((entries) => {
        const found = entries.find((e) => e.id === editId) ?? null;
        const savedDraft = found && mode === 'guest' ? readJournalDraft(editId) : null;
        applyValues(found, savedDraft);
      })
      .catch(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [editId, mode]);

  const currentDraft: JournalDraft = { editId, title, body, mood, tags };
  const persistedDraft: JournalDraft = {
    editId,
    title: entry?.title ?? '',
    body: entry?.body ?? '',
    mood: entry?.mood ?? '',
    tags: entry?.tags.join(', ') ?? '',
  };
  const guestDraftDirty =
    hydrated && JSON.stringify(normalizeDraft(currentDraft)) !== JSON.stringify(normalizeDraft(persistedDraft));

  useEffect(() => {
    if (!hydrated || mode !== 'guest') return;
    if (!guestDraftDirty) {
      clearJournalDraft();
      setDraftSaved(false);
      return;
    }

    setDraftSaved(false);
    draftTimer.current = window.setTimeout(() => {
      if (writeJournalDraft({ editId, title, body, mood, tags })) {
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
  }, [body, editId, entry, guestDraftDirty, hydrated, mode, mood, tags, title]);

  const save = async () => {
    if (body.trim().length === 0) return;
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
      if (mode === 'guest') {
        clearJournalDraft();
        setDraftSaved(false);
      }
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
      const updated = await appendAiNote(entry, type, note);
      setEntry(updated);
      toast.success('AI note added below — your entry is unchanged.');
    } catch {
      toast.error('The assist did not work just now. Try again in a moment.');
    } finally {
      setAssistBusy(null);
    }
  };

  const confirmExit = () =>
    body.trim().length === 0 || window.confirm('Leave this entry? Your draft is kept on this device.');

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (body.trim().length === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [body]);

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

      <div className="space-y-4">
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
          <Button onClick={save} disabled={busy || body.trim().length === 0}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {entry && (
            <>
              {ASSIST_ACTIONS.map(({ type, label }) => (
                <Button key={type} variant="secondary" size="sm" disabled={assistBusy !== null} onClick={() => runAssist(type)}>
                  {assistBusy === type ? 'Thinking…' : label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirmExit()) {
                    router.push(`/reflect?tarot=1&prefill=${encodeURIComponent(body.slice(0, 200))}`);
                  }
                }}
              >
                Reflect with tarot
              </Button>
            </>
          )}
        </div>
        {mode === 'guest' && draftSaved && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Draft saved locally
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
                      if (mode === 'guest') clearJournalDraft();
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
