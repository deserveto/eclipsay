'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSpread } from '@/lib/tarot/spreads';
import type { DrawnCard } from '@/lib/tarot/types';
import { CardDetailDialog } from './card-detail-dialog';

// Tarot reading panel (PRD §29, §65): face-down deal → staggered flip reveal,
// reversed rendering + text badge (never color-only), alt text "<name>, <orientation>".
// The flip animation never blocks: reduced-motion users see instant reveals.

export type ReadingPanelData = {
  readingId: string;
  spreadId: string;
  cards: DrawnCard[];
};

export function TarotSpread({
  reading,
  startRevealed = false,
  revealOrder,
  onClarify,
  clarifyingCardId,
  onRevealComplete,
}: {
  reading: ReadingPanelData;
  startRevealed?: boolean;
  revealOrder?: number[];
  onClarify?: (readingId: string, cardId: string) => void;
  clarifyingCardId?: string | null;
  onRevealComplete?: () => void;
}) {
  const spread = getSpread(reading.spreadId);
  const order = useMemo(() => revealOrder ?? reading.cards.map((_, i) => i), [revealOrder, reading.cards]);
  const [revealed, setRevealed] = useState<Set<number>>(() => (startRevealed ? new Set(order) : new Set()));
  const [detailCard, setDetailCard] = useState<DrawnCard | null>(null);
  const completedRef = useRef(startRevealed);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (startRevealed) {
      setRevealed(new Set(order));
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setRevealed(new Set(order));
      return;
    }
    order.forEach((cardIndex, seq) => {
      timers.current.push(
        setTimeout(() => {
          setRevealed((prev) => {
            const next = new Set(prev);
            next.add(cardIndex);
            return next;
          });
        }, 500 + seq * 550),
      );
    });
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [order, startRevealed]);

  useEffect(() => {
    if (!completedRef.current && revealed.size >= reading.cards.length && reading.cards.length > 0) {
      completedRef.current = true;
      onRevealComplete?.();
    }
  }, [revealed, reading.cards.length, onRevealComplete]);

  // Clarification cards (PRD §32) join after the reveal; they are shown
  // face-up by default — they exist to be seen, never as suspense.
  const allRevealed = reading.cards.every((card, i) => revealed.has(i) || card.clarifies !== undefined);
  const clarifyFor = (cardId: string) => reading.cards.find((c) => c.clarifies === cardId);

  return (
    <section className="mystical rounded-2xl p-4 sm:p-5" aria-label={`Tarot reading: ${spread?.title ?? reading.spreadId}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium tracking-wide uppercase opacity-90">{spread?.title ?? 'Reading'}</h3>
        {!allRevealed && (
          <button
            type="button"
            className="rounded-md border border-white/25 px-2.5 py-1 text-xs opacity-90 transition-colors hover:bg-white/10"
            onClick={() => setRevealed(new Set(order))}
          >
            Reveal all
          </button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 sm:gap-5">
        {reading.cards.map((card, index) => {
          const isRevealed = revealed.has(index) || card.clarifies !== undefined;
          const clarifier = clarifyFor(card.cardId);
          return (
            <div key={`${card.cardId}-${card.drawOrder}`} className="flex w-24 shrink-0 flex-col sm:w-28">
              <button
                type="button"
                className="group relative aspect-[2/3.4] [perspective:900px]"
                onClick={() => setDetailCard(card)}
                aria-label={isRevealed ? `${card.name}, ${card.orientation}` : `Face-down card ${index + 1}`}
              >
                <div
                  className={`relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none ${
                    isRevealed ? '[transform:rotateY(180deg)]' : ''
                  }`}
                >
                  <div className="mystical-card-back absolute inset-0 rounded-xl border border-white/20 shadow-lg [backface-visibility:hidden]" />
                  <div className="absolute inset-0 overflow-hidden rounded-xl border border-black/10 bg-card shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/cards/rws/${card.cardId}.jpg`}
                      alt={`${card.name}, ${card.orientation}`}
                      draggable={false}
                      className={`h-full w-full object-cover ${card.orientation === 'reversed' ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
              </button>

              <p className="mt-1.5 text-[11px] leading-tight font-medium opacity-90">{card.position}</p>
              {isRevealed && (
                <>
                  <p className="text-[11px] leading-tight opacity-75">{card.name}</p>
                  {card.orientation === 'reversed' && (
                    <span className="mt-0.5 w-fit rounded border border-white/30 px-1 py-px text-[9px] tracking-wide uppercase opacity-80">
                      Reversed
                    </span>
                  )}
                </>
              )}

              {clarifier && (
                <p className="mt-1 text-[10px] leading-tight opacity-75" title="Clarified by">
                  ↷ Clarified by {clarifier.name}
                </p>
              )}

              {isRevealed && onClarify && !card.clarifies && (
                <button
                  type="button"
                  disabled={clarifyingCardId === card.cardId}
                  className="mt-1 min-h-6 w-fit rounded-md border border-white/25 px-2 py-1 text-[10px] opacity-85 transition-colors hover:bg-white/10 disabled:opacity-50"
                  onClick={() => onClarify(reading.readingId, card.cardId)}
                >
                  {clarifyingCardId === card.cardId ? 'Clarifying…' : 'Clarify'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <CardDetailDialog card={detailCard} onClose={() => setDetailCard(null)} />
    </section>
  );
}

export function DrawFailedCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm">We couldn&apos;t draw the cards right now.</p>
      <button
        type="button"
        className="w-fit rounded-md bg-secondary px-2.5 py-1 text-xs transition-colors hover:bg-secondary/70"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}
