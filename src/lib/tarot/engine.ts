import type { CardOrientation, DrawnCard, Spread, TarotCard } from './types';
import { getSpread } from './spreads';
import { ALL_CARDS } from './cards';

// Tarot Engine — pure, seeded, deterministic (PRD §22, §24–§26).
// Card identity and orientation are ALWAYS computed here, never by the LLM.
// Persisting `seed` reproduces any reading byte-for-byte (PRD §26).

/** Seeded PRNG (mulberry32). Same seed → same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The full 78-card RWS deck. */
export function createDeck(): TarotCard[] {
  return ALL_CARDS;
}

export type DrawArgs = {
  spreadId: string;
  /** Defaults to the spread's position count. */
  count?: number;
  /** Card ids already in play (no duplicates, PRD §25). */
  alreadyDrawn?: string[];
  seed: number;
};

export type DrawResult = {
  seed: number;
  cards: DrawnCard[];
};

/**
 * Partial Fisher–Yates: draws `count` cards from the deck minus `alreadyDrawn`.
 * Orientation is engine-computed per card: rng() < 0.5 → 'reversed'.
 * Positions follow the spread by draw order; drawOrder is 1-based.
 */
export function drawCards({ spreadId, count, alreadyDrawn = [], seed }: DrawArgs): DrawResult {
  const spread: Spread | undefined = getSpread(spreadId);
  if (!spread) throw new Error(`Unknown spread: ${spreadId}`);

  const pool = ALL_CARDS.filter((c) => !alreadyDrawn.includes(c.id));
  const n = count ?? spread.positions.length;
  if (n < 1) throw new Error('count must be at least 1');
  if (n > pool.length) throw new Error(`Cannot draw ${n} cards from ${pool.length} remaining`);

  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  const cards: DrawnCard[] = pool.slice(0, n).map((card, i) => {
    const orientation: CardOrientation = rng() < 0.5 ? 'reversed' : 'upright';
    return {
      cardId: card.id,
      name: card.name,
      arcana: card.arcana,
      suit: card.arcana === 'major' ? null : card.arcana,
      orientation,
      position: spread.positions[i],
      drawOrder: i + 1,
    };
  });

  return { seed, cards };
}

/**
 * Clarification draw (PRD §32): one card from the reading's remaining deck.
 * `clarifies` is the cardId the new card will be visually linked to; the
 * caller persists the returned card by appending it to the reading's cards.
 */
export function drawClarification(args: {
  reading: { cards: DrawnCard[] };
  clarifies: string;
  seed: number;
}): DrawnCard {
  const { reading, clarifies, seed } = args;
  const drawn = reading.cards.map((c) => c.cardId);
  const { cards } = drawCards({ spreadId: 'one_card', count: 1, alreadyDrawn: drawn, seed });
  const card = cards[0];
  return { ...card, position: `Clarifies ${targetName(reading, clarifies)}`, clarifies };
}

function targetName(reading: { cards: DrawnCard[] }, cardId: string): string {
  return reading.cards.find((c) => c.cardId === cardId)?.name ?? cardId;
}
