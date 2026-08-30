import { describe, expect, it } from 'vitest';
import { completeProfileSchema, isTeenAge, loginSchema, resetPasswordSchema, safeNextPath, signupSchema, thirteenYearCutoff } from './validation';

// Behavioral tests for the shared account-identity boundary (plan: Accounts §1).
// The 13+ gate is the load-bearing rule: a user turning 13 today passes,
// one turning 13 tomorrow fails — computed from the live clock so the suite
// never goes stale.

const baseSignup = {
  fullName: '  Ana Marek  ',
  displayName: ' Ana ',
  dateOfBirth: thirteenYearCutoff(),
  email: ' ana@example.com ',
  password: 'longenough1',
  confirmPassword: 'longenough1',
};

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const shifted = new Date(y, m - 1, d + days);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
}

describe('signupSchema age gate', () => {
  it('accepts a user whose 13th birthday is today', () => {
    const parsed = signupSchema.safeParse(baseSignup);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
  });

  it('rejects a user whose 13th birthday is tomorrow', () => {
    const parsed = signupSchema.safeParse({ ...baseSignup, dateOfBirth: shiftDays(thirteenYearCutoff(), 1) });
    expect(parsed.success).toBe(false);
  });

  it('rejects malformed and impossible dates', () => {
    for (const dateOfBirth of ['not-a-date', '2013/01/02', '2013-13-05', '2013-02-30', '2013-00-10', '']) {
      const parsed = signupSchema.safeParse({ ...baseSignup, dateOfBirth });
      expect(parsed.success, dateOfBirth).toBe(false);
    }
  });
});

describe('signupSchema fields', () => {
  it('trims names and email, lowercasing the email', () => {
    const parsed = signupSchema.parse(baseSignup);
    expect(parsed.fullName).toBe('Ana Marek');
    expect(parsed.displayName).toBe('Ana');
    expect(parsed.email).toBe('ana@example.com');
    expect(parsed.next).toBeUndefined();
  });

  it('enforces name bounds', () => {
    expect(signupSchema.safeParse({ ...baseSignup, fullName: 'A' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...baseSignup, displayName: 'A' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...baseSignup, displayName: `${'x'.repeat(51)}` }).success).toBe(false);
    expect(signupSchema.safeParse({ ...baseSignup, fullName: `${'x'.repeat(101)}` }).success).toBe(false);
  });

  it('rejects short passwords and mismatched confirmation on the confirmPassword path', () => {
    const short = signupSchema.safeParse({ ...baseSignup, password: 'short7', confirmPassword: 'short7' });
    expect(short.success).toBe(false);

    const mismatch = signupSchema.safeParse({ ...baseSignup, confirmPassword: 'different1' });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues.some((issue) => issue.path.includes('confirmPassword'))).toBe(true);
    }
  });

  it('rejects invalid emails', () => {
    expect(signupSchema.safeParse({ ...baseSignup, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('completeProfileSchema', () => {
  it('requires the same identity fields without credentials', () => {
    const parsed = completeProfileSchema.safeParse({
      fullName: 'Ana Marek',
      displayName: 'Ana',
      dateOfBirth: thirteenYearCutoff(),
    });
    expect(parsed.success).toBe(true);
    expect(completeProfileSchema.safeParse({ displayName: 'Ana', dateOfBirth: thirteenYearCutoff() }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts credentials and rejects malformed email', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('requires 8+ characters and matching confirmation', () => {
    expect(resetPasswordSchema.safeParse({ password: 'longenough1', confirmPassword: 'longenough1' }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: 'short7', confirmPassword: 'short7' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: 'longenough1', confirmPassword: 'different1' }).success).toBe(false);
  });
});

describe('isTeenAge', () => {
  it('is true exactly for 13–17', () => {
    expect(isTeenAge(thirteenYearCutoff())).toBe(true); // turns 13 today
    expect(isTeenAge(shiftDays(thirteenYearCutoff(), -365))).toBe(true); // 13, almost 14
    expect(isTeenAge(shiftDays(thirteenYearCutoff(), -5 * 365))).toBe(true); // ~18 minus a bit — still 17
    expect(isTeenAge(shiftDays(thirteenYearCutoff(), 1))).toBe(false); // turns 13 tomorrow
    const eighteen = shiftDays(thirteenYearCutoff(), -365 * 5 - 1);
    expect(isTeenAge(eighteen)).toBe(false); // turned 18
    expect(isTeenAge(null)).toBe(false);
    expect(isTeenAge('not-a-date')).toBe(false);
  });
});

describe('safeNextPath', () => {
  it('falls back to /reflect for missing values', () => {
    expect(safeNextPath(null)).toBe('/reflect');
    expect(safeNextPath(undefined)).toBe('/reflect');
    expect(safeNextPath('')).toBe('/reflect');
    expect(safeNextPath('   ')).toBe('/reflect');
  });

  it('accepts relative in-app paths with query strings', () => {
    expect(safeNextPath('/journal')).toBe('/journal');
    expect(safeNextPath('/reflect?next=x')).toBe('/reflect?next=x');
    expect(safeNextPath('/')).toBe('/');
  });

  it('rejects external, protocol-relative, and backslash destinations', () => {
    expect(safeNextPath('https://evil.example/path')).toBe('/reflect');
    expect(safeNextPath('//evil.example/path')).toBe('/reflect');
    expect(safeNextPath('/\\evil.example/path')).toBe('/reflect');
    expect(safeNextPath('javascript:alert(1)')).toBe('/reflect');
  });

  it('normalizes same-origin absolute URLs only when allowedOrigin matches', () => {
    const origin = 'https://eclipsay.app';
    expect(safeNextPath('https://eclipsay.app/journal?x=1', origin)).toBe('/journal?x=1');
    expect(safeNextPath('https://eclipsay.app/', origin)).toBe('/');
    expect(safeNextPath('https://evil.example/path', origin)).toBe('/reflect');
    expect(safeNextPath('https://eclipsay.app.evil.example/path', origin)).toBe('/reflect');
  });
});
