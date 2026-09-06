// Persisted record of which assistant messages were already captured to the
// journal (audit A23). Component state alone forgets on reload, so the same
// message stayed actionable and could create duplicate entries. Keys are
// scoped per session + message; localStorage failures degrade to "never
// captured" (the write path itself remains the source of truth).
const CAPTURES_KEY = 'eclipsay.saved-captures.v1';

export function captureKey(sessionId: string, messageId: string): string {
  return `${sessionId}:${messageId}`;
}

export function isMessageCaptured(sessionId: string, messageId: string): boolean {
  try {
    const raw = window.localStorage.getItem(CAPTURES_KEY);
    if (!raw) return false;
    const keys: unknown = JSON.parse(raw);
    return Array.isArray(keys) && keys.includes(captureKey(sessionId, messageId));
  } catch {
    return false;
  }
}

export function markMessageCaptured(sessionId: string, messageId: string): void {
  try {
    const raw = window.localStorage.getItem(CAPTURES_KEY);
    const keys = raw ? (JSON.parse(raw) as unknown) : [];
    const next = Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : [];
    const key = captureKey(sessionId, messageId);
    if (!next.includes(key)) next.push(key);
    // Bound growth: keep the most recent 500 captures.
    window.localStorage.setItem(CAPTURES_KEY, JSON.stringify(next.slice(-500)));
  } catch {
    // Storage unavailable: the capture still happened; only dedupe is lost.
  }
}
