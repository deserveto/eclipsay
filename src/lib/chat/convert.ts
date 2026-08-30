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

// Interactive tool cards (reading suggestions, ask_user chips) are live only
// until the user's next message (PRD §30); anything earlier is inert history.
// Derived from transcript position — never persisted, never model-driven — so
// live streaming and hydration reproduce the same state for free.
export function staleInteractiveMessageIds(messages: ReadonlyArray<{ id: string; role: string }>): Set<string> {
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIndex = i;
      break;
    }
  }
  if (lastUserIndex === -1) return new Set();
  return new Set(messages.slice(0, lastUserIndex).filter((m) => m.role === 'assistant').map((m) => m.id));
}

// The live ask_user batch docks above the composer (PRD §30): newest
// output-available assistant part that is neither stale (a later user message
// exists) nor already answered. Malformed payloads stay the component's
// concern — this only finds the newest plausible part.
export function activeAskUserPart(
  messages: ChatMessage[],
  staleMessageIds: Set<string>,
  actedToolCallIds: Set<string>,
): { messageId: string; part: ToolUIPart } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant' || staleMessageIds.has(message.id)) continue;
    for (const part of message.parts) {
      if (part.type !== 'tool-ask_user') continue;
      // Union member is `tool-${string}`; the equality check fixes the
      // variant, but the compiler cannot narrow it — one reasoned cast.
      const toolPart = part as ToolUIPart;
      if (toolPart.state !== 'output-available' || actedToolCallIds.has(toolPart.toolCallId)) continue;
      return { messageId: message.id, part: toolPart };
    }
  }
  return null;
}
