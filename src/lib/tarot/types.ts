// Rider–Waite–Smith canonical structures (PRD §23–§26).
// Static dataset types — all card content lives in src/lib/tarot/data and is
// served verbatim; the LLM never generates card identities (PRD §22).

export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';
export type Arcana = 'major' | Suit;

export type CardOrientation = 'upright' | 'reversed';

export type TarotCard = {
  id: string;
  name: string;
  arcana: Arcana;
  /** Majors: 0–21 (Fool=0). Minors: 1–14 (Ace=1 … King=14). */
  number: number;
  keywordsUpright: string[];
  keywordsReversed: string[];
  /** Traditional RWS meaning. */
  traditional: string;
  /** Reflective interpretation — possibility language, never certainty (PRD §4.1). */
  reflection: string;
  themes: {
    relationships: string;
    career: string;
    growth: string;
  };
};

export type DrawnCard = {
  cardId: string;
  name: string;
  arcana: Arcana;
  suit: Suit | null;
  orientation: CardOrientation;
  /** Spread position label, by draw order. */
  position: string;
  /** 1-based order within the draw. */
  drawOrder: number;
  /** For clarification cards: the cardId this card clarifies (PRD §32). */
  clarifies?: string;
};

export type SpreadId =
  | 'one_card'
  | 'three_reflection'
  | 'past_present_future'
  | 'situation_challenge_guidance'
  | 'relationship_reflection'
  | 'decision_reflection';

export type Spread = {
  id: SpreadId;
  title: string;
  description: string;
  positions: string[];
};
