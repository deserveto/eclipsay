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
