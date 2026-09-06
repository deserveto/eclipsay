'use client';

import { useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export type DataMode = 'guest' | 'account';

export type DataModeState = {
  mode: DataMode;
  /**
   * True until the auth session has resolved (audit A13). Consumers must not
   * write guest data while resolving — the visitor may turn out to be a
   * signed-in account user, and guest writes would leak account content into
   * the shared local store.
   */
  resolving: boolean;
};

/**
 * Single branching point for data reads (plan: Guest store):
 * pages render from the guest store or Supabase depending on this mode.
 */
export function useDataMode(): DataModeState {
  const [mode, setMode] = useState<DataMode>('guest');
  const [resolving, setResolving] = useState(() => isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setResolving(false);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setMode(data.session ? 'account' : 'guest');
      setResolving(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setMode(session ? 'account' : 'guest');
      setResolving(false);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { mode, resolving };
}
