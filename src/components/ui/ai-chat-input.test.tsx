import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiChatInput } from './ai-chat-input';

const handlers = {
  onValueChange: () => {},
  onSubmit: () => {},
  onOpenCheckIn: () => {},
  onExploreCards: () => {},
};

describe('AiChatInput', () => {
  it('renders Eclipsay chat actions visibly and tabbably at rest', () => {
    const html = renderToStaticMarkup(createElement(AiChatInput, { value: '', ...handlers }));

    expect(html).toContain('aria-label="Message"');
    expect(html).toContain('aria-label="Check in with me later"');
    expect(html).toContain('aria-label="Explore with cards"');
    expect(html).not.toContain('tabindex="-1"');
    expect(html).not.toMatch(/<div[^>]*aria-hidden="true"/);
    expect(html).toContain('aria-label="Send"');
    expect(html).not.toContain('Select model');
    expect(html).not.toContain('Use voice input');
  });

  it('omits Cards when the reflection has a sticky safety gate', () => {
    const html = renderToStaticMarkup(createElement(AiChatInput, { value: '', cardsDisabled: true, ...handlers }));

    expect(html).toContain('aria-label="Check in with me later"');
    expect(html).not.toContain('aria-label="Explore with cards"');
    expect(html).not.toContain('>Cards</span>');
  });

  it('keeps submission unavailable while the chat is busy', () => {
    const html = renderToStaticMarkup(createElement(AiChatInput, { value: 'A thought', busy: true, ...handlers }));

    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/aria-label="Send"[^>]*disabled=""/);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Reflecting');
  });
});
