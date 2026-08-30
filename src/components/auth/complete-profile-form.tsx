'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeProfileSchema, thirteenYearCutoff, zodFieldErrors } from '@/lib/auth/validation';
import { createClient } from '@/lib/supabase/client';

// Final identity step for Google first sign-ins (plan: Accounts §4). Email is
// provider-owned and rendered read-only; full name/nickname prefill from the
// Google metadata where present; the same 13+ rule as signup applies before
// POST /api/auth/complete-profile writes anything.

export function CompleteProfileForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const meta = (data.user?.user_metadata ?? {}) as Record<string, string | undefined>;
        setEmail(data.user?.email ?? '');
        setFullName(meta.full_name ?? meta.name ?? '');
        setDisplayName(meta.given_name ?? '');
      })
      .catch(() => {});
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAlert(null);
    const parsed = completeProfileSchema.safeParse({ fullName, displayName, dateOfBirth, next });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 401) {
        setAlert('Your session expired. Log in again to continue.');
        return;
      }
      const payload = (await res.json().catch(() => ({}))) as { next?: string; error?: string };
      if (res.ok && payload.next) {
        router.push(payload.next);
        router.refresh();
        return;
      }
      setAlert('Couldn’t save your details right now. Try again in a moment.');
    } catch {
      setAlert('Couldn’t reach the server. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium tracking-tight">A couple of details</h1>
        <p className="text-sm text-muted-foreground">
          Before you continue: your name, what we should call you, and your date of birth.
        </p>
      </header>

      {alert && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
          {alert}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} readOnly aria-readonly className="bg-muted/60 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Managed by Google — it can’t be changed here.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            aria-invalid={fieldErrors.fullName ? true : undefined}
            aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
          />
          {fieldErrors.fullName && (
            <p id="fullName-error" className="text-xs text-destructive">
              {fieldErrors.fullName}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="displayName">What should we call you?</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="nickname"
            aria-invalid={fieldErrors.displayName ? true : undefined}
            aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined}
          />
          {fieldErrors.displayName && (
            <p id="displayName-error" className="text-xs text-destructive">
              {fieldErrors.displayName}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={thirteenYearCutoff()}
            autoComplete="bday"
            aria-invalid={fieldErrors.dateOfBirth ? true : undefined}
            aria-describedby={fieldErrors.dateOfBirth ? 'dateOfBirth-error' : 'dateOfBirth-hint'}
          />
          {fieldErrors.dateOfBirth ? (
            <p id="dateOfBirth-error" className="text-xs text-destructive">
              {fieldErrors.dateOfBirth}
            </p>
          ) : (
            <p id="dateOfBirth-hint" className="text-xs text-muted-foreground">
              Eclipsay supports ages 13 and up. We never share or display this.
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </div>
  );
}
