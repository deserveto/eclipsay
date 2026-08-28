import { z } from 'zod';
import { createClient, getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

// In-app follow-ups (PRD §45–§47). No email/push in MVP.

const createSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  journalEntryId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'revisited', 'dismissed']),
});

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return Response.json({ error: 'unconfigured' }, { status: 500 });
  }
  const user = await getAuthUser();
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('follow_ups')
    .insert({
      user_id: user.id,
      session_id: parsed.data.sessionId ?? null,
      journal_entry_id: parsed.data.journalEntryId ?? null,
      due_at: parsed.data.dueAt,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) return Response.json({ error: 'insert_failed' }, { status: 500 });
  return Response.json({ id: data.id });
}

export async function PATCH(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return Response.json({ error: 'unconfigured' }, { status: 500 });
  }
  const user = await getAuthUser();
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase
    .from('follow_ups')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id);
  if (error) return Response.json({ error: 'update_failed' }, { status: 500 });
  return Response.json({ ok: true });
}
