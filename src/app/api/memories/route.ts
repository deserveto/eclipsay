import { z } from 'zod';
import { createClient, getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Explicit memory creation (PRD §41): only ever created on user approval.

const bodySchema = z.object({
  content: z.string().min(1).max(1000),
  category: z.enum([
    'preference',
    'goal',
    'recurring_situation',
    'context',
    'project',
    'relationship',
    'reflection_preference',
  ]),
  source: z.string().min(1).max(120).default('Reflection'),
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
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('memory_enabled')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) return Response.json({ error: 'memory_setting_unavailable' }, { status: 500 });
  if (profile?.memory_enabled === false) return Response.json({ error: 'memory_disabled' }, { status: 400 });
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('memories')
    .insert({
      user_id: user.id,
      category: parsed.data.category,
      content: parsed.data.content,
      source: parsed.data.source,
      active: true,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (error) return Response.json({ error: 'insert_failed' }, { status: 500 });
  return Response.json({ id: data.id });
}
