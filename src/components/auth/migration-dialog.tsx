'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { clearGuestData, loadGuestStore } from '@/lib/guest/store';
import { track } from '@/lib/analytics';
import { toast } from 'sonner';

const MIGRATION_PROMPT_KEY = 'eclipsay.migration.prompt.v1';

function guestStoreHasData(): boolean {
  const store = loadGuestStore();
  return store.sessions.length > 0 || store.journal.length > 0 || store.insights.length > 0 || store.memories.length > 0;
}

// Post-verify migration prompt (plan: Accounts; PRD §13, §64).
// Local data is cleared ONLY after the server confirms the import (200).
export function MigrationDialog({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (localStorage.getItem(MIGRATION_PROMPT_KEY)) return;
    if (guestStoreHasData()) setOpen(true);
  }, [enabled]);

  const close = () => {
    localStorage.setItem(MIGRATION_PROMPT_KEY, '1');
    setOpen(false);
  };

  const importReflections = async () => {
    setBusy(true);
    try {
      const store = loadGuestStore();
      const sessions = store.sessions.map((s) => ({
        id: s.id,
        title: s.title,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }));
      const readings = store.sessions.flatMap((s) =>
        s.readings.map((r) => ({
          id: r.id,
          session_id: r.session_id || s.id,
          spread_id: r.spread_id,
          seed: r.seed,
          cards: r.cards,
          created_at: r.created_at,
        })),
      );
      const messages = store.sessions.flatMap((s) =>
        s.messages.map((m) => ({
          id: m.id,
          session_id: m.session_id || s.id,
          role: m.role,
          content: m.content,
          meta: m.meta as Record<string, unknown>,
          created_at: m.created_at,
        })),
      );
      const journal = [...store.journal, ...store.insights].map((e) => ({
        id: e.id,
        entry_type: e.entry_type,
        title: e.title,
        body: e.body,
        mood: e.mood,
        tags: e.tags,
        ai_notes: e.ai_notes as unknown[],
        source_session_id: e.source_session_id,
        source_reading_id: e.source_reading_id,
        parent_entry_id: e.parent_entry_id,
        created_at: e.created_at,
        updated_at: e.updated_at,
      }));
      const memories = store.memories.map((m) => ({
        id: m.id,
        category: m.category,
        content: m.content,
        source: m.source,
        active: m.active,
        created_at: m.created_at,
        updated_at: m.updated_at,
      }));

      const res = await fetch('/api/migrate/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions, readings, messages, journal, memories }),
      });
      if (!res.ok) throw new Error('migration failed');
      track('guest_data_imported');
      clearGuestData();
      localStorage.setItem(MIGRATION_PROMPT_KEY, '1');
      setOpen(false);
      toast.success('Your reflections are now on your account.');
    } catch {
      toast.error('We could not import right now. Your local reflections are untouched — try again.');
    } finally {
      setBusy(false);
    }
  };

  const startFresh = () => {
    // Destructive: this permanently deletes every guest record in this
    // browser. Same guard as the settings clear path (repo convention).
    if (!window.confirm('Delete all local reflections without importing? This cannot be undone.')) return;
    clearGuestData();
    localStorage.setItem(MIGRATION_PROMPT_KEY, '1');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bring your existing reflections with you?</DialogTitle>
          <DialogDescription>
            Your guest reflections live in this browser. Importing moves them to your account so they follow you
            everywhere.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2" aria-live="polite">
          <Button onClick={importReflections} disabled={busy}>
            {busy ? 'Importing…' : 'Import reflections'}
          </Button>
          <Button variant="ghost" onClick={startFresh} disabled={busy}>
            Start fresh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
