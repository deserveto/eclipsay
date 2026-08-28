import { randomInt, randomUUID } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { drawCards, drawClarification } from '@/lib/tarot/engine';
import { getSpread } from '@/lib/tarot/spreads';
import { hasCard } from '@/lib/tarot/cards';
import { createClient } from '@/lib/supabase/server';
import type { DrawnCard } from '@/lib/tarot/types';

// Server-only Tarot draw service (plan: AI layer — Tools; PRD §22, §25, §26).
// Every draw is seeded here; the LLM never selects or invents cards.

export class DrawError extends Error {
  constructor() {
    super('draw_failed');
  }
}

export type DrawOutcome = {
  readingId: string;
  spreadId: string;
  seed: number;
  cards: DrawnCard[];
};

function generateSeed(): number {
  return randomInt(0, 2 ** 30);
}

export async function drawReading(args: {
  user: User | null;
  sessionId?: string;
  spreadId: string;
}): Promise<DrawOutcome> {
  const { user, sessionId, spreadId } = args;
  if (!getSpread(spreadId)) throw new DrawError();
  const seed = generateSeed();
  const { cards } = drawCards({ spreadId, seed });
  const readingId = randomUUID();

  if (user && sessionId) {
    const supabase = await createClient();
    const { error } = await supabase.from('tarot_readings').insert({
      id: readingId,
      session_id: sessionId,
      user_id: user.id,
      spread_id: spreadId,
      seed,
      cards,
    });
    if (error) throw new DrawError();
  }
  return { readingId, spreadId, seed, cards };
}

export async function clarifyReading(args: {
  user: User | null;
  readingId?: string;
  cardId: string;
  alreadyDrawn: string[];
}): Promise<DrawnCard> {
  const { user, readingId, cardId } = args;
  if (!hasCard(cardId)) throw new DrawError();

  let drawnIds = args.alreadyDrawn.filter((id) => hasCard(id));
  let existingRow: { cards: DrawnCard[] } | null = null;

  if (user && readingId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('tarot_readings')
      .select('cards')
      .eq('id', readingId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      const row = data as { cards: DrawnCard[] };
      existingRow = row;
      drawnIds = row.cards.map((c: DrawnCard) => c.cardId);
    }
  }

  const seed = generateSeed();
  const clarifier = drawClarification({
    reading: { cards: drawnIds.map((id) => ({ cardId: id, name: id } as DrawnCard)) },
    clarifies: cardId,
    seed,
  });

  if (existingRow && readingId && user) {
    const supabase = await createClient();
    const { error } = await supabase
      .from('tarot_readings')
      .update({ cards: [...existingRow.cards, clarifier] })
      .eq('id', readingId)
      .eq('user_id', user.id);
    if (error) throw new DrawError();
  }
  return clarifier;
}
