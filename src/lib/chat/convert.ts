import type { MessageMeta } from '@/lib/types';
import type { StoredMessage } from '@/lib/types';
import type { UIMessage } from 'ai';

export type ChatMessage = UIMessage<MessageMeta>;

/** Hydrates a persisted row into the client message shape. */
export function storedToUi(message: StoredMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    metadata: message.meta,
    parts: [{ type: 'text', text: message.content }],
  };
}

export function joinUiText(message: ChatMessage): string {
  return message.parts
    .filter((part): part is Extract<ChatMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}
