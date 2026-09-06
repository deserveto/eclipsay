import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  isAiConfigured: vi.fn(() => true),
  getModel: vi.fn(async () => ({
    model: 'model',
    providerOptions: { openrouter: { reasoning: { exclude: true } } },
  })),
  buildSystemPrompt: vi.fn(() => 'system'),
  isSupabaseServerConfigured: vi.fn(() => false),
  getAuthUser: vi.fn(async (): Promise<{ id: string } | null> => null),
  createClient: vi.fn(),
  getAccountSessionSafety: vi.fn(async () => ({ highStakes: false, crisis: false })),
  createTarotTools: vi.fn(() => ({ tarot: true })),
  convertToModelMessages: vi.fn(async (messages: unknown) => messages),
  createUIMessageStreamResponse: vi.fn(() => new Response('ok')),
  isStepCount: vi.fn(() => ({ stepLimit: 5 })),
  hasToolCall: vi.fn((toolName: string) => ({ toolName })),
  streamText: vi.fn(() => ({
    stream: 'stream',
    text: Promise.resolve('A grounded reply.'),
    responseMessages: Promise.resolve([]),
  })),
  toUIMessageStream: vi.fn(({ stream }: { stream: unknown }) => stream),
}));

vi.mock('@/lib/ai/provider', () => ({ getModel: mocks.getModel, isAiConfigured: mocks.isAiConfigured }));
vi.mock('@/lib/ai/system-prompt', () => ({ buildSystemPrompt: mocks.buildSystemPrompt }));
vi.mock('@/lib/ai/session-safety', () => ({ getAccountSessionSafety: mocks.getAccountSessionSafety }));
vi.mock('@/lib/ai/tools', () => ({ createTarotTools: mocks.createTarotTools }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  getAuthUser: mocks.getAuthUser,
  isSupabaseServerConfigured: mocks.isSupabaseServerConfigured,
}));
vi.mock('ai', () => ({
  convertToModelMessages: mocks.convertToModelMessages,
  createUIMessageStreamResponse: mocks.createUIMessageStreamResponse,
  hasToolCall: mocks.hasToolCall,
  isStepCount: mocks.isStepCount,
  streamText: mocks.streamText,
  toUIMessageStream: mocks.toUIMessageStream,
}));

const user = (id: string, text: string, metadata?: Record<string, unknown>) => ({
  id,
  role: 'user',
  metadata,
  parts: [{ type: 'text', text }],
});

const assistant = (id: string, text: string) => ({
  id,
  role: 'assistant',
  parts: [{ type: 'text', text }],
});

function postJson(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAiConfigured.mockReturnValue(true);
  mocks.isSupabaseServerConfigured.mockReturnValue(false);
  mocks.getAuthUser.mockResolvedValue(null);
  mocks.getAccountSessionSafety.mockResolvedValue({ highStakes: false, crisis: false });
  mocks.createTarotTools.mockReturnValue({ tarot: true });
  mocks.streamText.mockReturnValue({
    stream: 'stream',
    text: Promise.resolve('A grounded reply.'),
    responseMessages: Promise.resolve([]),
  });
});

describe('POST /api/chat safety boundary', () => {
  it('keeps a crisis gate after a later neutral message in the same session', async () => {
    const res = await postJson({
      messages: [
        user('u1', 'I am having suicidal thoughts.'),
        assistant('a1', 'Please reach out for immediate support.'),
        user('u2', 'I want to think about tomorrow morning.'),
      ],
    });

    expect(res.status).toBe(200);
    expect(mocks.createTarotTools).not.toHaveBeenCalled();
    expect(mocks.buildSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        // Audit A29: the STICKY session policy reaches the prompt, so the
        // crisis instructions survive later neutral messages.
        safety: { highStakes: true, crisis: true },
        tarotUnavailable: true,
      }),
    );
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({ experimental_transform: expect.any(Function) }),
    );
  });

  it('allows tarot tools for an ordinary new reflection', async () => {
    const res = await postJson({ messages: [user('u1', 'I feel stuck between two choices.')] });

    expect(mocks.streamText).toHaveBeenCalledWith(expect.objectContaining({ experimental_transform: undefined }));
    expect(res.status).toBe(200);
    expect(mocks.createTarotTools).toHaveBeenCalledWith({ user: null });
    expect(mocks.streamText).toHaveBeenCalledWith(expect.objectContaining({ tools: { tarot: true } }));
  });

  it('stops after recommendation or structured clarification and hides reasoning', async () => {
    await postJson({ messages: [user('u1', 'I feel stuck between two choices.')] });

    const streamOptions = (mocks.streamText.mock.calls[0] as unknown as [Record<string, unknown>])[0] as {
      stopWhen: unknown;
      toolChoice?: unknown;
    };
    expect(streamOptions.stopWhen).toEqual(
      expect.arrayContaining([{ toolName: 'recommend_reading' }, { toolName: 'ask_user' }]),
    );
    expect(mocks.toUIMessageStream).toHaveBeenCalledWith(
      expect.objectContaining({ sendReasoning: false }),
    );
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: { openrouter: { reasoning: { exclude: true } } },
      }),
    );
  });

  it('requires the structured clarification tool for vague tarot starters', async () => {
    await postJson({ messages: [user('u1', "I'd like to explore something with a few cards.")] });

    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({ toolChoice: { type: 'tool', toolName: 'ask_user' } }),
    );
  });

  it('rejects a tarot event when the guest request is already gated', async () => {
    const res = await postJson({
      messages: [
        user('u1', 'I am suicidal.'),
        user('u2', '[Cards drawn · one_card] 1. The Star (upright)', { systemNotice: 'draw', readingId: 'reading-1' }),
      ],
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'tarot_unavailable' });
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it('fails closed when an authenticated session safety lookup fails', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });
    mocks.getAccountSessionSafety.mockRejectedValue(new Error('database unavailable'));

    const res = await postJson({
      sessionId: '00000000-0000-4000-8000-000000000001',
      messages: [user('u1', 'I feel stuck.')],
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'safety_check_failed' });
    expect(mocks.streamText).not.toHaveBeenCalled();
  });
});
