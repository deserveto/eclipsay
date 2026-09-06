'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

// Application error boundary (audit A26): a render failure lands here with a
// real recovery action instead of the generic framework crash screen.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Redacted: message only in dev, digest only in production — reflection
    // content must never leak into logs.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[app-error]', error.message);
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-medium tracking-tight">Something went wrong on this page.</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your reflections are safe. You can retry this page or head back home.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={reset}>
          Try again
        </Button>
        <Button size="sm" variant="ghost" onClick={() => (window.location.href = '/')}>
          Go home
        </Button>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
    </div>
  );
}
