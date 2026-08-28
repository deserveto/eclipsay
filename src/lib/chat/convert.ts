import type { StoredMessage } from '@/lib/types';
import type { UIMessage } from 'ai';

/** Hydrates a persisted row into the client message shape. */
export function storedToUi(message: StoredMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.content }],
  };
}

export function joinUiText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}
