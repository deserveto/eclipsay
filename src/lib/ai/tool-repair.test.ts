import { describe, expect, it, vi } from 'vitest';
import { generateText, hasToolCall, streamText, toUIMessageStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type { LanguageModelV4GenerateResult } from '@ai-sdk/provider';
import { createTarotTools } from './tools';
import { createAskUserRepair } from './tool-repair';

const malformed = {
  questions: [{ question: 'Aspek mana yang ingin kamu lihat?', options: [{ item: { item: { item: '' } } }], allowMultiple: false }],
  freeformLabel: 'Tulis sendiri…',
};
const valid = {
  questions: [{ question: 'Aspek mana yang ingin kamu lihat?', options: ['Beban kerja', 'Hubungan tim'], allowMultiple: false }],
  freeformLabel: 'Tulis sendiri…',
};
function reply(input: unknown, toolCallId: string, toolName = 'ask_user'): LanguageModelV4GenerateResult {
  return {
    content: [{ type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) }],
    finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    warnings: [],
  };
}

describe('ask_user repair through the SDK validation boundary', () => {
  it('delivers the repaired batch to the UI stream without an error', async () => {
    const invalidReply = reply(malformed, 'original');
    const model = new MockLanguageModelV4({
      doStream: {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            const toolCall = invalidReply.content[0];
            if (toolCall.type !== 'tool-call') throw new Error('expected tool-call content');
            controller.enqueue(toolCall);
            controller.enqueue({ type: 'finish', usage: invalidReply.usage, finishReason: invalidReply.finishReason });
            controller.close();
          },
        }),
      },
      doGenerate: reply(valid, 'repair'),
    });
    const result = streamText({
      model, tools: createTarotTools({ user: null }), prompt: 'Saya ingin melihat situasi kerja saya.',
      stopWhen: hasToolCall('ask_user'),
      repairToolCall: createAskUserRepair({ model, providerOptions: {} }),
    });
    const chunks = [];
    for await (const chunk of toUIMessageStream({ stream: result.stream })) chunks.push(chunk);
    expect(chunks.filter((chunk) => chunk.type === 'error' || chunk.type === 'tool-input-error')).toEqual([]);
    expect(chunks).toContainEqual(expect.objectContaining({ type: 'tool-output-available', toolCallId: 'original', output: valid }));
    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it('repairs nested option objects and executes one valid batch with the original id', async () => {
    const model = new MockLanguageModelV4({ doGenerate: [reply(malformed, 'original'), reply(valid, 'repair')] });
    const tools = createTarotTools({ user: null });
    const execute = vi.spyOn(tools.ask_user, 'execute');
    const result = await generateText({
      model, tools, prompt: 'Saya ingin melihat situasi kerja saya.',
      repairToolCall: createAskUserRepair({ model, providerOptions: {} }),
    });
    expect(result.toolResults[0]).toMatchObject({ toolCallId: 'original', output: valid });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it('stops after one unsuccessful repair without executing malformed input', async () => {
    const model = new MockLanguageModelV4({ doGenerate: [reply(malformed, 'original'), reply(malformed, 'repair')] });
    const tools = createTarotTools({ user: null });
    const execute = vi.spyOn(tools.ask_user, 'execute');
    const result = await generateText({ model, tools, prompt: 'Work reflection', repairToolCall: createAskUserRepair({ model, providerOptions: {} }) });
    expect(result.toolCalls[0]).toMatchObject({ invalid: true });
    expect(execute).not.toHaveBeenCalled();
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it('does not repair an invented draw tool', async () => {
    const model = new MockLanguageModelV4({ doGenerate: reply({}, 'original', 'draw_tarot_cards') });
    const result = await generateText({ model, tools: createTarotTools({ user: null }), prompt: 'Work reflection', repairToolCall: createAskUserRepair({ model, providerOptions: {} }) });
    expect(result.toolCalls[0]).toMatchObject({ invalid: true });
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});
