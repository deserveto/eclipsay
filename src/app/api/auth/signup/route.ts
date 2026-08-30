import { signupSchema, safeNextPath } from '@/lib/auth/validation';
import { createClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Email/password signup (plan: Accounts §2). Identity metadata travels to the
// handle_new_user() trigger via signUp options.data; the email template's
// {{ .RedirectTo }} carries the app-origin absolute destination that
// /auth/confirm later re-sanitizes as its `next`. Age validation (13+) has
// already happened inside signupSchema — invalid ages never reach Supabase.

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return Response.json({ error: 'unconfigured' }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const { fullName, displayName, dateOfBirth, email, password, next } = parsed.data;

  // Never redirect to an arbitrary client origin: the destination is formed
  // from the configured app origin (falling back to this request's origin).
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const emailRedirectTo = new URL(safeNextPath(next), appOrigin).toString();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, display_name: displayName, date_of_birth: dateOfBirth },
      emailRedirectTo,
    },
  });
  if (error) {
    console.error('[signup] failed', error);
    // Supabase reports duplicate accounts as 422 user_already_exists ("User
    // already registered") — distinct from transient failures so the form can
    // route the person to login/recovery instead of a retry loop.
    const taken =
      error.status === 422 ||
      error.code === 'user_already_exists' ||
      /already (been )?registered/i.test(error.message);
    return Response.json({ error: taken ? 'email_taken' : 'signup_failed' }, { status: 400 });
  }

  // A session here means the project is set to auto-confirm (misconfigured for
  // production): follow the signed-in state instead of a false inbox
  // instruction (plan: Accounts — assumptions).
  if (data.session) {
    return Response.json({ status: 'signed_in' as const }, { status: 201 });
  }
  return Response.json({ status: 'verification_required' as const, email }, { status: 201 });
}
