'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { appendAiNote, listEntries, makeEntry, persistEntry, removeEntry } from '@/lib/journal/entries';
import type { AiNoteType, JournalEntry, Mood } from '@/lib/types';
import { toast } from 'sonner';

const MOODS: Mood[] = ['Low', 'Anxious', 'Neutral', 'Good', 'Energized'];

const ASSIST_ACTIONS: { type: AiNoteType; label: string }[] = [
  { type: 'unpack', label: 'Help me unpack this' },
  { type: 'prompts', label: 'Give me reflection prompts' },
  { type: 'insight', label: 'Extract an insight' },
  { type: 'summary', label: 'Summarize what I\u2019m feeling' },
];

function ComposerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<Mood | ''>('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [assistBusy, setAssistBusy] = useState<AiNoteType | null>(null);

  useEffect(() => {
    if (!editId) return;
    listEntries().then((entries) => {
      const found = entries.find((e) => e.id === editId);
      if (found) {
        setEntry(found);
        setTitle(found.title ?? '');
        setBody(found.body);
        setMood((found.mood as Mood) ?? '');
        setTags(found.tags.join(', '));
      }
    });
  }, [editId]);

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
      toast.success('Saved to your journal.');
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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <Link
          href="/journal"
          onClick={(e) => {
            if (body.trim().length > 0 && !window.confirm('Leave this entry? Unsaved text will be lost.')) {
              e.preventDefault();
            }
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
                onClick={() => router.push(`/reflect?tarot=1&prefill=${encodeURIComponent(body.slice(0, 200))}`)}
              >
                Reflect with tarot
              </Button>
            </>
          )}
        </div>

        {entry && (
          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (window.confirm('Delete this journal entry? This cannot be undone.')) {
                  void removeEntry(entry.id)
                    .then(() => router.push('/journal'))
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
