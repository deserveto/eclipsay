import { tool } from 'ai';
import { z } from 'zod';
import type { User } from '@supabase/supabase-js';
import { SPREADS, getSpread } from '@/lib/tarot/spreads';
import { drawReading, clarifyReading } from '@/lib/tarot/draw-service';

// Tarot tools (plan: AI layer — Tools; PRD §62). The model may call these to
// suggest spreads, draw, or clarify; effects on long-term data go through
// propose-then-confirm UI cards (later phases). The engine is the only source
// of card identities and orientations.

function pickSpreads(context: string) {
  const text = context.toLowerCase();
  const decisionish = /(decision|decide|choose|choice|option|quit|stay|leave|whether)/.test(text);
  const relationshipish = /(relationship|partner|partner|ex|dating|marriage|friend|family|love|them)/.test(text);
  if (decisionish) return ['decision_reflection', 'three_reflection'];
  if (relationshipish) return ['relationship_reflection', 'three_reflection'];
  return ['three_reflection', 'one_card'];
}

export function createTarotTools({ user, sessionId }: { user: User | null; sessionId?: string }) {
  return {
    suggest_spread: tool({
      description:
        'Suggest one or two tarot spreads that fit what the user is exploring. Suggest at most once per conversation, and never again after the user declines.',
      inputSchema: z.object({
        context: z.string().max(500).describe('Short summary of what the user is exploring'),
      }),
      execute: async ({ context }) => {
        const options = pickSpreads(context)
          .map((id) => getSpread(id))
          .filter((s): s is NonNullable<typeof s> => Boolean(s))
          .map((s) => ({ spreadId: s.id, title: s.title, positions: s.positions }));
        return { options };
      },
    }),

    draw_tarot_cards: tool({
      description:
        'Draw cards for a spread using the Tarot Engine. Interpret ONLY the returned cards, then ask exactly one reflection question.',
      inputSchema: z.object({
        spreadId: z.string().describe('Spread id, e.g. three_reflection or decision_reflection'),
      }),
      execute: async ({ spreadId }) => {
        try {
          return await drawReading({ user, sessionId, spreadId });
        } catch {
          return { error: 'draw_failed' as const };
        }
      },
    }),

    request_clarification: tool({
      description:
        'Draw one clarification card from the remaining deck of an existing reading, to clarify a specific card.',
      inputSchema: z.object({
        readingId: z.string().describe('The reading that contains the card to clarify'),
        cardId: z.string().describe('The card id being clarified, e.g. the_moon'),
      }),
      execute: async ({ readingId, cardId }) => {
        try {
          const clarifier = await clarifyReading({ user, readingId, cardId, alreadyDrawn: [] });
          return { readingId, cardId, clarifier };
        } catch {
          return { error: 'draw_failed' as const };
        }
      },
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
        const { createClient } = await import('@/lib/supabase/server');
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
  };
}

export type TarotTools = ReturnType<typeof createTarotTools>;

export const ALL_SPREAD_IDS = SPREADS.map((s) => s.id);
