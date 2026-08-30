import { z } from 'zod';

// Account-identity validation (plan: Accounts §1).
// One boundary shared by browser forms and route handlers so the 13+ rule,
// field limits, and redirect sanitization can never drift between the sides.
// Date-of-birth is required and 13+ enforced for NEW signups only; the schema
// and migration keep legacy/OAuth profiles nullable (PRD §52, §53).

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Calendar-date tuple comparison: is `a` on or before `b`? */
function onOrBefore(a: [number, number, number], b: [number, number, number]): boolean {
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];
  return a[2] <= b[2];
}

function todayTuple(): [number, number, number] {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()];
}

/** The birth date of someone turning 13 today — the `max` for date inputs. */
export function thirteenYearCutoff(now = new Date()): string {
  const y = now.getFullYear() - 13;
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** PRD §52/§53: teen band is 13–17, surfaced only as a boolean — never the date itself. */
export function isTeenAge(dateOfBirth: string | null | undefined): boolean {
  if (!dateOfBirth || !isValidDateOnly(dateOfBirth)) return false;
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  return onOrBefore([y + 13, m, d], todayTuple()) && !onOrBefore([y + 18, m, d], todayTuple());
}

const dateOfBirthSchema = z
  .string()
  .trim()
  .refine(isValidDateOnly, { message: 'Enter a valid birth date.' })
  .refine(
    (value) => {
      const [y, m, d] = value.split('-').map(Number);
      return onOrBefore([y + 13, m, d], todayTuple());
    },
    { message: 'Eclipsay is for ages 13 and up.' },
  );

const nameField = (label: string, min: number, max: number) =>
  z.string().trim().min(min, { message: `${label} must be at least ${min} characters.` }).max(max, {
    message: `${label} must be at most ${max} characters.`,
  });

const nextField = z.string().nullish();

export const loginSchema = z.object({
  email: z.email({ message: 'Enter a valid email address.' }),
  password: z.string().min(1, { message: 'Enter your password.' }),
  next: nextField,
});

export const signupSchema = z
  .object({
    fullName: nameField('Full name', 2, 100),
    displayName: nameField('Nickname', 2, 50),
    dateOfBirth: dateOfBirthSchema,
    email: z.string().trim().toLowerCase().pipe(z.email({ message: 'Enter a valid email address.' })),
    password: z.string().min(8, { message: 'Use at least 8 characters.' }),
    confirmPassword: z.string(),
    next: nextField,
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const completeProfileSchema = z.object({
  fullName: nameField('Full name', 2, 100),
  displayName: nameField('Nickname', 2, 50),
  dateOfBirth: dateOfBirthSchema,
  next: nextField,
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, { message: 'Use at least 8 characters.' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

/**
 * Redirect sanitizer: relative in-app paths only (`/…`, never `//…`).
 * With `allowedOrigin`, a same-origin absolute URL normalizes to its path+query.
 * Everything else — external, protocol-relative, backslash tricks, missing —
 * falls back to `/reflect`.
 */
export function safeNextPath(value: string | null | undefined, allowedOrigin?: string): string {
  const fallback = '/reflect';
  if (!value) return fallback;
  const candidate = value.trim();
  if (!candidate || candidate.includes('\\')) return fallback;
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  if (allowedOrigin) {
    try {
      const url = new URL(candidate, allowedOrigin);
      if (url.origin === new URL(allowedOrigin).origin) {
        return `${url.pathname}${url.search}`;
      }
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** Flattens a ZodError into first-message-per-field for inline form errors. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
