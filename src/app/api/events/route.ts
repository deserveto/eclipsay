import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Appends an analytics event (metadata only — never private content, PRD §68).
// Guests are allowed with a null user_id (see events RLS policy).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { name, meta } = (body ?? {}) as { name?: unknown; meta?: unknown };
  if (typeof name !== 'string' || name.length === 0 || name.length > 64) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  if (meta !== undefined && (typeof meta !== 'object' || meta === null || Array.isArray(meta))) {
    return NextResponse.json({ error: 'invalid_meta' }, { status: 400 });
  }

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
