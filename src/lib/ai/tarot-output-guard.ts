import type { StreamTextTransform, TextStreamPart, ToolSet } from 'ai';

const TAROT_LANGUAGE = /\b(?:tarot|cards?|card[- ]?reading|spread|clarif(?:y|ication|ying)|draw(?:n|ing)?\s+(?:a\s+)?card)\b/i;
const SAFETY_METADATA_LINE = /^(?:user\s+safety|response\s+safety|safety\s+categories|safety|classification|risk)\s*(?::|-|=)/i;
const GROUNDED_FALLBACK =
  'We can stay with what this brings up and think it through together. What feels most important to focus on right now?';

function removeSafetyMetadata(raw: string): string {
  return raw
    .split(/\r?\n/u)
    .filter((line) => !SAFETY_METADATA_LINE.test(line.trim()))
    .join('\n')
    .trim();
}

type TextBlock<TOOLS extends ToolSet> = {
  id: string;
  text: string;
  start?: Extract<TextStreamPart<TOOLS>, { type: 'text-start' }>;
  end?: Extract<TextStreamPart<TOOLS>, { type: 'text-end' }>;
};

type BufferedEvent<TOOLS extends ToolSet> =
  | { kind: 'text'; block: TextBlock<TOOLS> }
  | { kind: 'part'; part: TextStreamPart<TOOLS> };

export function guardTarotUnavailableOutput(raw: string): string {
  const trimmed = removeSafetyMetadata(raw);
  if (trimmed.length === 0) return GROUNDED_FALLBACK;
  if (!TAROT_LANGUAGE.test(trimmed)) return trimmed;

  const grounded = trimmed
    .split(/(?<=[.!?])\s+/u)
    .filter((sentence) => !TAROT_LANGUAGE.test(sentence))
    .join(' ')
    .trim();
  return grounded || GROUNDED_FALLBACK;
}

export function tarotUnavailableTransform<TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> {
  return () => {
    const blocks = new Map<string, TextBlock<TOOLS>>();
    const events: BufferedEvent<TOOLS>[] = [];

    const getBlock = (id: string): TextBlock<TOOLS> => {
      const existing = blocks.get(id);
      if (existing) return existing;
      const block: TextBlock<TOOLS> = { id, text: '' };
      blocks.set(id, block);
      events.push({ kind: 'text', block });
      return block;
    };

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type === 'text-start') {
          const block: TextBlock<TOOLS> = { id: part.id, text: '', start: part };
          blocks.set(part.id, block);
          events.push({ kind: 'text', block });
          return;
        }
        if (part.type === 'text-delta') {
          getBlock(part.id).text += part.text;
          return;
        }
        if (part.type === 'text-end') {
          getBlock(part.id).end = part;
          return;
        }
        controller.enqueue(part);
      },
      flush(controller) {
        for (const event of events) {
          if (event.kind === 'part') {
            controller.enqueue(event.part);
            continue;
          }
          const { block } = event;
          controller.enqueue(block.start ?? { type: 'text-start', id: block.id });
          const text = guardTarotUnavailableOutput(block.text);
          if (text.length > 0) controller.enqueue({ type: 'text-delta', id: block.id, text });
          if (block.end) controller.enqueue(block.end);
        }
      },
    });
  };
}
