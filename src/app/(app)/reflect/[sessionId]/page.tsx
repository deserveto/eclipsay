import { Suspense } from 'react';
import { ChatScreen } from '@/components/chat/chat-screen';

export const metadata = {
  title: 'Reflect',
};

export default async function ReflectSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return (
    <Suspense>
      <ChatScreen initialSessionId={sessionId} />
    </Suspense>
  );
}
