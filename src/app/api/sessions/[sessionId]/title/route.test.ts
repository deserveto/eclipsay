import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(async () => ({ text: 'A quiet decision' })),
  getModel: vi.fn(async () => ({ model: 'model', providerOptions: {} })),
  isAiConfigured: vi.fn(() => true),
  getAuthUser: vi.fn(async (): Promise<{ id: string } | null> => null),
  isSupabaseServerConfigured: vi.fn(() => false),
  createClient: vi.fn(),
}));

vi.mock('ai', () => ({ generateText: mocks.generateText }));
vi.mock('@/lib/ai/provider', () => ({ getModel: mocks.getModel, isAiConfigured: mocks.isAiConfigured }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  getAuthUser: mocks.getAuthUser,
  isSupabaseServerConfigured: mocks.isSupabaseServerConfigured,
}));

const sessionId = '00000000-0000-4000-8000-000000000001';

function postJson(body: unknown): Promise<Response> {
  return POST(
    new Request(`http://localhost:3000/api/sessions/${sessionId}/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ sessionId }) },
  );
}

function configureAccountUpdate(data: { id: string } | null = { id: sessionId }) {
  const maybeSingle = vi.fn(async () => ({ data, error: null }));
  const select = vi.fn(() => ({ maybeSingle }));
  const chain = {
    eq: vi.fn(),
    select,
  };
  chain.eq.mockReturnValue(chain);
  const update = vi.fn(() => chain);
  const from = vi.fn(() => ({ update }));
  mocks.createClient.mockResolvedValue({ from });
  return { update, chain, maybeSingle };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAiConfigured.mockReturnValue(true);
  mocks.isSupabaseServerConfigured.mockReturnValue(false);
  mocks.getAuthUser.mockResolvedValue(null);
  mocks.generateText.mockResolvedValue({ text: 'A quiet decision' });
});

describe('POST /api/sessions/:sessionId/title output guard', () => {
  it('passes the utility provider policy to generation', async () => {
    const providerOptions = { openrouter: { reasoning: { exclude: true } } };
    mocks.getModel.mockResolvedValueOnce({ model: 'model', providerOptions });
    mocks.generateText.mockImplementationOnce(async (options?: unknown) => {
      const policy = (options as { providerOptions?: unknown }).providerOptions;
      if (!policy) throw new Error('Missing provider policy');
      return { text: 'A quiet decision' };
    });
    const res = await postJson({ userText: 'A difficult choice' });
    expect(res.status).toBe(200);
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({ providerOptions }));
  });

  it('returns a normal generated title for guests', async () => {
    mocks.generateText.mockResolvedValue({ text: '  "A quiet decision"  ' });

    const res = await postJson({ userText: 'I am weighing a difficult choice.', assistantText: 'Let us explore it.' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: 'A quiet decision', applied: true });
  });

  it.each(['User Safety: safe', 'Safety: high', 'Classification=crisis', 'Risk-high_stakes', 'safe', 'high_stakes', 'crisis', '   '])(
    'rejects unsafe or empty generated title: %s',
    async (text) => {
      mocks.generateText.mockResolvedValue({ text });
      mocks.isSupabaseServerConfigured.mockReturnValue(true);
      mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });

      const res = await postJson({ userText: 'I am weighing a difficult choice.', assistantText: 'Let us explore it.', overwrite: true });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'generation_failed' });
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );

  it('preserves the automatic compare-and-swap title guard for accounts', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });
    const client = configureAccountUpdate();

    const res = await postJson({ userText: 'I am weighing a difficult choice.', assistantText: 'Let us explore it.' });

    expect(res.status).toBe(200);
    expect(client.update).toHaveBeenCalledWith({ title: 'A quiet decision' });
    expect(client.chain.eq.mock.calls).toEqual([
      ['id', sessionId],
      ['user_id', 'user-1'],
      ['title', 'I am weighing a difficult choice.'],
    ]);
  });

  it('does not overwrite a renamed account title when the CAS misses', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });
    const client = configureAccountUpdate(null);

    const res = await postJson({ userText: 'I am weighing a difficult choice.', assistantText: 'Let us explore it.' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: 'A quiet decision', applied: false });
    expect(client.maybeSingle).toHaveBeenCalledTimes(1);
  });
});
