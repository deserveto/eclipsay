import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminEmails, isAdminConfigured, isAdminEmail } from './admin';

// auth/admin.ts pulls the supabase server seam for the async gate; the pure
// email-list logic under test here needs neither.
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  getAuthUser: vi.fn(async () => null),
  isSupabaseServerConfigured: vi.fn(() => false),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('adminEmails', () => {
  it('splits on commas, trims, lowercases, and drops empties', () => {
    vi.stubEnv('ADMIN_EMAILS', ' Admin@Example.com , second@test.io,,,');
    expect(adminEmails()).toEqual(['admin@example.com', 'second@test.io']);
  });

  it('is empty when unset', () => {
    expect(adminEmails()).toEqual([]);
  });
});

describe('isAdminConfigured', () => {
  it('is false without ADMIN_EMAILS and true with one', () => {
    expect(isAdminConfigured()).toBe(false);
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
    expect(isAdminConfigured()).toBe(true);
  });
});

describe('isAdminEmail', () => {
  it('matches case-insensitively and rejects everyone else', () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
    expect(isAdminEmail('ADMIN@EXAMPLE.COM')).toBe(true);
    expect(isAdminEmail('someone@example.com')).toBe(false);
  });

  it('never matches when the list is empty — the surface stays disabled', () => {
    expect(isAdminEmail('admin@example.com')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
