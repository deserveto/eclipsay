import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Guest migration (plan: Guest store — Migration; PRD §13, §64).
// The service-role call runs migrate_guest_data() — a single SQL transaction.
// The client clears local data only after a 200 from this route.

const followUpSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid().nullable().optional(),
  journal_entry_id: z.string().uuid().nullable().optional(),
  due_at: z.string(),
  status: z.string(),
  created_at: z.string(),
});

const guestStoreSchema = z.object({
  sessions: z.array(z.object({ id: z.string().uuid(), title: z.string().optional(), created_at: z.string(), updated_at: z.string() })).default([]),
  readings: z.array(z.object({ id: z.string().uuid(), session_id: z.string().uuid(), spread_id: z.string(), seed: z.number(), cards: z.array(z.unknown()), created_at: z.string() })).default([]),
  messages: z.array(z.object({ id: z.string().uuid(), session_id: z.string().uuid(), role: z.enum(['user', 'assistant']), content: z.string(), meta: z.record(z.string(), z.unknown()).default({}), created_at: z.string() })).default([]),
  journal: z.array(z.object({ id: z.string().uuid(), entry_type: z.string(), title: z.string().nullable().optional(), body: z.string(), mood: z.string().nullable().optional(), tags: z.array(z.string()).default([]), ai_notes: z.array(z.unknown()).default([]), source_session_id: z.string().uuid().nullable().optional(), source_reading_id: z.string().uuid().nullable().optional(), parent_entry_id: z.string().uuid().nullable().optional(), created_at: z.string(), updated_at: z.string() })).default([]),
  memories: z.array(z.object({ id: z.string().uuid(), category: z.string(), content: z.string(), source: z.string(), active: z.boolean().default(true), created_at: z.string(), updated_at: z.string() })).default([]),
  // Audit A04: reminders and profile preferences cross the migration boundary.
  followUps: z.array(followUpSchema).default([]),
  profile: z
    .object({
      reflection_goal: z.string().nullable().optional(),
      tarot_familiarity: z.string().nullable().optional(),
      memory_enabled: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return Response.json({ error: 'unconfigured' }, { status: 500 });
  }
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = guestStoreSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const { sessions, readings, messages, journal, memories, followUps, profile } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('migrate_guest_data', {
    p_user_id: user.id,
    p_sessions: sessions,
    p_readings: readings,
    p_messages: messages,
    p_journal: journal,
    p_memories: memories,
    p_followups: followUps,
    p_profile: profile ?? null,
  });
  if (error) {
    console.error('[migrate] failed', error);
    return Response.json({ error: 'migration_failed' }, { status: 500 });
  }
  return Response.json({ imported: typeof data === 'number' ? data : 0 });
}
