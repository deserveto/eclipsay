import { z } from 'zod';
import { drawReading, DrawError } from '@/lib/tarot/draw-service';
import { getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Server-side draw (plan: Card draws happen server-side only, seeded).
// Guests: nothing persisted server-side; authed: reading row inserted.

const bodySchema = z.object({
  spreadId: z.string().min(1),
  sessionId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 });

  const user = isSupabaseServerConfigured() ? await getAuthUser() : null;
  try {
    const outcome = await drawReading({ user, sessionId: parsed.data.sessionId, spreadId: parsed.data.spreadId });
    return Response.json(outcome);
  } catch (error) {
    if (error instanceof DrawError) return Response.json({ error: 'draw_failed' }, { status: 500 });
    throw error;
  }
}
