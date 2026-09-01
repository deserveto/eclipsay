import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(async () => ({ text: 'A useful reflection note.' })),
  isStepCount: vi.fn(() => ({ stepLimit: 1 })),
  getModel: vi.fn(() => 'model'),
  isAiConfigured: vi.fn(() => true),
  buildSystemPrompt: vi.fn(() => 'system'),
}));

vi.mock('ai', () => ({ generateText: mocks.generateText, isStepCount: mocks.isStepCount }));
vi.mock('@/lib/ai/provider', () => ({ getModel: mocks.getModel, isAiConfigured: mocks.isAiConfigured }));
vi.mock('@/lib/ai/system-prompt', () => ({ buildSystemPrompt: mocks.buildSystemPrompt }));

function postJson(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost:3000/api/journal-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAiConfigured.mockReturnValue(true);
  mocks.generateText.mockResolvedValue({ text: 'A useful reflection note.' });
});

describe('POST /api/journal-assist output guard', () => {
  it('returns trimmed normal prose with the safety classification', async () => {
    mocks.generateText.mockResolvedValue({ text: '  A useful reflection note.  ' });

    const res = await postJson({ action: 'insight', content: 'I feel uncertain about this choice.' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      note: 'A useful reflection note.',
      safety: { highStakes: false, crisis: false },
    });
  });

  it.each(['User Safety: safe', 'Safety: high', 'Classification=crisis', 'Risk-high_stakes', 'safe', 'high_stakes', 'crisis', '   '])(
    'rejects unsafe or empty generated output: %s',
    async (text) => {
      mocks.generateText.mockResolvedValue({ text });

      const res = await postJson({ action: 'summary', content: 'A journal entry with enough content.' });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'generation_failed' });
    },
  );
});
