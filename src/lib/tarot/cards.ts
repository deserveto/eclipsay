import type { TarotCard } from './types';
import { majors } from './data/majors';
import { wands } from './data/wands';
import { cups } from './data/cups';
import { swords } from './data/swords';
import { pentacles } from './data/pentacles';

// The complete 78-card RWS dataset. Static content only — never prompt the
// LLM to generate or extend these (PRD §22).
export const ALL_CARDS: TarotCard[] = [...majors, ...wands, ...cups, ...swords, ...pentacles];

const CARDS_BY_ID: Record<string, TarotCard> = Object.fromEntries(
  ALL_CARDS.map((c) => [c.id, c]),
);

export function getCard(id: string): TarotCard {
  const card = CARDS_BY_ID[id];
  if (!card) throw new Error(`Unknown card id: ${id}`);
  return card;
}

export function hasCard(id: string): boolean {
  return id in CARDS_BY_ID;
}
