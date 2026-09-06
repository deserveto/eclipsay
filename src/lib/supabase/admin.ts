import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client — ONLY for server-side operations that must bypass RLS:
 * guest-data migration (plan: /api/migrate/guest), account deletion, and the
 * AI runtime config write (plan: /api/admin/ai-config).
 * Never import from client components; never expose the key.
 */

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
