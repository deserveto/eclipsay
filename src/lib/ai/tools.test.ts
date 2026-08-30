import { describe, expect, it } from 'vitest';
import { createTarotTools, pickReading } from './tools';
import { getSpread } from '@/lib/tarot/spreads';

// Behavioral tests for the conversational reading tools (plan: AI layer).
// The model picks the spread; pickReading supplies display data + alternates,
// so alternates must always exist, differ from the pick, and differ in size.

const tools = createTarotTools({ user: null });
const exec = (tool: { execute?: (input: never, options: never) => unknown }, input: unknown) =>
  (tool.execute as (input: unknown, options: unknown) => Promise<unknown>)(input, {
    toolCallId: 'test',
    messages: [],
  });

describe('pickReading', () => {
  const cases: [string, string][] = [
    ['one_card', 'A single concern I want a perspective on'],
    ['three_reflection', 'Work has been heavy lately and I want to look at it'],
    ['decision_reflection', 'I am weighing options and cannot settle'],
    ['decision_reflection', 'Should I quit my job or stay?'],
    ['one_card', 'My relationship with my partner feels distant'],
  ];

  it.each(cases)('returns exactly 2 size-diverse alternates for %s (%s)', (chosenId, context) => {
    const pick = pickReading(context, chosenId);
    expect(pick.recommendedSpreadId).toBe(chosenId);
    expect(pick.alternatives).toHaveLength(2);
    const counts = [pick.cardCount, ...pick.alternatives.map((a) => a.cardCount)];
    expect(new Set(counts).size).toBe(3);
    expect(pick.alternatives.map((a) => a.spreadId)).not.toContain(chosenId);
  });

  it('supplies display data matching the chosen spread', () => {
    const pick = pickReading('anything on my mind', 'decision_reflection');
    const spread = getSpread('decision_reflection')!;
    expect(pick.title).toBe(spread.title);
    expect(pick.positions).toEqual(spread.positions);
    expect(pick.cardCount).toBe(spread.positions.length);
  });
});

describe('recommend_reading', () => {
  it('passes context through and echoes the chosen spread', async () => {
    const output = (await exec(tools.recommend_reading, {
      context: 'A decision about moving cities',
      spreadId: 'one_card',
    })) as { context: string; title: string; positions: string[]; alternatives: unknown[] };
    expect(output.context).toBe('A decision about moving cities');
    expect(output.title).toBe(getSpread('one_card')!.title);
    expect(output.positions).toEqual(getSpread('one_card')!.positions);
    expect(output.alternatives).toHaveLength(2);
  });

  it('reports draw_failed for an unknown spread', async () => {
    const output = (await exec(tools.recommend_reading, {
      context: 'anything',
      spreadId: 'not_a_spread',
    })) as { error: string };
    expect(output.error).toBe('draw_failed');
  });
});

describe('ask_user', () => {
  it('returns the batch unchanged', async () => {
    const input = {
      questions: [
        { question: 'What part of the decision feels heaviest?', options: ['Timing', 'Money', 'People'], allowMultiple: false },
        { question: 'Which angles matter to you right now?', options: ['How I feel', 'Practical impact'], allowMultiple: true },
      ],
    };
    const output = (await exec(tools.ask_user, input)) as typeof input;
    expect(output).toEqual(input);
    expect(output.questions).toHaveLength(2);
  });

  it('round-trips freeformLabel when provided and tolerates its absence', async () => {
    const withLabel = {
      questions: [{ question: 'What part of the decision feels heaviest?', options: ['Timing', 'Money'], allowMultiple: false }],
      freeformLabel: 'Or write your own…',
    };
    expect((await exec(tools.ask_user, withLabel)) as unknown).toEqual(withLabel);

    const withoutLabel = {
      questions: [{ question: 'What part of the decision feels heaviest?', options: ['Timing', 'Money'], allowMultiple: false }],
    };
    const output = (await exec(tools.ask_user, withoutLabel)) as { questions: unknown[]; freeformLabel?: string };
    expect(output.questions).toHaveLength(1);
    expect(output.freeformLabel).toBeUndefined();
  });
});
