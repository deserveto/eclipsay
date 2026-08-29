import type { MessageMeta, PersistedToolPart } from '@/lib/types';
import type { StoredMessage } from '@/lib/types';
import type { ToolUIPart, UIMessage } from 'ai';

export type ChatMessage = UIMessage<MessageMeta>;

/** Hydrates a persisted row into the client message shape. */
export function storedToUi(message: StoredMessage): ChatMessage {
  // Tool parts ride in meta.tools so the interaction cards (questions,
  // reading recommendations, confirm proposals) re-render after hydration.
  const toolParts = (message.meta.tools ?? []).map(
    (part) =>
      ({
        type: part.type,
        toolCallId: part.toolCallId,
        state: part.state,
        input: part.input,
        output: part.output,
      }) as unknown as ChatMessage['parts'][number],
  );
  return {
    id: message.id,
    role: message.role,
    metadata: message.meta,
    parts: [...toolParts, { type: 'text', text: message.content }],
  };
}

/** Serializes static tool parts into meta so hydration can restore them. */
export function extractToolParts(message: ChatMessage): PersistedToolPart[] {
  return message.parts
    .filter((part): part is ToolUIPart => part.type.startsWith('tool-'))
    .map((part) => ({
      type: part.type,
      toolCallId: part.toolCallId,
      state: part.state,
      input: 'input' in part ? part.input : undefined,
      output: 'output' in part ? part.output : undefined,
    }));
}

export function joinUiText(message: ChatMessage): string {
  return message.parts
    .filter((part): part is Extract<ChatMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}
