'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { PasswordField } from '@/components/auth/password-field';
import { safeNextPath, signupSchema, thirteenYearCutoff, zodFieldErrors } from '@/lib/auth/validation';
import { track } from '@/lib/analytics';

const ERROR_COPY: Record<string, string> = {
  invalid_payload: 'Please check the highlighted fields and try again.',
  email_taken: 'You already have an account with this email.',
  signup_failed: 'We couldn’t create your account right now. Try again in a moment.',
  unconfigured: 'Accounts aren’t set up on this deployment yet.',
};

// Email/password signup (plan: Accounts §3). The full identity set travels to
// POST /api/auth/signup; on success the pending email lands in session
// storage for the verification panel and the flow routes to /verify-email
// with the sanitized `next` preserved. The date input's max is the exact
// 13-year cutoff; the server remains the age authority.

export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: '', displayName: '', dateOfBirth: '', email: '', password: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAlert(null);
    setEmailTaken(false);
    const parsed = signupSchema.safeParse({ ...form, next });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed.data }),
      });
      const payload = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.status === 201 && payload.status === 'signed_in') {
        // Auto-confirm misconfiguration (plan: Accounts — assumptions): never
        // strand an authenticated user on an inbox instruction.
        router.push(safeNextPath(next));
        router.refresh();
        return;
      }
      if (res.status === 201 && payload.status === 'verification_required') {
        try {
          window.sessionStorage.setItem('eclipsay.pending-verification-email', parsed.data.email);
        } catch {
          // Storage unavailable: the verification panel asks for the email.
        }
        track('signup_started');
        router.push(`/verify-email?next=${encodeURIComponent(safeNextPath(next))}`);
        return;
      }
      setAlert(ERROR_COPY[payload.error ?? ''] ?? 'We couldn’t create your account right now. Try again in a moment.');
      setEmailTaken(payload.error === 'email_taken');
    } catch {
      setAlert('We couldn’t reach the server. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form) => fieldErrors[key];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Keep your reflections, journal, and memories — on every device you sign in from.
        </p>
      </header>

      {alert && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
          <p>{alert}</p>
          {emailTaken && (
            <p className="text-muted-foreground">
              Try{' '}
              <Link href={`/login?next=${encodeURIComponent(safeNextPath(next))}`} className="font-medium underline underline-offset-2">
                logging in
              </Link>{' '}
              instead, or{' '}
              <Link href={`/forgot-password?next=${encodeURIComponent(safeNextPath(next))}`} className="font-medium underline underline-offset-2">
                reset your password
              </Link>{' '}
              if you’ve forgotten it.
            </p>
          )}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => set('fullName')(e.target.value)}
            autoComplete="name"
            placeholder="Alex Rivera"
            aria-invalid={field('fullName') ? true : undefined}
            aria-describedby={field('fullName') ? 'fullName-error' : undefined}
          />
          {field('fullName') && (
            <p id="fullName-error" className="text-xs text-destructive">
              {field('fullName')}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="displayName">What should we call you?</Label>
          <Input
            id="displayName"
            value={form.displayName}
            onChange={(e) => set('displayName')(e.target.value)}
            autoComplete="nickname"
            placeholder="Alex"
            aria-invalid={field('displayName') ? true : undefined}
            aria-describedby={field('displayName') ? 'displayName-error' : undefined}
          />
          {field('displayName') && (
            <p id="displayName-error" className="text-xs text-destructive">
              {field('displayName')}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth')(e.target.value)}
            max={thirteenYearCutoff()}
            autoComplete="bday"
            aria-invalid={field('dateOfBirth') ? true : undefined}
            aria-describedby={field('dateOfBirth') ? 'dateOfBirth-error' : 'dateOfBirth-hint'}
          />
          {field('dateOfBirth') ? (
            <p id="dateOfBirth-error" className="text-xs text-destructive">
              {field('dateOfBirth')}
            </p>
          ) : (
            <p id="dateOfBirth-hint" className="text-xs text-muted-foreground">
              Eclipsay supports ages 13 and up. We never share or display this.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={field('email') ? true : undefined}
            aria-describedby={field('email') ? 'email-error' : undefined}
          />
          {field('email') && (
            <p id="email-error" className="text-xs text-destructive">
              {field('email')}
            </p>
          )}
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={form.password}
          onChange={set('password')}
          error={field('password')}
          autoComplete="new-password"
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
          error={field('confirmPassword')}
          autoComplete="new-password"
        />

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleAuthButton next={next} />

      <p className="text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href={`/login?next=${encodeURIComponent(safeNextPath(next))}`} className="text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
