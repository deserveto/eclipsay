/**
 * Asserts the tarot dataset is complete and well-formed (plan: Static tarot data).
 * Usage: npx tsx scripts/validate-cards.ts
 */
import { ALL_CARDS } from '../src/lib/tarot/cards';

const MAJORS = 22;
const SUITS = ['wands', 'cups', 'swords', 'pentacles'] as const;
const PER_SUIT = 14;

const problems: string[] = [];

if (ALL_CARDS.length !== 78) problems.push(`expected 78 cards, got ${ALL_CARDS.length}`);
if (new Set(ALL_CARDS.map((c) => c.id)).size !== ALL_CARDS.length) problems.push('duplicate card ids');

const majors = ALL_CARDS.filter((c) => c.arcana === 'major');
if (majors.length !== MAJORS) problems.push(`expected ${MAJORS} majors, got ${majors.length}`);

for (const suit of SUITS) {
  const cards = ALL_CARDS.filter((c) => c.arcana === suit);
  if (cards.length !== PER_SUIT) problems.push(`expected ${PER_SUIT} ${suit}, got ${cards.length}`);
}

const nonEmpty = (v: unknown): boolean =>
  Array.isArray(v) ? v.length > 0 && v.every((x) => typeof x === 'string' && x.trim().length > 0) : typeof v === 'string' && v.trim().length > 0;

for (const c of ALL_CARDS) {
  const label = c.id;
  if (!nonEmpty(c.id)) problems.push(`${label}: empty id`);
  if (!nonEmpty(c.name)) problems.push(`${label}: empty name`);
  if (!nonEmpty(c.traditional)) problems.push(`${label}: empty traditional`);
  if (!nonEmpty(c.reflection)) problems.push(`${label}: empty reflection`);
  if (!nonEmpty(c.keywordsUpright)) problems.push(`${label}: empty keywordsUpright`);
  if (!nonEmpty(c.keywordsReversed)) problems.push(`${label}: empty keywordsReversed`);
  if (!c.themes || !nonEmpty(c.themes.relationships) || !nonEmpty(c.themes.career) || !nonEmpty(c.themes.growth)) {
    problems.push(`${label}: empty themes`);
  }
  if (c.arcana === 'major' && (c.number < 0 || c.number > 21)) problems.push(`${label}: major number ${c.number}`);
  if (c.arcana !== 'major' && (c.number < 1 || c.number > 14)) problems.push(`${label}: minor number ${c.number}`);
}

if (problems.length > 0) {
  console.error(`validate-cards: ${problems.length} problem(s)`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log(`validate-cards: OK — 78 unique cards (22 major + 14 × 4 suits), all fields non-empty`);
