import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => {
  class MockDrawError extends Error {}
  const ownershipResult = Promise.resolve({ data: { id: 'session-1' }, error: null });
  const ownershipQuery = {
    select: () => ({
      eq: () => ({
        eq: () => ({ maybeSingle: () => ownershipResult }),
      }),
    }),
  };
  return {
    DrawError: MockDrawError,
    drawReading: vi.fn(async () => ({ readingId: 'reading-1', spreadId: 'one_card', seed: 42, cards: [] })),
    getAccountSessionSafety: vi.fn(async () => ({ highStakes: false, crisis: false })),
    getAuthUser: vi.fn(async (): Promise<{ id: string } | null> => null),
    isSupabaseServerConfigured: vi.fn(() => false),
    createClient: vi.fn(async () => ({ from: () => ownershipQuery })),
  };
});

vi.mock('@/lib/tarot/draw-service', () => ({ DrawError: mocks.DrawError, drawReading: mocks.drawReading }));
vi.mock('@/lib/ai/session-safety', () => ({ getAccountSessionSafety: mocks.getAccountSessionSafety }));
vi.mock('@/lib/supabase/server', () => ({
  getAuthUser: mocks.getAuthUser,
  isSupabaseServerConfigured: mocks.isSupabaseServerConfigured,
  // Audit A17: the route checks session ownership before drawing.
  createClient: mocks.createClient,
}));
const sessionId = '00000000-0000-4000-8000-000000000001';

function postJson(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost:3000/api/tarot/draw', {
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

describe('POST /api/tarot/draw safety boundary', () => {
  it('keeps guest draws stateless', async () => {
    const res = await postJson({ spreadId: 'one_card' });

    expect(res.status).toBe(200);
    expect(mocks.getAccountSessionSafety).not.toHaveBeenCalled();
    expect(mocks.drawReading).toHaveBeenCalledWith({ user: null, sessionId: undefined, spreadId: 'one_card' });
  });

  it('requires a session id for authenticated draws', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });

    const res = await postJson({ spreadId: 'one_card' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'session_required' });
    expect(mocks.drawReading).not.toHaveBeenCalled();
  });

  it('rejects authenticated draws in sticky high-stakes sessions', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });
    mocks.getAccountSessionSafety.mockResolvedValue({ highStakes: true, crisis: false });

    const res = await postJson({ spreadId: 'one_card', sessionId });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'tarot_unavailable' });
    expect(mocks.drawReading).not.toHaveBeenCalled();
  });

  it('maps an authenticated safety lookup failure to safety_check_failed', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });
    mocks.getAccountSessionSafety.mockRejectedValue(new Error('database unavailable'));

    const res = await postJson({ spreadId: 'one_card', sessionId });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'safety_check_failed' });
    expect(mocks.drawReading).not.toHaveBeenCalled();
  });

  it('draws for an authenticated safe session', async () => {
    mocks.isSupabaseServerConfigured.mockReturnValue(true);
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });

    const res = await postJson({ spreadId: 'one_card', sessionId });

    expect(res.status).toBe(200);
    expect(mocks.getAccountSessionSafety).toHaveBeenCalledWith(sessionId, 'user-1');
    expect(mocks.drawReading).toHaveBeenCalledWith({ user: { id: 'user-1' }, sessionId, spreadId: 'one_card' });
  });
});
