import { tool } from 'ai';
import { z } from 'zod';
import type { User } from '@supabase/supabase-js';
import { SPREADS, getSpread } from '@/lib/tarot/spreads';
import { createClient } from '@/lib/supabase/server';

// Tarot tools (plan: AI layer — Tools; PRD §62). The model may ask structured
// clarifying questions, recommend a reading, and clarify a drawn card; it
// NEVER draws — all draws go through the draw service via POST /api/tarot/draw,
// so every persisted reading carries the engine's real seed (PRD §25–§26).
// Effects on long-term data go through propose-then-confirm UI cards.

export const ALL_SPREAD_IDS = SPREADS.map((s) => s.id);

// Deterministic alternate priority (plan: tools). Keyword heuristics only
// reorder this list; the MODEL picks spreadId, pickReading supplies display
// data + card-count-diverse alternates.
const ALT_PRIORITY = ['one_card', 'decision_reflection', 'three_reflection', 'past_present_future'];

export type ReadingAlternative = { spreadId: string; title: string; cardCount: number };

export type ReadingRecommendation = {
  recommendedSpreadId: string;
  title: string;
  positions: string[];
  cardCount: number;
  alternatives: ReadingAlternative[];
};

export function pickReading(context: string, chosenId: string): ReadingRecommendation {
  const chosen = getSpread(chosenId) ?? getSpread('three_reflection')!;
  const text = context.toLowerCase();
  const decisionish = /(decision|decide|choose|choice|option|quit|stay|leave|whether)/.test(text);
  const relationshipish = /(relationship|partner|ex|dating|marriage|friend|family|love|them)/.test(text);
  const priority = [...ALT_PRIORITY];
  if (relationshipish) priority.unshift('relationship_reflection');
  if (decisionish) priority.unshift(...priority.splice(priority.indexOf('decision_reflection'), 1));

  const seenCounts = new Set([chosen.positions.length]);
  const alternatives: ReadingAlternative[] = [];
  for (const id of [...priority, ...SPREADS.map((s) => s.id)]) {
    if (alternatives.length >= 2) break;
    if (id === chosen.id) continue;
    const spread = getSpread(id);
    if (!spread || seenCounts.has(spread.positions.length)) continue;
    seenCounts.add(spread.positions.length);
    alternatives.push({ spreadId: spread.id, title: spread.title, cardCount: spread.positions.length });
  }
  return {
    recommendedSpreadId: chosen.id,
    title: chosen.title,
    positions: chosen.positions,
    cardCount: chosen.positions.length,
    alternatives,
  };
}

export function createTarotTools({ user }: { user: User | null }) {
  return {
    ask_user: tool({
      description:
        'Ask the user up to three grouped clarifying multiple-choice questions before a reading — one batch per reading request. Use only when their message is too vague to choose a spread; each question needs 2-5 answer options that would each change the reading. Set allowMultiple only when several options can truthfully apply.',
      inputSchema: z.object({
        questions: z
          .object({
            question: z.string().min(5).max(200),
            options: z.array(z.string().min(1).max(200)).min(2).max(5),
            allowMultiple: z.boolean(),
          })
          .array()
          .min(1)
          .max(3),
        freeformLabel: z
          .string()
          .min(3)
          .max(80)
          .optional()
          .describe("Label for the free-text 'write your own answer' field, phrased in the user's language (e.g. 'Type your own…')"),
      }),
      // Pure payload, PRD §62: the UI renders it; nothing is written here.
      execute: async ({ questions, freeformLabel }) => ({ questions, freeformLabel }),
    }),

    recommend_reading: tool({
      description:
        'Recommend a tarot reading once the question is clear. The app draws the cards; interpret them only after the [Cards drawn] message arrives.',
      inputSchema: z.object({
        context: z.string().min(1).max(300).describe("What this reading should illuminate, in the user's terms"),
        spreadId: z.enum(ALL_SPREAD_IDS as [string, ...string[]]),
      }),
      execute: async ({ context, spreadId }) => {
        // Unreachable through the enum, kept as the draw_failed guard contract.
        if (!getSpread(spreadId)) return { error: 'draw_failed' as const };
        return { context, ...pickReading(context, spreadId) };
      },
    }),

    request_clarification: tool({
      description:
        'Suggest drawing one clarification card for a specific card of an existing reading (use after interpreting a reading, when one card would benefit from a clarifying card). The APP asks the user to confirm; nothing is drawn until they accept.',
      inputSchema: z.object({
        readingId: z.string().describe('The reading that contains the card to clarify'),
        cardId: z.string().describe('The card id being clarified, e.g. the_moon'),
      }),
      // Propose-then-confirm (PRD §62, audit A34): the model never triggers a
      // draw. The UI renders a confirm card; on accept the app draws through
      // /api/tarot/clarify with the reading's real exclusion set, so a
      // clarification can never duplicate a card already in the deck.
      execute: async ({ readingId, cardId }) => ({ readingId, cardId, requested: true as const }),
    }),

    propose_insight: tool({
      description:
        'Propose saving a short insight in the user\u2019s own words. Only use this when the user states a meaningful realization; preserve their wording exactly.',
      inputSchema: z.object({
        text: z.string().min(1).max(2000).describe('The insight, in the user\u2019s own words'),
      }),
      execute: async ({ text }) => {
        const insightId = globalThis.crypto.randomUUID();
        return { insightId, text };
      },
    }),

    propose_memory: tool({
      description:
        'Propose remembering a fact for future sessions (preference, goal, recurring situation, context, project, relationship, reflection preference). Only when the user explicitly shares something they want remembered.',
      inputSchema: z.object({
        content: z.string().min(1).max(500),
        category: z.enum([
          'preference',
          'goal',
          'recurring_situation',
          'context',
          'project',
          'relationship',
          'reflection_preference',
        ]),
      }),
      execute: async ({ content, category }) => {
        const memoryId = globalThis.crypto.randomUUID();
        return { memoryId, content, category };
      },
    }),

    search_journal: tool({
      description:
        'Search the user\u2019s journal for past entries related to a query. Returns titles only, never bodies. The user must approve before an entry enters the conversation.',
      inputSchema: z.object({
        query: z.string().min(1).max(200),
      }),
      execute: async ({ query }) => {
        if (!user) {
          return { results: [] };
        }
        const supabase = await createClient();
        const { data } = await supabase
          .from('journal_entries')
          .select('id, title, created_at')
          .or(`title.ilike.%${query}%,body.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(5);
        return {
          results: (data ?? []).map((row) => ({
            entryId: row.id,
            title: row.title ?? 'Untitled entry',
            createdAt: row.created_at,
          })),
        };
      },
    }),

    create_followup: tool({
      description:
        'Schedule an in-app check-in on this reflection. Compute the due date from the choice; today counts from now.',
      inputSchema: z.object({
        when: z.enum(['tomorrow', '3days', '1week', 'custom']),
        customDate: z.string().optional().describe('ISO date for custom; required when when=custom'),
      }),
      execute: async ({ when, customDate }) => {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        let dueAt: string;
        if (when === 'custom' && customDate) {
          const parsed = new Date(customDate);
          if (Number.isNaN(parsed.getTime())) return { error: 'invalid_date' as const };
          dueAt = parsed.toISOString();
        } else if (when === 'tomorrow') dueAt = new Date(now + day).toISOString();
        else if (when === '3days') dueAt = new Date(now + 3 * day).toISOString();
        else dueAt = new Date(now + 7 * day).toISOString();
        return { followupId: globalThis.crypto.randomUUID(), when, dueAt };
      },
    }),
  };
}
