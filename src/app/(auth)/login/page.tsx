import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { safeNextPath } from '@/lib/auth/validation';
import { getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const metadata = {
  title: 'Log in',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next ?? null);
  if (isSupabaseServerConfigured()) {
    const user = await getAuthUser();
    if (user) redirect(next);
  }
  return <LoginForm next={next} initialError={params.error ?? null} />;
}
