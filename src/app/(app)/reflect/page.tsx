import { Suspense } from 'react';
import { ChatScreen } from '@/components/chat/chat-screen';

export const metadata = {
  title: 'Reflect',
};

export default function ReflectPage() {
  return (
    <Suspense>
      <ChatScreen />
    </Suspense>
  );
}
