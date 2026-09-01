import { describe, expect, it } from 'vitest';
import type { ToolSet } from 'ai';
import { guardTarotUnavailableOutput, tarotUnavailableTransform } from './tarot-output-guard';

describe('guardTarotUnavailableOutput', () => {
  it('preserves grounded output without tarot language', () => {
    expect(guardTarotUnavailableOutput('It sounds heavy. What feels most important right now?')).toBe(
      'It sounds heavy. What feels most important right now?',
    );
  });

  it('removes internal safety metadata lines from gated replies', () => {
    expect(
      guardTarotUnavailableOutput(
        'User Safety: unsafe\nResponse Safety: safe\nSafety Categories: Suicide and Self Harm\n\nYou deserve support.',
      ),
    ).toBe('You deserve support.');
  });

  it('removes tarot recommendation sentences while keeping grounded reflection', () => {
    const guarded = guardTarotUnavailableOutput(
      'That sounds difficult to carry. A tarot reading could help frame it. We can think through what you need next.',
    );

    expect(guarded).toBe('That sounds difficult to carry. We can think through what you need next.');
    expect(guarded).not.toMatch(/tarot|cards?|spread|clarif(?:y|ication)|draw(?:n|ing)?/i);
  });

  it('falls back to ordinary reflection when every sentence mentions tarot', () => {
    const guarded = guardTarotUnavailableOutput('Cards could show you the answer. Try a spread.');

    expect(guarded).toBe(
      'We can stay with what this brings up and think it through together. What feels most important to focus on right now?',
    );
  });
});

describe('tarotUnavailableTransform', () => {
  it('filters streamed text deltas and preserves text boundaries', async () => {
    const transform = tarotUnavailableTransform<ToolSet>()({ tools: {}, stopStream: () => undefined });
    const outputPromise = (async () => {
      const parts: { type: string; id?: string; text?: string }[] = [];
      const reader = transform.readable.getReader();
      while (true) {
        const next = await reader.read();
        if (next.done) return parts;
        const part = next.value;
        if (part.type === 'text-start' || part.type === 'text-delta' || part.type === 'text-end') {
          parts.push({ type: part.type, id: part.id, text: part.type === 'text-delta' ? part.text : undefined });
        }
      }
    })();
    const writer = transform.writable.getWriter();
    await writer.write({ type: 'text-start', id: 'reply' });
    await writer.write({ type: 'text-delta', id: 'reply', text: 'A tarot reading could help.' });
    await writer.write({ type: 'text-end', id: 'reply' });
    await writer.close();

    const parts = await outputPromise;
    expect(parts.map((part) => part.type)).toEqual(['text-start', 'text-delta', 'text-end']);
    expect(parts[1].text).toContain('We can stay with what this brings up');
    expect(parts[1].text).not.toMatch(/tarot|cards?|spread/i);
  });
});
