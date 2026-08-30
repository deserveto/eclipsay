import { completeProfileSchema, safeNextPath } from '@/lib/auth/validation';
import { createClient, getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Profile completion for OAuth users (plan: Accounts §2). Google never
// supplies a birth date, so first-time identities land here after the
// callback; the same 13+ rule as email signup applies. Only the four identity
// columns are written — reflection preferences stay owned by Settings.

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return Response.json({ error: 'unconfigured' }, { status: 500 });
  }
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = completeProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const { fullName, displayName, dateOfBirth, next } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    full_name: fullName,
    display_name: displayName,
    date_of_birth: dateOfBirth,
  });
  if (error) {
    console.error('[complete-profile] failed', error);
    return Response.json({ error: 'profile_update_failed' }, { status: 500 });
  }
  return Response.json({ next: safeNextPath(next) });
}
