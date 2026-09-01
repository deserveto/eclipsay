import { z } from 'zod';
import { drawReading, DrawError } from '@/lib/tarot/draw-service';
import { getAccountSessionSafety } from '@/lib/ai/session-safety';
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
  const sessionId = parsed.data.sessionId;
  if (user) {
    if (!sessionId) return Response.json({ error: 'session_required' }, { status: 400 });
    try {
      if ((await getAccountSessionSafety(sessionId, user.id)).highStakes) {
        return Response.json({ error: 'tarot_unavailable' }, { status: 403 });
      }
    } catch {
      return Response.json({ error: 'safety_check_failed' }, { status: 500 });
    }
  }
  try {
    const outcome = await drawReading({ user, sessionId, spreadId: parsed.data.spreadId });
    return Response.json(outcome);
  } catch (error) {
    if (error instanceof DrawError) return Response.json({ error: 'draw_failed' }, { status: 500 });
    throw error;
  }
}
