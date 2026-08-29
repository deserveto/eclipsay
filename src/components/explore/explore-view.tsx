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
export function ExploreView() {
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
            <div
              key={spread.id}
              className="flex gap-4 rounded-xl border border-foreground/10 bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[0.9375rem] font-medium leading-snug">{spread.title}</h2>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-medium text-secondary-foreground">
                    {spread.positions.length} {spread.positions.length === 1 ? 'card' : 'cards'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{spread.description}</p>
                <ol className="mt-3 space-y-1">
                  {spread.positions.map((position, i) => (
                    <li key={position} className="flex items-baseline gap-2 text-sm leading-5">
                      <span className="text-[0.6875rem] font-medium tabular-nums text-muted-foreground">{i + 1}</span>
                      {position}
                    </li>
                  ))}
                </ol>
              </div>
              <div
                className="hidden shrink-0 flex-wrap items-start justify-end gap-1.5 sm:flex"
                aria-hidden
              >
                {spread.positions.map((position, i) => (
                  <div
                    key={position}
                    className="grid h-[54px] w-[36px] place-items-center rounded-[5px] border border-foreground/15 bg-secondary text-[0.6875rem] font-medium tabular-nums text-muted-foreground"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="pt-2 text-xs text-muted-foreground">
        Illustrations: Pamela Colman Smith (1909), public domain.
      </p>
    </div>
  );
}
