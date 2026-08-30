import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from './system-prompt';

// Behavioral tests for the prompt contract (plan: AI layer — System prompt).
// Tarot event notices are machine data, not the person's words: the interpret
// directive may only appear when the route reports an event, and the language
// rule must never let a notice choose the reply language.

const safety = { highStakes: false, crisis: false };

describe('buildSystemPrompt language rule', () => {
  it('anchors the reply language to the person, never to app notices', () => {
    const prompt = buildSystemPrompt({ safety });
    expect(prompt).toMatch(/language of the person's own most recent message/);
    expect(prompt).toMatch(/never let one choose your language/);
    expect(prompt).toMatch(/clarifying questions and their answer options/);
  });
});

describe('buildSystemPrompt tarot event directives', () => {
  it('contains no event directive without an event', () => {
    const prompt = buildSystemPrompt({ safety });
    expect(prompt).not.toMatch(/automated app notice/);
  });

  it('directs interpreting exactly the drawn cards on a draw event', () => {
    const prompt = buildSystemPrompt({ safety, tarotEvent: 'draw' });
    expect(prompt).toMatch(/cards have just been drawn/);
    expect(prompt).toMatch(/Interpret exactly those cards now/);
    expect(prompt).not.toMatch(/clarification card has just been drawn/);
  });

  it('directs interpreting the clarifier with its target on a clarify event', () => {
    const prompt = buildSystemPrompt({ safety, tarotEvent: 'clarify' });
    expect(prompt).toMatch(/clarification card has just been drawn/);
    expect(prompt).toMatch(/together with the card it clarifies/);
    expect(prompt).not.toMatch(/Interpret exactly those cards now/);
  });
});

describe('buildSystemPrompt clarification contract', () => {
  it('caps the batch at three questions, one batch per request', () => {
    const prompt = buildSystemPrompt({ safety });
    expect(prompt).toMatch(/ask_user at most once per reading request/);
    expect(prompt).toMatch(/one batch of one to three questions/);
    expect(prompt).toMatch(/never a second batch/);
  });

  it('permits zero questions when the intent is already clear', () => {
    const prompt = buildSystemPrompt({ safety });
    expect(prompt).toMatch(/no clarification tool at all when the reading intent is already clear/);
  });

  it('gates allowMultiple on truthful multi-answer questions', () => {
    const prompt = buildSystemPrompt({ safety });
    expect(prompt).toMatch(/allowMultiple: true on a question only when more than one option can truthfully apply/);
  });

  it('requires prose before the tool call and bans re-interrogation', () => {
    const prompt = buildSystemPrompt({ safety });
    expect(prompt).toMatch(/never the bare tool call with no prose/);
    expect(prompt).toMatch(/name the assumption once/);
  });

  it('keeps one-question-at-a-time as the default with the batch as the lone exception', () => {
    const prompt = buildSystemPrompt({ safety });
    expect(prompt).toMatch(/Ask one question at a time, and only when it genuinely moves the reflection forward\./);
    expect(prompt).toMatch(/may group up to three structured questions into a single batch/);
  });

  it('requires a user-language freeform label for the custom answer field', () => {
    const prompt = buildSystemPrompt({ safety });
    expect(prompt).toMatch(/Always set freeformLabel/);
    expect(prompt).toMatch(/phrased in the person's language/);
  });
});
