import { z } from 'zod';
import { TITLE_MAX } from '@/lib/chat/title';
import { createClient, getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Account-mode session management (guests mutate the local store directly).
// RLS already scopes every statement to the owner; the explicit user_id
// filters mirror the other routes as belt-and-braces.

const sessionIdSchema = z.string().uuid();

const patchSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX),
});

function uuidError(sessionId: string): Response | null {
  return sessionIdSchema.safeParse(sessionId).success
    ? null
    : Response.json({ error: 'invalid_body' }, { status: 400 });
}

async function requireUser() {
  if (!isSupabaseServerConfigured()) return null;
  return getAuthUser();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser();
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const { sessionId } = await params;
  const invalid = uuidError(sessionId);
  if (invalid) return invalid;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reflection_sessions')
    .update({ title: parsed.data.title })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();
  if (error) return Response.json({ error: 'update_failed' }, { status: 500 });
  if (!data) return Response.json({ error: 'session_not_found' }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser();
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const { sessionId } = await params;
  const invalid = uuidError(sessionId);
  if (invalid) return invalid;

  const supabase = await createClient();
  // Messages, readings, and follow-ups cascade; journal sources are set null
  // by the schema (supabase/migrations/0001_init.sql).
  const { data, error } = await supabase
    .from('reflection_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();
  if (error) return Response.json({ error: 'delete_failed' }, { status: 500 });
  if (!data) return Response.json({ error: 'session_not_found' }, { status: 404 });
  return Response.json({ ok: true });
}
