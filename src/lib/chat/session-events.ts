// Cross-component signal that the account-mode session list changed
// (generated title, rename, delete). Guests don't need it — their store
// mutators already dispatch `eclipsay:guest-store-changed`.

export const SESSIONS_CHANGED_EVENT = 'eclipsay:sessions-changed';

export function notifySessionsChanged(): void {
  window.dispatchEvent(new CustomEvent(SESSIONS_CHANGED_EVENT));
}
