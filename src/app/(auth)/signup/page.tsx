import { redirect } from 'next/navigation';
import { SignupForm } from '@/components/auth/signup-form';
import { safeNextPath } from '@/lib/auth/validation';
import { getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const metadata = {
  title: 'Create account',
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next ?? null);
  if (isSupabaseServerConfigured()) {
    const user = await getAuthUser();
    if (user) redirect(next);
  }
  return <SignupForm next={next} />;
}
