// Session title helpers shared by the chat route, the title API route, and
// the chat screen. The naive `titleFrom` value doubles as the "untouched
// placeholder" marker: title generation only ever replaces it, never a
// user-authored rename.

export const TITLE_MAX = 80;
export const NAIVE_TITLE = 'New Reflection';

// Deterministic placeholder: the first message, compacted. The chat route
// (account session creation) and the guest store both write this exact
// value, so guarded title generation can compare against it.
export function titleFrom(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length === 0 ? NAIVE_TITLE : compact.slice(0, 48);
}

// LLM output → safe single-line title: collapses whitespace, strips
// wrapping quotes/brackets/markdown emphasis, caps length. Falls back to
// the naive title when nothing usable remains.
export function coerceTitle(raw: string): string {
  let title = raw.replace(/\s+/g, ' ').trim();
  title = title.replace(/^["'`*#([【「"']*/, '').replace(/["'`*)\]】"']*$/, '').trim();
  if (title.length === 0) return NAIVE_TITLE;
  return title.slice(0, TITLE_MAX);
}

export function titleSystemPrompt(): string {
  return [
    'You write concise titles for reflective one-on-one conversations.',
    'Reply with ONLY the title: 2 to 6 words, no quotes, no trailing punctuation.',
    'Write it in the same language the person wrote in.',
    'Capture the topic they brought (their situation, question, or the cards drawn), not the mood.',
  ].join(' ');
}

export function titlePrompt(userText: string, assistantText: string): string {
  const person = userText.replace(/\s+/g, ' ').trim().slice(0, 2000);
  const reply = assistantText.replace(/\s+/g, ' ').trim().slice(0, 1000);
  return `Write the title for this reflective conversation.\n\nPerson: ${person}\n\nReply (context only): ${reply}`;
}
