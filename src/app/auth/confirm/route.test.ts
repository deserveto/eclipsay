import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// Confirmation route contract (plan: Accounts — verification): successful
// email/recovery redirects, tampered/external `next`, and expired-token
// routing. Only the Supabase boundary is mocked.

const verifyOtp = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  isSupabaseServerConfigured: vi.fn(() => true),
  createClient: vi.fn(async () => ({ auth: { verifyOtp } })),
}));

function get(path: string): Promise<Response> {
  return GET(new Request(`http://localhost:3000${path}`));
}

beforeEach(() => {
  verifyOtp.mockReset();
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe('GET /auth/confirm', () => {
  it('verifies a signup link and redirects to next with verified=1', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await get('/auth/confirm?token_hash=tok&type=email&next=http%3A%2F%2Flocalhost%3A3000%2Fjournal');
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'email', token_hash: 'tok' });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/journal?verified=1');
  });

  it('appends verified=1 without duplicating existing query params', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await get('/auth/confirm?token_hash=tok&type=email&next=%2Fjournal%3Ftab%3Dinsights');
    expect(res.headers.get('location')).toBe('http://localhost:3000/journal?tab=insights&verified=1');
  });

  it('forces /reset-password for recovery links, ignoring next', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await get('/auth/confirm?token_hash=tok&type=recovery&next=%2Fprofile');
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'tok' });
    expect(res.headers.get('location')).toBe('http://localhost:3000/reset-password');
  });

  it('redirects an external next to the safe fallback', async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await get('/auth/confirm?token_hash=tok&type=email&next=https%3A%2F%2Fevil.example%2Fpath');
    expect(res.headers.get('location')).toBe('http://localhost:3000/reflect?verified=1');
  });

  it('rejects a next from a foreign origin even when NEXT_PUBLIC_APP_URL is set', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://eclipsay.app';
    verifyOtp.mockResolvedValue({ error: null });
    const res = await get('/auth/confirm?token_hash=tok&type=email&next=https%3A%2F%2Fevil.example%2Fsteal');
    expect(res.headers.get('location')).toBe('http://localhost:3000/reflect?verified=1');
  });

  it('routes missing or expired tokens to login with a visible error', async () => {
    expect((await get('/auth/confirm?type=email')).headers.get('location')).toBe(
      'http://localhost:3000/login?error=verification_failed',
    );
    expect((await get('/auth/confirm?token_hash=tok&type=invite')).headers.get('location')).toBe(
      'http://localhost:3000/login?error=verification_failed',
    );
    verifyOtp.mockResolvedValue({ error: { message: 'expired' } });
    expect((await get('/auth/confirm?token_hash=tok&type=email&next=%2Fjournal')).headers.get('location')).toBe(
      'http://localhost:3000/login?error=verification_failed',
    );
  });
});
