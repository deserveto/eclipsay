'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

// Password recovery request (plan: Accounts §3). The response is always the
// same neutral confirmation — never a signal about whether the address has an
// account. Supabase's recovery template routes through /auth/confirm.

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const target = email.trim();
    if (!target || !target.includes('@')) {
      setFieldError('Enter a valid email address.');
      return;
    }
    setFieldError(null);
    if (!isSupabaseConfigured()) {
      setError('Accounts aren’t set up on this deployment yet.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(target, {
        redirectTo: new URL('/reset-password', window.location.origin).toString(),
      });
      if (error) {
        setError('The email didn’t send right now. Try again in a moment.');
        return;
      }
      setSent(true);
    } catch {
      setError('The email didn’t send right now. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-medium tracking-tight">Check your inbox</h1>
        </header>
        <p role="status" className="text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>, we sent a link
          to reset your password. The link works once and expires after a while.
        </p>
        <Button variant="secondary" className="w-full" asChild>
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we’ll send you a link to set a new one.
        </p>
      </header>

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
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'email-error' : undefined}
          />
          {fieldError && (
            <p id="email-error" className="text-xs text-destructive">
              {fieldError}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="text-primary underline underline-offset-4 hover:opacity-80">
          Back to login
        </Link>
      </p>
    </div>
  );
}
