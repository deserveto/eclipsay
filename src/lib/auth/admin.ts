import { getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Admin gate (plan: AI admin config). The admin surface exists only when
// ADMIN_EMAILS is set; a signed-in user qualifies when their email is on the
// list. Comparison is case-insensitive; entries are trimmed, empty entries
// dropped.

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminConfigured(): boolean {
  return adminEmails().length > 0;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return email != null && adminEmails().includes(email.toLowerCase());
}

export type AdminGateCode = 'admin_disabled' | 'unauthenticated' | 'forbidden';

/**
 * Shared guard for /api/admin/* routes. Returns the error code to respond
 * with, or null when the caller is a signed-in admin. ADMIN_EMAILS unset
 * disables the admin surface entirely rather than failing open.
 */
export async function adminGate(): Promise<AdminGateCode | null> {
  if (!isAdminConfigured()) return 'admin_disabled';
  if (!isSupabaseServerConfigured()) return 'unauthenticated';
  const user = await getAuthUser();
  if (!user) return 'unauthenticated';
  return isAdminEmail(user.email) ? null : 'forbidden';
}
