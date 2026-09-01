import { z } from 'zod';
import { clarifyReading, DrawError } from '@/lib/tarot/draw-service';
import { getAccountSessionSafety } from '@/lib/ai/session-safety';
import { getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
// Clarification draw (PRD §32). Authed: appends the card to the stored
// reading row. Guest: the client persists the returned card locally.

const bodySchema = z.object({
  sessionId: z.string().uuid().optional(),
  readingId: z.string().uuid().optional(),
  cardId: z.string().min(1),
  alreadyDrawn: z.array(z.string()).max(78).optional(),
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
    const clarifier = await clarifyReading({
      user,
      readingId: parsed.data.readingId,
      cardId: parsed.data.cardId,
      alreadyDrawn: parsed.data.alreadyDrawn ?? [],
    });
    return Response.json({ clarifier });
  } catch (error) {
    if (error instanceof DrawError) return Response.json({ error: 'draw_failed' }, { status: 500 });
    throw error;
  }
}
