import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ALL_CARDS, getCard } from '@/lib/tarot/cards';

const ARCANA_LABEL: Record<string, string> = {
  major: 'Major Arcana',
  wands: 'Suit of Wands',
  cups: 'Suit of Cups',
  swords: 'Suit of Swords',
  pentacles: 'Suit of Pentacles',
};

export function generateStaticParams() {
  return ALL_CARDS.map((card) => ({ cardId: card.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  try {
    return { title: getCard(cardId).name };
  } catch {
    return { title: 'Card' };
  }
}

// Card detail page (PRD §49): all content from the static dataset.
export default async function CardDetailPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  let card;
  try {
    card = getCard(cardId);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/explore" className="text-sm font-medium text-primary hover:underline underline-offset-4">
          ← Back to Explore
        </Link>
        <Link href="/reflect?tarot=1" className="text-sm font-medium text-primary hover:underline underline-offset-4">
          Explore with cards
        </Link>
      </div>
      <div className="mt-4 rounded-2xl bg-secondary px-6 py-10 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/cards/rws/${card.id}.jpg`}
          alt={card.name}
          className="mx-auto h-80 w-52 rounded-xl border border-border object-cover shadow-lg"
        />
        <h1 className="mt-6 text-4xl font-medium tracking-tight">{card.name}</h1>
        <p className="mx-auto mt-3 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {ARCANA_LABEL[card.arcana] ?? card.arcana} · Card {card.number}
        </p>
      </div>
      <div className="mt-8 space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Upright keywords</p>
        <div className="flex flex-wrap gap-1.5">
          {card.keywordsUpright.map((keyword) => (
            <span key={keyword} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {keyword}
            </span>
          ))}
        </div>
        <p className="pt-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Reversed keywords</p>
        <div className="flex flex-wrap gap-1.5">
          {card.keywordsReversed.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full border border-foreground/10 px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-8">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Traditional meaning</p>
        <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-7">{card.traditional}</p>
      </div>
      <div className="mt-6 rounded-xl border border-foreground/10 bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Reflection</p>
        <p className="mt-2 text-[0.9375rem] leading-7">{card.reflection}</p>
      </div>
      <div className="mt-6 rounded-xl border border-foreground/10 bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Relationships</p>
            <p className="mt-1.5 text-sm leading-6">{card.themes.relationships}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Career</p>
            <p className="mt-1.5 text-sm leading-6">{card.themes.career}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Growth</p>
            <p className="mt-1.5 text-sm leading-6">{card.themes.growth}</p>
          </div>
        </div>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">Illustration: Pamela Colman Smith (1909), public domain.</p>
    </div>
  );
}
