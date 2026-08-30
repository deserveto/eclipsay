import { toast } from 'sonner';

// One-time contextual signup nudge after a meaningful guest save (PRD §14,
// plan: Accounts §5). Saving always completes locally first; the first save
// adds a non-blocking "Create account" action to the success toast, later
// saves stay plain. The gate lives in localStorage and may be unavailable.

const NUDGE_KEY = 'eclipsay.account-nudge.shown.v1';

export function guestSaveToast(message: string, go: (path: string) => void): void {
  let firstSave = false;
  try {
    firstSave = !window.localStorage.getItem(NUDGE_KEY);
    if (firstSave) window.localStorage.setItem(NUDGE_KEY, '1');
  } catch {
    // Storage unavailable: show the plain success toast without the action.
  }
  toast.success(
    message,
    firstSave
      ? {
          action: {
            label: 'Create account',
            onClick: () => go(`/signup?next=${encodeURIComponent(window.location.pathname)}`),
          },
        }
      : undefined,
  );
}
