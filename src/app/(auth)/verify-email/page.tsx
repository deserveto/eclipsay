import { VerifyEmailPanel } from '@/components/auth/verify-email-panel';
import { safeNextPath } from '@/lib/auth/validation';

export const metadata = {
  title: 'Verify your email',
};

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <VerifyEmailPanel next={safeNextPath(params.next ?? null)} />;
}
