'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/auth/password-field';
import { resetPasswordSchema, zodFieldErrors } from '@/lib/auth/validation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

// New-password entry after a recovery link (plan: Accounts §3). The link's
// verifyOtp exchange creates a recovery session in this browser; without one
// the form degrades to a recoverable error pointing back at /forgot-password.

export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setExpired(true);
      return;
    }
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) setReady(true);
        else setExpired(true);
      })
      .catch(() => setExpired(true));
  }, []);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => router.push('/login'), 2500);
    return () => clearTimeout(timer);
  }, [done, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password: parsed.data.password });
      if (error) {
        setError('Couldn’t update the password. The link may have expired — request a new one below.');
        return;
      }
      setDone(true);
    } catch {
      setError('Couldn’t update the password right now. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  if (expired) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-medium tracking-tight">This link can’t be used</h1>
          <p className="text-sm text-muted-foreground">
            The password link is missing, expired, or was already used. Request a fresh one and it will work right
            away.
          </p>
        </header>
        <Button className="w-full" asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6" role="status">
        <header className="space-y-1">
          <h1 className="text-xl font-medium tracking-tight">Password updated</h1>
          <p className="text-sm text-muted-foreground">You can now log in with your new password.</p>
        </header>
        <Button className="w-full" asChild>
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    );
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Checking your link…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium tracking-tight">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose something you haven’t used elsewhere.</p>
      </header>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <PasswordField
          id="password"
          label="New password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}{' '}
            <Link href="/forgot-password" className="text-primary underline underline-offset-4 hover:opacity-80">
              Request a new link
            </Link>
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}
