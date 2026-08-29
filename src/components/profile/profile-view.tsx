'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SignInDialog } from '@/components/auth/sign-in-dialog';
import { useDataMode } from '@/hooks/use-data-mode';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export function ProfileView() {
  const { mode } = useDataMode();
  const [signInOpen, setSignInOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'account' || !isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [mode]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Profile</h1>
      {mode === 'account' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Signed in as {email ?? 'your account'}.</p>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!isSupabaseConfigured()) return;
              await createClient().auth.signOut();
              window.location.href = '/';
            }}
          >
            Sign out
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You are reflecting as a guest — everything stays in this browser.
          </p>
          <Button onClick={() => setSignInOpen(true)}>Sign in / Create account</Button>
        </div>
      )}
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  );
}
