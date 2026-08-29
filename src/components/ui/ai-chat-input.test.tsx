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
  it('renders Eclipsay chat actions without unsupported provider controls', () => {
    const html = renderToStaticMarkup(createElement(AiChatInput, { value: '', ...handlers }));

    expect(html).toContain('aria-label="Message"');
    expect(html).toContain('aria-label="Check in with me later"');
    expect(html).toContain('aria-label="Explore with cards"');
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Send"');
    expect(html).not.toContain('Select model');
    expect(html).not.toContain('Use voice input');
  });

  it('keeps submission unavailable while the chat is busy', () => {
    const html = renderToStaticMarkup(createElement(AiChatInput, { value: 'A thought', busy: true, ...handlers }));

    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/aria-label="Send"[^>]*disabled=""/);
    expect(html).not.toContain('aria-live=');
    expect(html).toContain('Reflecting');
  });
});
