import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccountSessionSafety } from './session-safety';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

function configureQuery(data: unknown[] | null, error: { message: string } | null = null) {
  const result = Promise.resolve({ data, error });
  const eqSession = vi.fn(() => ({ eq: vi.fn(() => result) }));
  const select = vi.fn(() => ({ eq: eqSession }));
  mocks.from.mockReturnValue({ select });
  mocks.createClient.mockResolvedValue({ from: mocks.from });
  return { select, eqSession };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAccountSessionSafety', () => {
  it('classifies every user message — stored meta never gates the classifier (audit A27)', async () => {
    const query = configureQuery([
      { role: 'user', content: 'I am facing foreclosure.', meta: {} },
      { role: 'user', content: 'I am suicidal.', meta: { systemNotice: 'draw', readingId: 'reading-1' } },
      { role: 'assistant', content: 'I am suicidal.', meta: {} },
    ]);

    await expect(getAccountSessionSafety('session-1', 'user-1')).resolves.toEqual({ highStakes: true, crisis: true });
    expect(mocks.from).toHaveBeenCalledWith('messages');
    expect(query.select).toHaveBeenCalledWith('role, content, meta');
    expect(query.eqSession).toHaveBeenCalledWith('session_id', 'session-1');
  });

  it('merges crisis and high-stakes findings across human messages', async () => {
    configureQuery([
      { role: 'user', content: 'My partner is abusive.', meta: {} },
      { role: 'user', content: 'I might hurt myself.', meta: { systemNotice: 'clarify' } },
      { role: 'user', content: 'I am having suicidal thoughts.', meta: {} },
    ]);

    await expect(getAccountSessionSafety('session-1', 'user-1')).resolves.toEqual({ highStakes: true, crisis: true });
  });

  it('throws when the session transcript cannot be read', async () => {
    configureQuery(null, { message: 'database unavailable' });
    await expect(getAccountSessionSafety('session-1', 'user-1')).rejects.toThrow('database unavailable');
  });
});
