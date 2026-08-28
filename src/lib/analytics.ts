// Analytics — event names + metadata only, never message/journal text (PRD §68).
export type AnalyticsEvent =
  | 'reflection_started'
  | 'reflection_completed'
  | 'tarot_suggested'
  | 'tarot_started'
  | 'tarot_completed'
  | 'insight_saved'
  | 'journal_entry_created'
  | 'journal_entry_revisited'
  | 'memory_created'
  | 'followup_created'
  | 'followup_revisited'
  | 'signup_started'
  | 'signup_completed'
  | 'guest_data_imported';

/** Fire-and-forget client event; failures are silently ignored. */
export function track(name: AnalyticsEvent, meta: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, meta }),
    keepalive: true,
  }).catch(() => {});
}
