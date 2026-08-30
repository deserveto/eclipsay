import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { thirteenYearCutoff } from '@/lib/auth/validation';

// Route contract tests (plan: Accounts — verification): only the Supabase
// boundary is mocked; assertions cover the exact metadata keys sent to
// signUp, the app-origin redirect, age rejection BEFORE Supabase is touched,
// and the snake_case error contract.

const signUp = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  isSupabaseServerConfigured: vi.fn(() => true),
  createClient: vi.fn(async () => ({ auth: { signUp } })),
}));

function postJson(body: unknown, url = 'http://localhost:3000/api/auth/signup'): Promise<Response> {
  return POST(
    new Request(url, {
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
  email: 'ana@example.com',
  password: 'longenough1',
  confirmPassword: 'longenough1',
  next: '/journal?tab=insights',
};

beforeEach(() => {
  signUp.mockReset();
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe('POST /api/auth/signup', () => {
  it('returns unconfigured with 500 when Supabase env is missing', async () => {
    vi.mocked(isSupabaseServerConfigured).mockReturnValue(false);
    const res = await postJson(validBody);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'unconfigured' });
    vi.mocked(isSupabaseServerConfigured).mockReturnValue(true);
  });

  it('returns invalid_json and invalid_payload with 400', async () => {
    expect((await postJson('not-json{')).status).toBe(400);
    const res = await postJson({});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_payload' });
  });

  it('rejects an under-13 birth date before touching Supabase', async () => {
    const res = await postJson({ ...validBody, dateOfBirth: '2015-01-01', confirmPassword: 'longenough1' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_payload' });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('sends exact identity metadata and app-origin emailRedirectTo', async () => {
    signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
    const res = await postJson(validBody);
    expect(res.status).toBe(201);
    const options = signUp.mock.calls[0][0].options;
    expect(signUp.mock.calls[0][0].email).toBe('ana@example.com');
    expect(options.data).toEqual({
      full_name: 'Ana Marek',
      display_name: 'Ana',
      date_of_birth: validBody.dateOfBirth,
    });
    // Sanitized absolute destination formed from the request origin, never
    // an arbitrary client origin.
    expect(options.emailRedirectTo).toBe('http://localhost:3000/journal?tab=insights');
    expect(await res.json()).toEqual({ status: 'verification_required', email: 'ana@example.com' });
  });

  it('prefers NEXT_PUBLIC_APP_URL as the redirect base', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://eclipsay.app';
    signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
    await postJson({ ...validBody, next: 'https://evil.example/path' });
    expect(signUp.mock.calls[0][0].options.emailRedirectTo).toBe('https://eclipsay.app/reflect');
  });

  it('follows an auto-confirm session instead of a false inbox instruction', async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: 't' }, user: null }, error: null });
    const res = await postJson(validBody);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: 'signed_in' });
  });

  it('maps a Supabase failure to signup_failed', async () => {
    signUp.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'rate limited' } });
    const res = await postJson(validBody);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'signup_failed' });
  });

  it('maps a duplicate account to email_taken', async () => {
    signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { status: 422, code: 'user_already_exists', message: 'User already registered' },
    });
    const res = await postJson(validBody);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'email_taken' });
  });

  it('detects a duplicate account from the legacy message shape', async () => {
    signUp.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'User already been registered' } });
    const res = await postJson(validBody);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'email_taken' });
  });
});
