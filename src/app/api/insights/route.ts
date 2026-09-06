import { z } from 'zod';
import { createClient, getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Save insight (PRD §39): body is the user's own wording; typed 'insight'.

const bodySchema = z.object({
  text: z.string().min(1).max(5000),
  sessionId: z.string().uuid().optional(),
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
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 });

  const supabase = await createClient();
  // Audit A17: insights may only link to a session the caller owns.
  if (parsed.data.sessionId) {
    const { data: session } = await supabase
      .from('reflection_sessions')
      .select('id')
      .eq('id', parsed.data.sessionId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!session) return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: user.id,
      entry_type: 'insight',
      title: null,
      body: parsed.data.text,
      mood: null,
      tags: [],
      ai_notes: [],
      source_session_id: parsed.data.sessionId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (error) return Response.json({ error: 'insert_failed' }, { status: 500 });
  return Response.json({ id: data.id });
}
