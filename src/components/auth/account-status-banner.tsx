'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { CheckCircle2, X } from 'lucide-react';
import { track } from '@/lib/analytics';

// Post-verification status strip (plan: Accounts §6). Appears wherever the
// email link lands the user with ?verified=1; dismissal strips only the
// `verified` parameter while preserving path and all other query parameters.
// Consuming the verified state counts signup_completed exactly once.

export function AccountStatusBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === '1') {
      setVisible(true);
      track('signup_completed');
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    const params = new URLSearchParams(window.location.search);
    params.delete('verified');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-border bg-primary/10 px-4 py-2 md:px-6"
    >
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate">
          <span className="font-medium">Email verified.</span> Your account is ready.
        </span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
