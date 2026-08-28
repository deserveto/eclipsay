'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SPREADS } from '@/lib/tarot/spreads';
import { ALL_CARDS } from '@/lib/tarot/cards';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'major', label: 'Major Arcana' },
  { value: 'wands', label: 'Wands' },
  { value: 'cups', label: 'Cups' },
  { value: 'swords', label: 'Swords' },
  { value: 'pentacles', label: 'Pentacles' },
] as const;

// Card + spread libraries (PRD §48, §31). Guest-accessible.
export default function ExplorePage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all');
  const [tab, setTab] = useState<'cards' | 'spreads'>('cards');

  const cards = ALL_CARDS.filter((c) => filter === 'all' || c.arcana === filter);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Explore</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse the full Rider–Waite–Smith deck and the reflection spreads.
        </p>
      </header>

      <div className="flex gap-2" role="tablist" aria-label="Library">
        {(['cards', 'spreads'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            {t === 'cards' ? 'Card Library' : 'Spread Library'}
          </button>
        ))}
      </div>

      {tab === 'cards' && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter cards">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  filter === f.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
            {cards.map((card) => (
              <Link key={card.id} href={`/explore/cards/${card.id}`} className="group">
                <div className="overflow-hidden rounded-xl border border-border transition-transform group-hover:-translate-y-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/cards/rws/${card.id}.jpg`} alt={card.name} className="aspect-[2/3.4] w-full object-cover" loading="lazy" />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{card.name}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      {tab === 'spreads' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {SPREADS.map((spread) => (
            <div key={spread.id} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-sm font-medium">{spread.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{spread.description}</p>
              <ol className="mt-2 space-y-0.5 text-sm">
                {spread.positions.map((position, i) => (
                  <li key={position}>
                    <span className="text-muted-foreground">{i + 1}.</span> {position}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      <p className="pt-2 text-[11px] text-muted-foreground">
        Illustrations: Pamela Colman Smith (1909), public domain.
      </p>
    </div>
  );
}
