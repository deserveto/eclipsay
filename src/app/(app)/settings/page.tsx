import { AiModelAdmin } from '@/components/settings/ai-model-admin';
import { SettingsForm } from '@/components/settings/settings-form';
import { adminGate } from '@/lib/auth/admin';

export const metadata = {
  title: 'Settings',
};

export default async function SettingsPage() {
  // The admin section renders only when the server-side gate passes; the
  // admin API re-checks the same gate on every call.
  const isAdmin = (await adminGate()) === null;
  return (
    <>
      <SettingsForm />
      {isAdmin ? <AiModelAdmin /> : null}
    </>
  );
}
