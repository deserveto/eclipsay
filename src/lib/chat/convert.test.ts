import { describe, expect, it } from 'vitest';
import { activeAskUserPart, staleInteractiveMessageIds, type ChatMessage } from './convert';

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
