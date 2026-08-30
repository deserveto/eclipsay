import { redirect } from 'next/navigation';
import { CompleteProfileForm } from '@/components/auth/complete-profile-form';
import { safeNextPath } from '@/lib/auth/validation';
import { getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const metadata = {
  title: 'Complete your profile',
};

export default async function CompleteProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next ?? null);
  if (isSupabaseServerConfigured()) {
    const user = await getAuthUser();
    if (!user) redirect('/login');
  }
  return <CompleteProfileForm next={next} />;
}
