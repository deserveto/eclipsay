import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DrawBar } from './draw-bar';
import type { DrawnCard } from '@/lib/tarot/types';

// Static markup contract for the docked draw bar (plan: draw UX). Timer and
// flip internals are browser-verified; here we lock the two-region layout,
// helper copy, accessibility, and attribution.

const card = (n: number, orientation: 'upright' | 'reversed' = 'upright'): DrawnCard => ({
  cardId: 'the_fool',
  name: 'The Fool',
  arcana: 'major',
  suit: null,
  orientation,
  position: `Position ${n}`,
  drawOrder: n,
});

describe('DrawBar', () => {
  it('renders separate Reading positions and Choose from the deck regions', () => {
    const html = renderToStaticMarkup(
      createElement(DrawBar, { cards: [card(1), card(2), card(3)], onComplete: () => {}, onCancel: () => {} }),
    );
    expect(html).toContain('aria-label="Reading positions"');
    expect(html).toContain('Reading positions');
    expect(html).toContain('aria-label="Choose from the deck"');
    expect(html).toContain('Choose from the deck');
    expect(html).toContain('Tap any face-down card. Each choice fills the next position.');
  });

  it('shows one non-clickable numbered slot per spread position up front', () => {
    const html = renderToStaticMarkup(
      createElement(DrawBar, { cards: [card(1), card(2), card(3)], onComplete: () => {}, onCancel: () => {} }),
    );
    expect(html).toContain('Position 1');
    expect(html).toContain('Position 2');
    expect(html).toContain('Position 3');
    expect(html).toContain('>1</span>');
    expect(html).toContain('>2</span>');
    expect(html).toContain('>3</span>');
    expect(html).not.toContain('<img');
  });

  it('exposes face-down deck buttons as pressable, labeled controls', () => {
    const html = renderToStaticMarkup(
      createElement(DrawBar, { cards: [card(1), card(2), card(3)], onComplete: () => {}, onCancel: () => {} }),
    );
    expect(html).toContain('aria-label="Draw card 1 of 3"');
    expect(html).toContain('aria-pressed="false"');
    expect(html.match(/aria-pressed="false"/g)?.length).toBe(7); // total + 4 decoys
  });

  it('shows the selection progress and attribution', () => {
    const html = renderToStaticMarkup(
      createElement(DrawBar, { cards: [card(1), card(2), card(3)], onComplete: () => {}, onCancel: () => {} }),
    );
    expect(html).toContain('0/3 selected');
    expect(html).toContain('Illustrations: Pamela Colman Smith (1909), public domain.');
  });

  it('renders a single-card draw without plural progress errors', () => {
    const html = renderToStaticMarkup(
      createElement(DrawBar, { cards: [card(1)], onComplete: () => {}, onCancel: () => {} }),
    );
    expect(html).toContain('0/1 selected');
    expect(html).toContain('aria-label="Draw card 1 of 1"');
  });
});
