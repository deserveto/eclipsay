import { describe, expect, it } from 'vitest';
import { activeAskUserPart, activePlainClarification, isSystemNotice, joinUiText, pickInterruptedReading, staleInteractiveMessageIds, storedToUi, type ChatMessage } from './convert';

describe('isSystemNotice', () => {
  it('recognizes new draw and clarification markers', () => {
    expect(isSystemNotice({ systemNotice: 'draw' })).toBe(true);
    expect(isSystemNotice({ systemNotice: 'clarify' })).toBe(true);
  });

  it('recognizes legacy reading metadata markers', () => {
    expect(isSystemNotice({ readingId: 'reading-1' })).toBe(true);
    expect(
      isSystemNotice({
        clarify: { readingId: 'reading-1', targetCardId: 'the_moon', clarifierCardId: 'the_star' },
      }),
    ).toBe(true);
  });

  it('does not classify ordinary or missing metadata as system notices', () => {
    expect(isSystemNotice({ crisis: true })).toBe(false);
    expect(isSystemNotice(undefined)).toBe(false);
  });
});

describe('stored machine notices', () => {
  it('preserves the marker while the renderer can suppress its protocol text', () => {
    const hydrated = storedToUi({
      id: 'm1',
      session_id: 's1',
      user_id: '',
      role: 'user',
      content: '[Cards drawn · one_card] 1. The Star (upright)',
      meta: { systemNotice: 'draw', readingId: 'r1' },
      created_at: '2026-01-01T00:00:00.000Z',
    });

    expect(hydrated.metadata?.systemNotice).toBe('draw');
    expect(isSystemNotice(hydrated.metadata)).toBe(true);
    expect(joinUiText(hydrated)).toContain('[Cards drawn');
  });
});

const msg = (id: string, role: 'user' | 'assistant') => ({ id, role });

describe('staleInteractiveMessageIds', () => {
  it('retires offers that precede the user’s next message', () => {
    const messages = [msg('u1', 'user'), msg('a1', 'assistant'), msg('u2', 'user'), msg('a2', 'assistant')];
    expect([...staleInteractiveMessageIds(messages)], messages.map((m) => m.id).join(',')).toEqual(['a1']);
  });

  it('keeps offers live while the assistant has the last word', () => {
    const messages = [msg('u1', 'user'), msg('a1', 'assistant'), msg('a2', 'assistant')];
    expect(staleInteractiveMessageIds(messages).size, 'latest assistant offer must stay live').toBe(0);
  });

  it('keeps everything live before the first user message', () => {
    expect(staleInteractiveMessageIds([]).size).toBe(0);
    expect(staleInteractiveMessageIds([msg('a1', 'assistant')]).size).toBe(0);
  });

  it('retires every earlier offer once the user replies again', () => {
    const messages = [
      msg('u1', 'user'),
      msg('a1', 'assistant'),
      msg('u2', 'user'),
      msg('a2', 'assistant'),
      msg('a3', 'assistant'),
      msg('u3', 'user'),
      msg('a4', 'assistant'),
    ];
    expect([...staleInteractiveMessageIds(messages)].sort(), messages.map((m) => m.id).join(',')).toEqual(['a1', 'a2', 'a3']);
  });
});

describe('activeAskUserPart', () => {
  const askPart = (toolCallId: string, state = 'output-available') => ({
    type: 'tool-ask_user',
    toolCallId,
    state,
    input: {},
    output: { questions: [{ question: 'Which angle matters most?', options: ['Feelings', 'Facts'], allowMultiple: false }] },
  });
  const assistant = (id: string, parts: object[]) => ({ id, role: 'assistant', parts }) as ChatMessage;

  it('returns the newest live batch', () => {
    const messages = [assistant('a1', [askPart('t1')]), assistant('a2', [askPart('t2')])];
    const active = activeAskUserPart(messages, new Set(), new Set());
    expect(active?.messageId).toBe('a2');
    expect(active?.part.toolCallId).toBe('t2');
  });

  it('skips stale assistant messages', () => {
    const messages = [assistant('a1', [askPart('t1')]), assistant('a2', [askPart('t2')])];
    expect(activeAskUserPart(messages, new Set(['a2']), new Set())?.part.toolCallId).toBe('t1');
  });

  it('skips already-answered tool calls', () => {
    const messages = [assistant('a1', [askPart('t1')])];
    expect(activeAskUserPart(messages, new Set(), new Set(['t1']))).toBeNull();
  });

  it('ignores parts that are still streaming or of other tools', () => {
    const messages = [
      assistant('a1', [
        askPart('t1', 'input-streaming'),
        { type: 'tool-recommend_reading', toolCallId: 't9', state: 'output-available', input: {}, output: {} },
      ]),
    ];
    expect(activeAskUserPart(messages, new Set(), new Set())).toBeNull();
  });

  it('returns null for an empty transcript', () => {
    expect(activeAskUserPart([], new Set(), new Set())).toBeNull();
  });
});

describe('activePlainClarification', () => {
  const textMessage = (
    id: string,
    role: 'user' | 'assistant',
    text: string,
    metadata?: Record<string, unknown>,
  ) => ({ id, role, metadata, parts: [{ type: 'text', text }] }) as ChatMessage;

  it('turns bullet choices in a tarot clarification into actionable options', () => {
    const messages = [
      textMessage('u1', 'user', "I'd like to explore something with a few cards."),
      textMessage('a1', 'assistant', 'What feels most alive?\n- The opportunity\n- What I would leave behind\n- Something else'),
    ];

    expect(activePlainClarification(messages, new Set())).toEqual({
      messageId: 'a1',
      question: 'What feels most alive?',
      options: ['The opportunity', 'What I would leave behind', 'Something else'],
    });
  });

  it('extracts inline choices and ignores ordinary or post-draw questions', () => {
    const inline = [
      textMessage('u1', 'user', "I'd like to explore something with a few cards."),
      textMessage(
        'a1',
        'assistant',
        'A reading can help. What feels most alive — is it about which path to take, what might be in the way, or something else?',
      ),
    ];
    expect(activePlainClarification(inline, new Set())?.options).toEqual([
      'which path to take',
      'what might be in the way',
      'something else',
    ]);

    const ordinary = [textMessage('u1', 'user', 'I had a long day.'), textMessage('a1', 'assistant', 'What happened?')];
    expect(activePlainClarification(ordinary, new Set())).toBeNull();

    const afterDraw = [
      textMessage('u1', 'user', '[Cards drawn · one_card] 1. The Star (upright)', { systemNotice: 'draw' }),
      textMessage('a1', 'assistant', 'What does this invite you to notice?'),
    ];
    expect(activePlainClarification(afterDraw, new Set())).toBeNull();
  });

  it('does not compete with a structured ask_user part or stale history', () => {
    const structured = [
      textMessage('u1', 'user', "I'd like to explore something with a few cards."),
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Which angle matters most?' },
          {
            type: 'tool-ask_user',
            toolCallId: 't1',
            state: 'output-available',
            input: {},
            output: { questions: [{ question: 'Which angle?', options: ['A', 'B'], allowMultiple: false }] },
          },
        ],
      },
    ] as ChatMessage[];
    expect(activePlainClarification(structured, new Set())).toBeNull();
    expect(activePlainClarification(structured, new Set(['a1']))).toBeNull();
  });
});

describe('pickInterruptedReading', () => {
  const at = (minutes: number) => new Date(Date.parse('2026-01-01T10:00:00.000Z') + minutes * 60_000).toISOString();
  const plain = (id: string, createdAt: string) => ({ id, created_at: createdAt });
  const notice = (readingId: string, createdAt: string) => ({ id: `notice-${readingId}`, meta: { readingId }, created_at: createdAt });

  it('resumes a draw interrupted after the transcript ended', () => {
    const readings = { r1: { createdAt: at(1) } };
    expect(pickInterruptedReading([plain('u1', at(0))], readings, new Set()), 'fresh unanchored draw must resume').toBe('r1');
  });

  it('never resurrects a draw the completion notice already anchored', () => {
    const messages = [plain('u1', at(0)), notice('r1', at(2))];
    const readings = { r1: { createdAt: at(1) } };
    expect(pickInterruptedReading(messages, readings, new Set())).toBeNull();
  });

  it('keeps a bar the user closed closed', () => {
    const readings = { r1: { createdAt: at(1) } };
    expect(pickInterruptedReading([plain('u1', at(0))], readings, new Set(['r1']))).toBeNull();
  });

  it('treats an orphan the conversation moved past as history, not an interrupted draw', () => {
    const messages = [plain('u1', at(0)), notice('r1', at(2)), plain('u2', at(3))];
    const readings = { r1: { createdAt: at(1) } };
    expect(pickInterruptedReading(messages, readings, new Set()), 'completed draw must not reopen its picker').toBeNull();
  });

  it('only ever considers the newest reading', () => {
    const messages = [plain('u1', at(0)), notice('r1', at(2))];
    const readings = { r2: { createdAt: at(0.5) }, r1: { createdAt: at(1) } };
    expect(pickInterruptedReading(messages, readings, new Set()), 'an older orphan must not resurrect behind a completed draw').toBeNull();
  });

  it('returns null without readings', () => {
    expect(pickInterruptedReading([plain('u1', at(0))], {}, new Set())).toBeNull();
  });
});
