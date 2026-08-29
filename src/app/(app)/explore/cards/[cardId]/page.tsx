import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
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
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Link href="/explore" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to Explore
      </Link>
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-medium tracking-tight">{card.name}</h1>
        <Badge variant="secondary">{ARCANA_LABEL[card.arcana] ?? card.arcana}</Badge>
      </header>
      <div className="flex flex-col gap-6 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/cards/rws/${card.id}.jpg`}
          alt={card.name}
          className="h-72 w-48 shrink-0 rounded-xl border border-border object-cover"
        />
        <div className="min-w-0 flex-1 space-y-4 text-sm leading-6">
          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Upright keywords</p>
            <p>{card.keywordsUpright.join(', ')}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Reversed keywords</p>
            <p>{card.keywordsReversed.join(', ')}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Traditional meaning</p>
            <p>{card.traditional}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Reflection</p>
            <p>{card.reflection}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 text-sm leading-6 sm:grid-cols-3">
        <div>
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Relationships</p>
          <p>{card.themes.relationships}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Career</p>
          <p>{card.themes.career}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Growth</p>
          <p>{card.themes.growth}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Illustration: Pamela Colman Smith (1909), public domain.</p>
    </div>
  );
}
