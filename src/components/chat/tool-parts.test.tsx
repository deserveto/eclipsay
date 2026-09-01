import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ToolUIPart } from 'ai';
import { ToolPartRenderer } from './tool-parts';
import type { ChatMessage } from '@/lib/chat/convert';

// Static server-render contracts for the tool action surfaces (plan: chat
// reading UX). Prose-before-action ordering is a ChatScreen rendering
// decision verified in the browser, not here — ChatScreen is hook-heavy and
// the node test environment has no jsdom.

const noop = () => {};

const confirm = {
  onSaveInsight: noop,
  onRememberThis: async () => true,
  onBringItIn: noop,
  markActed: noop,
  actedIds: new Set<string>(),
  approvedEntryIds: new Set<string>(),
};

const toolPart = (type: string, toolCallId: string, output: unknown) =>
  ({ type, toolCallId, state: 'output-available', input: {}, output }) as ToolUIPart;

const message = (parts: ToolUIPart[], extra: Partial<ChatMessage> = {}) =>
  ({ id: 'm1', role: 'assistant', parts, metadata: {}, ...extra }) as ChatMessage;

const renderParts = (parts: ToolUIPart[], props: Partial<Parameters<typeof ToolPartRenderer>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(ToolPartRenderer, {
      message: message(parts),
      declined: false,
      stale: false,
      onBeginReading: noop,
      onDecline: noop,
      onClarifyRetry: noop,
      confirm,
      ...props,
    }),
  );

const recommendationOutput = {
  context: 'Choosing between two cities',
  recommendedSpreadId: 'decision_reflection',
  title: 'Decision Reflection',
  positions: ['Where I am now', 'What keeps me here', 'What draws me elsewhere'],
  cardCount: 3,
  alternatives: [
    { spreadId: 'one_card', title: 'One Card', cardCount: 1 },
    { spreadId: 'past_present_future', title: 'Past, Present, Future', cardCount: 3 },
  ],
};

describe('RecommendationCard', () => {
  it('renders the full reading action surface', () => {
    const html = renderParts([toolPart('tool-recommend_reading', 't1', recommendationOutput)]);
    expect(html).toContain('Reading suggestion');
    expect(html).toContain('Decision Reflection');
    expect(html).toContain('3 cards');
    expect(html).toContain('Choosing between two cities');
    expect(html).toContain('Where I am now');
    expect(html).toContain('What keeps me here');
    expect(html).toContain('What draws me elsewhere');
    expect(html).toContain('Begin reading');
    expect(html).toContain('Prefer a different depth?');
    expect(html).toContain('1 card — One Card');
    expect(html).toContain('Not now');
  });

  it('numbers the spread positions in order', () => {
    const html = renderParts([toolPart('tool-recommend_reading', 't1', recommendationOutput)]);
    expect(html).toContain('<ol');
    expect(html.match(/<li /g)?.length).toBe(3);
  });

  it('renders set-aside copy when stale and hides actions', () => {
    const html = renderParts([toolPart('tool-recommend_reading', 't1', recommendationOutput)], { stale: true });
    expect(html).toContain('Set aside — just ask if you’d like this reading.');
    expect(html).not.toContain('Not now');
  });

  it('disables the primary action after it was started', () => {
    const html = renderParts([toolPart('tool-recommend_reading', 't1', recommendationOutput)], {
      confirm: { ...confirm, actedIds: new Set(['t1']) },
    });
    expect(html).toContain('Reading started');
    expect(html).toMatch(/disabled/);
  });

  it('renders nothing when declined', () => {
    const html = renderParts([toolPart('tool-recommend_reading', 't1', recommendationOutput)], { declined: true });
    expect(html).toBe('');
  });
});

  it('removes new tarot actions when the reflection is unavailable', () => {
    const html = renderParts([toolPart('tool-recommend_reading', 't1', recommendationOutput)], { tarotUnavailable: true });
    expect(html).toContain('Cards are unavailable for this reflection.');
    expect(html).not.toContain('Begin reading');
    expect(html).not.toContain('Not now');
  });

const questionBatch = {
  questions: [
    { question: 'What feels heaviest right now?', options: ['The timing', 'The people'], allowMultiple: false },
  ],
};

describe('AskUserHistory', () => {
  it('hides the part that docks above the composer', () => {
    const part = toolPart('tool-ask_user', 't1', questionBatch);
    expect(renderParts([part], { dockedToolCallId: 't1' })).toBe('');
  });

  it('labels answered batches in the transcript', () => {
    const html = renderParts([toolPart('tool-ask_user', 't1', questionBatch)], {
      confirm: { ...confirm, actedIds: new Set(['t1']) },
    });
    expect(html).toContain('What feels heaviest right now?');
    expect(html).toContain('The timing');
    expect(html).toContain('Answered');
  });

  it('labels stale unacted batches as continued in chat', () => {
    const html = renderParts([toolPart('tool-ask_user', 't1', questionBatch)], { stale: true });
    expect(html).toContain('Continued in chat');
    expect(html).not.toContain('Answered');
  });

  it('renders nothing for pre-cutover single-question payloads', () => {
    const legacy = { question: 'What feels heaviest right now?', options: ['The timing', 'The people'] };
    expect(renderParts([toolPart('tool-ask_user', 't1', legacy)])).toBe('');
  });
});

describe('ClarifyResultPart', () => {
  it('renders a working Retry action when ids are present', () => {
    const html = renderParts([
      toolPart('tool-request_clarification', 't1', {
        error: 'draw_failed',
        readingId: 'reading-1',
        cardId: 'the_moon',
      }),
    ]);
    expect(html).toContain('We couldn&#x27;t draw the cards right now.');
    expect(html).toContain('>Retry</button>');
  });

  it('renders legacy failures without a dead Retry action', () => {
    const html = renderParts([toolPart('tool-request_clarification', 't1', { error: 'draw_failed' })]);
    expect(html).toContain('We couldn&#x27;t draw the cards right now.');
    expect(html).not.toContain('>Retry</button>');
  });
});
