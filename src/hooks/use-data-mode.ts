'use client';

import { useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export type DataMode = 'guest' | 'account';

/**
 * Single branching point for data reads (plan: Guest store):
 * pages render from the guest store or Supabase depending on this mode.
 */
export function useDataMode(): { mode: DataMode } {
  const [mode, setMode] = useState<DataMode>('guest');

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setMode(data.session ? 'account' : 'guest');
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setMode(session ? 'account' : 'guest');
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { mode };
}
