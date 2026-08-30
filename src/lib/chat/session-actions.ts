// Client-side session mutations across both data modes (PRD §13, §34):
// guests write the local store, accounts go through the REST routes. Every
// success path refreshes the sidebar via the store or sessions-changed
// event; every failure path returns quietly so callers decide on toasts.

import type { DataMode } from '@/hooks/use-data-mode';
import { deleteGuestSession, getGuestSession, renameGuestSession } from '@/lib/guest/store';
import { notifySessionsChanged } from './session-events';

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
// Generates a conversation title. Application rules:
// - account: the route's guarded update only replaces the untouched
//   placeholder unless `overwrite`; the sidebar refreshes via the event.
// - guest: a compare-and-swap against `expectedTitle` (the store title at
//   send time) protects user renames; `overwrite` applies unconditionally.
export async function generateSessionTitle(input: {
  sessionId: string;
  mode: DataMode;
  userText?: string;
  assistantText?: string;
  expectedTitle?: string;
  overwrite?: boolean;
}): Promise<string | null> {
  const { sessionId, mode, userText, assistantText, expectedTitle, overwrite } = input;
  try {
    const res = await fetch(`/api/sessions/${sessionId}/title`, jsonInit('POST', { userText, assistantText, overwrite }));
    if (!res.ok) return null;
    const { title, applied } = (await res.json()) as { title: string; applied?: boolean };
    if (mode === 'guest') {
      const session = getGuestSession(sessionId);
      if (!session) return null;
      const untouched = expectedTitle !== undefined && session.title === expectedTitle;
      if (!overwrite && !untouched) return null;
      renameGuestSession(sessionId, title);
      return title;
    }
    if (applied !== false) notifySessionsChanged();
    return title;
  } catch {
    return null;
  }
}

export async function renameSession(sessionId: string, mode: DataMode, title: string): Promise<boolean> {
  try {
    if (mode === 'account') {
      const res = await fetch(`/api/sessions/${sessionId}`, jsonInit('PATCH', { title }));
      if (!res.ok) return false;
      notifySessionsChanged();
    } else {
      renameGuestSession(sessionId, title);
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteSession(sessionId: string, mode: DataMode): Promise<boolean> {
  try {
    if (mode === 'account') {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) return false;
      notifySessionsChanged();
    } else {
      deleteGuestSession(sessionId);
    }
    return true;
  } catch {
    return false;
  }
}
