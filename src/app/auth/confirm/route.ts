import { NextResponse } from 'next/server';
import { safeNextPath } from '@/lib/auth/validation';
import { createClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Email-link confirmation (plan: Accounts §4). Supabase's token-hash templates
// land here: signup links carry type=email, recovery links type=recovery.
// The `next` parameter arrives as an absolute URL formed by the signup route
// from the configured app origin — it is re-sanitized against that origin
// before redirecting, so a tampered link can never leave the app.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next');

  // Dev quirk: `next dev` rebuilds request.url on localhost:3000 behind any
  // proxy/tunnel, so every redirect must resolve against the configured origin.
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? origin;

  if (!isSupabaseServerConfigured()) {
    return NextResponse.redirect(new URL('/login?error=verification_failed', appOrigin));
  }
  // Only the two OTP types this app emails are accepted.
  if (!tokenHash || (type !== 'email' && type !== 'recovery')) {
    return NextResponse.redirect(new URL('/login?error=verification_failed', appOrigin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(new URL('/login?error=verification_failed', appOrigin));
  }

  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', appOrigin));
  }

  const destination = new URL(safeNextPath(next, appOrigin), appOrigin);
  destination.searchParams.set('verified', '1');
  return NextResponse.redirect(destination);
}
