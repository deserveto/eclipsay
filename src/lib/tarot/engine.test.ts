import { describe, expect, it } from 'vitest';
import { createDeck, drawCards, drawClarification, mulberry32 } from './engine';

const deck = createDeck();

describe('deck', () => {
  it('has 78 cards with unique ids', () => {
    expect(deck).toHaveLength(78);
    expect(new Set(deck.map((c) => c.id)).size).toBe(78);
  });
});

describe('drawCards', () => {
  it('same seed produces identical cards', () => {
    const a = drawCards({ spreadId: 'decision_reflection', seed: 1234 });
    const b = drawCards({ spreadId: 'decision_reflection', seed: 1234 });
    expect(b).toEqual(a);
  });

  it('different seeds usually differ', () => {
    const a = drawCards({ spreadId: 'decision_reflection', seed: 1 });
    const b = drawCards({ spreadId: 'decision_reflection', seed: 2 });
    expect(a.cards.map((c) => c.cardId)).not.toEqual(b.cards.map((c) => c.cardId));
  });

  it('draws the spread length by default with 1-based draw order and positions', () => {
    const { cards } = drawCards({ spreadId: 'three_reflection', seed: 7 });
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.drawOrder)).toEqual([1, 2, 3]);
    expect(cards.map((c) => c.position)).toEqual(['Situation', 'What deserves attention', 'Possible direction']);
  });

  it('orientations are always upright or reversed', () => {
    for (const seed of [0, 1, 42, 999999]) {
      const { cards } = drawCards({ spreadId: 'past_present_future', seed });
      for (const c of cards) expect(['upright', 'reversed']).toContain(c.orientation);
    }
  });

  it('never duplicates cards, even across explicit count', () => {
    const { cards } = drawCards({ spreadId: 'one_card', count: 20, seed: 5 });
    expect(new Set(cards.map((c) => c.cardId)).size).toBe(20);
  });

  it('respects alreadyDrawn exclusions', () => {
    const drawn = ['the_fool', 'the_magician'];
    const { cards } = drawCards({ spreadId: 'one_card', count: 10, alreadyDrawn: drawn, seed: 11 });
    const ids = cards.map((c) => c.cardId);
    expect(ids).not.toContain('the_fool');
    expect(ids).not.toContain('the_magician');
  });

  it('rejects unknown spreads and over-draws', () => {
    expect(() => drawCards({ spreadId: 'nope', seed: 1 })).toThrow();
    expect(() => drawCards({ spreadId: 'one_card', count: 79, seed: 1 })).toThrow();
  });
});

describe('drawClarification', () => {
  it('five consecutive clarifications never duplicate', () => {
    const reading = drawCards({ spreadId: 'three_reflection', seed: 99 });
    const cards = [...reading.cards];
    const drawn = cards.map((c) => c.cardId);
    for (let i = 0; i < 5; i++) {
      const card = drawClarification({ reading: { cards }, clarifies: cards[0].cardId, seed: 1000 + i });
      expect(drawn).not.toContain(card.cardId);
      drawn.push(card.cardId);
      cards.push(card);
    }
  });

  it('links the pair and excludes every drawn id', () => {
    const reading = drawCards({ spreadId: 'relationship_reflection', seed: 3 });
    const drawnIds = reading.cards.map((c) => c.cardId);
    const clarifier = drawClarification({
      reading: { cards: reading.cards },
      clarifies: reading.cards[1].cardId,
      seed: 77,
    });
    expect(clarifier.clarifies).toBe(reading.cards[1].cardId);
    expect(drawnIds).not.toContain(clarifier.cardId);
    expect(clarifier.position).toContain(reading.cards[1].name);
  });
});

describe('mulberry32', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
