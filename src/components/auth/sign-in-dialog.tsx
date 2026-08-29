'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { track } from '@/lib/analytics';

// Sign-in as a value moment (PRD §14): magic-link email + Google OAuth.
export function SignInDialog({
  open,
  onOpenChange,
  title = 'Create an account to keep this reflection.',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUrl = () => `${window.location.origin}/auth/callback`;

  const sendMagicLink = async () => {
    if (!isSupabaseConfigured()) {
      setError('Accounts need Supabase credentials to be configured (.env.local).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectUrl() },
      });
      if (err) throw err;
      setSent(true);
      track('signup_started');
    } catch {
      setError('Could not send the link. Check the address and try again.');
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured()) {
      setError('Accounts need Supabase credentials to be configured (.env.local).');
      return;
    }
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Your reflections stay private. An account keeps them safe across devices.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <p className="rounded-lg bg-secondary px-3 py-2 text-sm">
            Check your inbox — the link signs you in and brings you right back.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
            />
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            {email.length > 0 && !email.includes('@') && (
              <p className="text-xs text-muted-foreground">Enter a valid email to continue.</p>
            )}
            <Button disabled={busy || !email.includes('@')} onClick={sendMagicLink}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
            <Button variant="secondary" onClick={signInWithGoogle}>
              Continue with Google
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
