import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { thirteenYearCutoff } from '@/lib/auth/validation';

// Route contract tests (plan: Accounts — verification): mock only the
// Supabase boundary; cover unauthenticated completion, the exact upsert
// payload, redirect sanitization, and snake_case errors.

const upsert = vi.fn();
const getAuthUser = vi.fn(async (): Promise<{ id: string } | null> => ({ id: 'user-1' }));

vi.mock('@/lib/supabase/server', () => ({
  isSupabaseServerConfigured: vi.fn(() => true),
  getAuthUser: vi.fn(() => getAuthUser()),
  createClient: vi.fn(async () => ({ from: vi.fn(() => ({ upsert })) })),
}));

function postJson(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost:3000/api/auth/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

const validBody = {
  fullName: 'Ana Marek',
  displayName: 'Ana',
  dateOfBirth: thirteenYearCutoff(),
  next: '/reflect',
};

beforeEach(() => {
  upsert.mockReset();
  getAuthUser.mockReset();
  getAuthUser.mockResolvedValue({ id: 'user-1' });
});

describe('POST /api/auth/complete-profile', () => {
  it('returns unauthenticated for guests', async () => {
    getAuthUser.mockResolvedValue(null);
    const res = await postJson(validBody);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns invalid_json and invalid_payload with 400', async () => {
    expect((await postJson('broken{')).status).toBe(400);
    const res = await postJson({ displayName: 'Ana' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_payload' });
  });

  it('rejects an under-13 date before writing', async () => {
    const res = await postJson({ ...validBody, dateOfBirth: '2015-01-01' });
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upserts exactly the four identity columns and returns the sanitized next', async () => {
    upsert.mockResolvedValue({ error: null });
    const res = await postJson({ ...validBody, next: null });
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({
      id: 'user-1',
      full_name: 'Ana Marek',
      display_name: 'Ana',
      date_of_birth: validBody.dateOfBirth,
    });
    expect(await res.json()).toEqual({ next: '/reflect' });
  });

  it('maps a write failure to profile_update_failed', async () => {
    upsert.mockResolvedValue({ error: { message: 'rls' } });
    const res = await postJson(validBody);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'profile_update_failed' });
  });
});
