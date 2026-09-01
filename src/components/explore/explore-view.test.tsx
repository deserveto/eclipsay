import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExploreView, SpreadCard } from './explore-view';
import CardDetailPage from '@/app/(app)/explore/cards/[cardId]/page';
import { SPREADS } from '@/lib/tarot/spreads';
import { ALL_CARDS } from '@/lib/tarot/cards';

describe('Explore card entry points', () => {
  it('renders an accessible tarot CTA on each spread card', () => {
    const html = renderToStaticMarkup(createElement(SpreadCard, { spread: SPREADS[0] }));

    expect(html).toContain('Explore with cards');
    expect(html).toContain('href="/reflect?tarot=1"');
  });

  it('renders an accessible tarot CTA on card detail pages', async () => {
    const page = await CardDetailPage({ params: Promise.resolve({ cardId: ALL_CARDS[0].id }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('← Back to Explore');
    expect(html).toContain('Explore with cards');
    expect(html).toContain('href="/reflect?tarot=1"');
  });

  it('keeps the Explore view renderable for the default card tab', () => {
    const html = renderToStaticMarkup(createElement(ExploreView));
    expect(html).toContain('Card Library');
    expect(html).toContain('Spread Library');
  });
});
