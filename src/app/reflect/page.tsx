import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { ChatScreen } from '@/components/chat/chat-screen';

export const metadata = {
  title: 'Reflect',
};

export default function ReflectPage() {
  return (
    <AppShell>
      <Suspense>
        <ChatScreen />
      </Suspense>
    </AppShell>
  );
}
