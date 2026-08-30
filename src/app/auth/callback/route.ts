import { NextResponse } from 'next/server';
import { safeNextPath } from '@/lib/auth/validation';
import { createClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Google OAuth callback — PKCE exchange only (plan: Accounts §4). Email links
// use /auth/confirm instead. `next` is sanitized against the configured app
// origin (removing the previous open redirect), and a first-time identity
// missing any required identity field is routed through /complete-profile.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!isSupabaseServerConfigured()) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', origin));
  }

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? origin;
  const next = safeNextPath(searchParams.get('next'), appOrigin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, display_name, date_of_birth')
          .eq('id', user.id)
          .maybeSingle();
        if (!profile?.full_name || !profile?.display_name || !profile?.date_of_birth) {
          const completion = new URL('/complete-profile', origin);
          completion.searchParams.set('next', next);
          return NextResponse.redirect(completion);
        }
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  return NextResponse.redirect(new URL('/login?error=oauth_failed', origin));
}
