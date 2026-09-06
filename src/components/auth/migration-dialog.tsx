'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { clearGuestData, guestStoreHasData } from '@/lib/guest/store';
import { importGuestData } from '@/lib/guest/migration-client';
import { toast } from 'sonner';

// Post-verify migration prompt (plan: Accounts; PRD §13, §64).
// Local data is cleared ONLY after the server confirms the import (200).
//
// Audit A11: dismissal and completion are DIFFERENT states. Closing the
// dialog only suppresses the prompt for this browser session (sessionStorage,
// per tab); only a completed import (or an explicit "start fresh") sets the
// permanent key. Guest data created after a dismissal — or on another
// sign-in — prompts again instead of being stranded.

const MIGRATION_PROMPT_KEY = 'eclipsay.migration.prompt.v1';
const MIGRATION_DISMISS_KEY = 'eclipsay.migration.dismissed.v1';

function sessionDismissed(): boolean {
  try {
    return sessionStorage.getItem(MIGRATION_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function MigrationDialog({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let permanent = false;
    try {
      permanent = localStorage.getItem(MIGRATION_PROMPT_KEY) === '1';
    } catch {
      permanent = false;
    }
    if (permanent || sessionDismissed()) return;
    if (guestStoreHasData()) setOpen(true);
  }, [enabled]);

  const close = () => {
    // Temporary dismissal: this tab stops asking, the data stays put, and a
    // new session (or the Settings import action) picks it back up.
    try {
      sessionStorage.setItem(MIGRATION_DISMISS_KEY, '1');
    } catch {
      // sessionStorage unavailable: closing simply re-prompts next mount.
    }
    setOpen(false);
  };

  const importReflections = async () => {
    setBusy(true);
    try {
      const result = await importGuestData();
      if (!result.ok) {
        toast.error('We could not import right now. Your local reflections are untouched — try again.');
        return;
      }
      try {
        localStorage.setItem(MIGRATION_PROMPT_KEY, '1');
      } catch {
        // Storage unavailable: the dialog may re-prompt, but the import
        // itself already succeeded and the local store is cleared.
      }
      setOpen(false);
      toast.success('Your reflections are now on your account.');
    } finally {
      setBusy(false);
    }
  };

  const startFresh = () => {
    // Destructive: this permanently deletes every guest record in this
    // browser. Same guard as the settings clear path (repo convention).
    if (!window.confirm('Delete all local reflections without importing? This cannot be undone.')) return;
    clearGuestData();
    try {
      localStorage.setItem(MIGRATION_PROMPT_KEY, '1');
    } catch {
      // Storage unavailable: ignore.
    }
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
          <Button variant="ghost" onClick={close} disabled={busy}>
            Not right now
          </Button>
          <Button variant="ghost" onClick={startFresh} disabled={busy}>
            Start fresh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
