'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { PasswordField } from '@/components/auth/password-field';
import { loginSchema, safeNextPath, zodFieldErrors } from '@/lib/auth/validation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

const ENTRY_ERRORS: Record<string, string> = {
  oauth_failed: 'Google sign-in didn’t complete. You can try again.',
  verification_failed: 'That email link is invalid or has expired.',
};

// Password login (plan: Accounts §2/§3). Credentials stay in the browser;
// `email_not_confirmed` routes to the verification panel, and every other
// credential failure collapses into one non-enumerating alert.

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(
    initialError ? (ENTRY_ERRORS[initialError] ?? 'Something went wrong. Please try again.') : null,
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAlert(null);
    const parsed = loginSchema.safeParse({ email, password, next });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        if (error.code === 'email_not_confirmed') {
          try {
            window.sessionStorage.setItem('eclipsay.pending-verification-email', parsed.data.email);
          } catch {
            // Session storage unavailable: the verification panel falls back
            // to an email field instead of a broken resend.
          }
          router.push(`/verify-email?next=${encodeURIComponent(safeNextPath(next))}`);
          return;
        }
        setAlert('Email or password is incorrect.');
        return;
      }
      router.push(safeNextPath(next));
      router.refresh();
    } catch {
      setAlert('Could not sign in right now. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Log in to pick up where you left off.</p>
      </header>

      {!isSupabaseConfigured() && (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Accounts aren’t set up on this deployment yet — Supabase credentials are missing. You can keep reflecting as
          a guest.
        </p>
      )}

      {initialError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
          {ENTRY_ERRORS[initialError] ?? 'Something went wrong. Please try again.'}
          {initialError === 'verification_failed' && (
            <>
              {' '}
              <Link href="/verify-email" className="text-primary underline underline-offset-4 hover:opacity-80">
                Request a new verification email
              </Link>
              .
            </>
          )}
        </div>
      )}

      {alert && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
          {alert}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" className="text-xs text-destructive">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="current-password"
          hint={
            <Link
              href={`/forgot-password?next=${encodeURIComponent(safeNextPath(next))}`}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          }
        />

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleAuthButton next={next} />

      <p className="text-sm text-muted-foreground">
        New here?{' '}
        <Link href={`/signup?next=${encodeURIComponent(safeNextPath(next))}`} className="text-primary underline underline-offset-4 hover:opacity-80">
          Create an account
        </Link>
      </p>
    </div>
  );
}
