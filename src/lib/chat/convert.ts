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

export function isSystemNotice(meta: MessageMeta | undefined): boolean {
  return (
    meta?.systemNotice === 'draw' ||
    meta?.systemNotice === 'clarify' ||
    meta?.readingId !== undefined ||
    meta?.clarify !== undefined
  );
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

// A reading without a transcript anchor means navigation (or a reload)
// interrupted its draw bar mid-reveal (PRD §25). Only the newest reading can
// still be in progress, and only when it was drawn after the transcript's
// last event: completed draws are anchored by their [Cards drawn] notice, and
// anything a later message postdates is history, not an interrupted draw.
export function pickInterruptedReading(
  messages: ReadonlyArray<{ meta?: { readingId?: string }; created_at: string }>,
  readings: Record<string, { createdAt: string }>,
  dismissedReadingIds: ReadonlySet<string>,
): string | null {
  const entries = Object.entries(readings);
  if (entries.length === 0) return null;
  const [newestId, newest] = entries[entries.length - 1];
  if (messages.some((m) => m.meta?.readingId === newestId)) return null;
  if (dismissedReadingIds.has(newestId)) return null;
  const last = messages[messages.length - 1];
  if (last && newest.createdAt <= last.created_at) return null;
  return newestId;
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

export type PlainClarification = {
  messageId: string;
  question: string;
  options: string[];
};

const READING_LANGUAGE = /\b(?:tarot|cards?|card\s+reading|reading|spread)\b/i;

function extractQuestion(text: string): string | null {
  const questionLines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.includes('?'));
  const question = questionLines.at(-1)?.replace(/^\[[^\]]*clarification[^\]]*\]\s*/iu, '').trim();
  return question || null;
}

function uniqueOptions(options: string[]): string[] {
  return [
    ...new Set(
      options
        .map((option) => option.replace(/^(?:and|or)\s+/iu, '').replace(/[.;:]+$/u, '').trim())
        .filter(Boolean),
    ),
  ].slice(0, 5);
}

function extractOptions(text: string, question: string): string[] {
  const lines = text.split(/\r?\n/u);
  const bulletPattern = /^\s*(?:[-*•]|\d+[.)])\s+(.+?)\s*$/u;
  const questionIndex = lines.findIndex((line) => {
    const value = line.match(bulletPattern)?.[1] ?? line;
    return value.replace(/^(?:and|or)\s+/iu, '').replace(/[.;:]+$/u, '').trim() === question;
  });
  if (questionIndex >= 0) {
    const nested: string[] = [];
    for (const line of lines.slice(questionIndex + 1)) {
      const match = line.match(bulletPattern);
      if (!match) continue;
      if ((line.match(/^\s*/u)?.[0].length ?? 0) <= 1) break;
      nested.push(match[1]);
    }
    if (nested.length >= 2) return uniqueOptions(nested);
  }

  const bulletOptions = lines
    .map((line) => line.match(bulletPattern)?.[1])
    .filter((option): option is string => Boolean(option))
    .map((option) => option.replace(/^(?:and|or)\s+/iu, '').replace(/[.;:]+$/u, '').trim())
    .filter((option) => option !== question && !option.endsWith('?'));
  if (bulletOptions.length >= 2) return uniqueOptions(bulletOptions);

  const inline = question.match(/\b(?:is it|could it be|are you more focused on|do you want to explore)\s+(?:about\s+)?(.+?)\?$/iu)?.[1];
  if (!inline) return [];
  return uniqueOptions(inline.split(/\s*,\s*|\s+\bor\b\s+/iu)).filter((option) => option.length <= 200);
}

export function activePlainClarification(
  messages: ChatMessage[],
  staleMessageIds: Set<string>,
): PlainClarification | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant' || staleMessageIds.has(message.id)) continue;
    if (message.parts.some((part) => part.type === 'tool-ask_user')) continue;
    const text = joinUiText(message).trim();
    const question = extractQuestion(text);
    if (!question) continue;
    const previousUser = [...messages.slice(0, i)].reverse().find((candidate) => candidate.role === 'user');
    if (
      !previousUser ||
      isSystemNotice(previousUser.metadata) ||
      !READING_LANGUAGE.test(joinUiText(previousUser))
    ) {
      continue;
    }
    return { messageId: message.id, question, options: extractOptions(text, question) };
  }
  return null;
}
