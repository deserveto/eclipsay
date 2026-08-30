import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// OAuth callback contract (plan: Accounts — verification): sanitized
// redirects, the profile-completion gate for first-time identities, and
// failure routing. Only the Supabase boundary is mocked.

const exchangeCodeForSession = vi.fn();
const maybeSingle = vi.fn();
const authUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  isSupabaseServerConfigured: vi.fn(() => true),
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
      getUser: authUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
  })),
}));

function get(path: string): Promise<Response> {
  return GET(new Request(`http://localhost:3000${path}`));
}

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  maybeSingle.mockReset();
  authUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } } });
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe('GET /auth/callback', () => {
  it('redirects a complete profile to the sanitized next destination', async () => {
    maybeSingle.mockResolvedValue({ data: { full_name: 'Ana', display_name: 'Ana', date_of_birth: '2000-01-01' } });
    const res = await get('/auth/callback?code=c&next=%2Fjournal');
    expect(res.headers.get('location')).toBe('http://localhost:3000/journal');
  });

  it('resolves redirects against NEXT_PUBLIC_APP_URL when set', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://eclipsay.app';
    maybeSingle.mockResolvedValue({ data: { full_name: 'Ana', display_name: 'Ana', date_of_birth: '2000-01-01' } });
    const res = await get('/auth/callback?code=c&next=%2Fjournal');
    expect(res.headers.get('location')).toBe('https://eclipsay.app/journal');
  });

  it('routes a first-time incomplete identity to /complete-profile with next preserved', async () => {
    maybeSingle.mockResolvedValue({ data: { full_name: 'Ana', display_name: 'Ana', date_of_birth: null } });
    const res = await get('/auth/callback?code=c&next=%2Fprofile%3Fx%3D1');
    expect(res.headers.get('location')).toBe('http://localhost:3000/complete-profile?next=%2Fprofile%3Fx%3D1');
  });

  it('treats a missing profile row as incomplete', async () => {
    maybeSingle.mockResolvedValue({ data: null });
    const res = await get('/auth/callback?code=c');
    expect(res.headers.get('location')).toBe('http://localhost:3000/complete-profile?next=%2Freflect');
  });

  it('falls back to /reflect for a tampered external next', async () => {
    maybeSingle.mockResolvedValue({ data: { full_name: 'Ana', display_name: 'Ana', date_of_birth: '2000-01-01' } });
    const res = await get('/auth/callback?code=c&next=https%3A%2F%2Fevil.example%2Fpath');
    expect(res.headers.get('location')).toBe('http://localhost:3000/reflect');
  });

  it('routes a failed exchange to login with a visible error', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'bad code' } });
    const res = await get('/auth/callback?code=bad');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?error=oauth_failed');
  });

  it('routes a missing code to login with a visible error', async () => {
    const res = await get('/auth/callback');
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?error=oauth_failed');
  });
});
