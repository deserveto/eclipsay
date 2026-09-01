import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => {
  class MockDrawError extends Error {}
  return {
    DrawError: MockDrawError,
    clarifyReading: vi.fn(async () => ({ cardId: 'the_star', name: 'The Star', orientation: 'upright' })),
    getAccountSessionSafety: vi.fn(async () => ({ highStakes: false, crisis: false })),
    getAuthUser: vi.fn(async (): Promise<{ id: string } | null> => null),
    isSupabaseServerConfigured: vi.fn(() => false),
  };
});

vi.mock('@/lib/tarot/draw-service', () => ({ DrawError: mocks.DrawError, clarifyReading: mocks.clarifyReading }));
vi.mock('@/lib/ai/session-safety', () => ({ getAccountSessionSafety: mocks.getAccountSessionSafety }));
vi.mock('@/lib/supabase/server', () => ({
  getAuthUser: mocks.getAuthUser,
  isSupabaseServerConfigured: mocks.isSupabaseServerConfigured,
}));

const sessionId = '00000000-0000-4000-8000-000000000001';
const readingId = '00000000-0000-4000-8000-000000000002';

function postJson(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost:3000/api/tarot/clarify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSupabaseServerConfigured.mockReturnValue(false);
  mocks.getAuthUser.mockResolvedValue(null);
  mocks.getAccountSessionSafety.mockResolvedValue({ highStakes: false, crisis: false });
});

describe('POST /api/tarot/clarify safety boundary', () => {
  it('keeps guest clarification stateless', async () => {
    const res = await postJson({ cardId: 'the_moon', alreadyDrawn: ['the_moon'] });

    expect(res.status).toBe(200);
    expect(mocks.getAccountSessionSafety).not.toHaveBeenCalled();
    expect(mocks.clarifyReading).toHaveBeenCalledWith({
      user: null,
      readingId: undefined,
      cardId: 'the_moon',
      alreadyDrawn: ['the_moon'],
    });
  });

  it('requires a session id for authenticated clarification', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });

    const res = await postJson({ cardId: 'the_moon', readingId });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'session_required' });
    expect(mocks.clarifyReading).not.toHaveBeenCalled();
  });

  it('rejects authenticated clarification in sticky high-stakes sessions', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });
    mocks.getAccountSessionSafety.mockResolvedValue({ highStakes: true, crisis: false });

    const res = await postJson({ cardId: 'the_moon', readingId, sessionId });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'tarot_unavailable' });
    expect(mocks.clarifyReading).not.toHaveBeenCalled();
  });

  it('maps an authenticated safety lookup failure to safety_check_failed', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });
    mocks.getAccountSessionSafety.mockRejectedValue(new Error('database unavailable'));

    const res = await postJson({ cardId: 'the_moon', readingId, sessionId });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'safety_check_failed' });
    expect(mocks.clarifyReading).not.toHaveBeenCalled();
  });

  it('clarifies for an authenticated safe session', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });

    const res = await postJson({ cardId: 'the_moon', readingId, sessionId });

    expect(res.status).toBe(200);
    expect(mocks.getAccountSessionSafety).toHaveBeenCalledWith(sessionId, 'user-1');
    expect(mocks.clarifyReading).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      readingId,
      cardId: 'the_moon',
      alreadyDrawn: [],
    });
  });
});
