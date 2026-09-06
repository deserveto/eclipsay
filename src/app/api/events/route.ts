import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rate-limit';
import type { AnalyticsEvent } from '@/lib/analytics';

// Appends an analytics event (metadata only — never private content, PRD §68).
// Guests are allowed with a null user_id (see events RLS policy).
// Audit A18: only the AnalyticsEvent union is accepted, metadata is bounded
// and flat-primitive, and per-IP write bursts are throttled.

const EVENT_NAMES: readonly AnalyticsEvent[] = [
  'reflection_started',
  'reflection_completed',
  'tarot_suggested',
  'tarot_started',
  'tarot_completed',
  'insight_saved',
  'journal_entry_created',
  'journal_entry_revisited',
  'memory_created',
  'followup_created',
  'followup_revisited',
  'signup_started',
  'signup_completed',
  'guest_data_imported',
];

const metaValueSchema = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);
const eventSchema = z.object({
  name: z.enum(EVENT_NAMES as [AnalyticsEvent, ...AnalyticsEvent[]]),
  // Flat, bounded metadata only: no nested objects/arrays, so free-form text
  meta: z.record(z.string().max(64), metaValueSchema).refine((m) => Object.keys(m).length <= 12, 'too_many_keys').optional(),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, 'events'), 60, 60_000);
  if (!limit.ok) return tooManyRequests(limit);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const { name, meta } = parsed.data;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('events')
      .insert({ name, meta: (meta ?? {}) as Record<string, unknown>, user_id: user?.id ?? null });
    if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    // Unconfigured Supabase (dev without creds): accept and drop.
    return NextResponse.json({ ok: true, dropped: true });
  }
}
