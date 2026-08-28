import { AppShell } from '@/components/app-shell';
import { SettingsForm } from '@/components/settings/settings-form';

export const metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsForm />
    </AppShell>
  );
}
