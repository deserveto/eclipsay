'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeNextPath } from '@/lib/auth/validation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

const PENDING_KEY = 'eclipsay.pending-verification-email';
const RESEND_SECONDS = 60;

// Verification status surface (plan: Accounts §3). The pending email lives in
// session storage only; a direct visit without it falls back to an email
// field rather than a broken resend. Resend has a visible 60-second cooldown
// and a polite live announcement on success.

export function VerifyEmailPanel({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [emailKnown, setEmailKnown] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const pending = window.sessionStorage.getItem(PENDING_KEY);
      if (pending) {
        setEmail(pending);
        return;
      }
    } catch {
      // Storage unavailable — treat as unknown below.
    }
    setEmailKnown(false);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const changeEmail = () => {
    try {
      window.sessionStorage.removeItem(PENDING_KEY);
    } catch {
      // Ignore storage failures; the field swap still happens.
    }
    setDraftEmail(email);
    setEmail('');
    setEmailKnown(false);
    setAnnouncement(null);
    requestAnimationFrame(() => emailInputRef.current?.focus());
  };

  const resend = async () => {
    const target = emailKnown ? email : draftEmail.trim();
    setError(null);
    if (!target) {
      setError('Enter the email you signed up with first.');
      emailInputRef.current?.focus();
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Accounts aren’t set up on this deployment yet.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().auth.resend({
        type: 'signup',
        email: target,
        options: { emailRedirectTo: new URL(safeNextPath(next), window.location.origin).toString() },
      });
      if (error) {
        setError('The email didn’t send. Check the address and try again.');
        return;
      }
      if (!emailKnown) {
        setEmail(target);
        setEmailKnown(true);
      }
      setCooldown(RESEND_SECONDS);
      setAnnouncement(`Verification email sent to ${target}. Give it a minute, then check your inbox.`);
    } catch {
      setError('The email didn’t send. Check the address and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div role="status" className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-3">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">Open your inbox</p>
          <p className="text-sm text-muted-foreground">
            We sent a verification link{email ? (
              <>
                {' '}
                to <span className="font-medium text-foreground">{email}</span>
              </>
            ) : (
              ' to your email'
            )}
            . Click it to activate your account.
          </p>
        </div>
      </div>

      {!emailKnown && (
        <div className="space-y-1.5">
          <Label htmlFor="pending-email">Your signup email</Label>
          <Input
            id="pending-email"
            ref={emailInputRef}
            type="email"
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
          <p className="text-xs text-muted-foreground">Enter the email you signed up with to resend the link.</p>
        </div>
      )}

      {announcement && (
        <p aria-live="polite" className="text-sm">
          {announcement}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <Button type="button" className="w-full" onClick={resend} disabled={busy || cooldown > 0}>
          {cooldown > 0 ? `Resend available in ${cooldown}s` : busy ? 'Sending…' : 'Resend email'}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={changeEmail}
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Use a different email
          </button>
          <Link
            href={`/login?next=${encodeURIComponent(safeNextPath(next))}`}
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Return to login
          </Link>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Once you’ve verified, you’ll land right back{next === '/reflect' ? ' in your reflection' : ''}. Logging in
        already?{' '}
        <button
          type="button"
          onClick={() => router.push(safeNextPath(next))}
          className="text-primary underline-offset-4 hover:underline"
        >
          Continue
        </button>
      </p>
    </div>
  );
}
