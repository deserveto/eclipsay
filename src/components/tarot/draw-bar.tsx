'use client';

import { useEffect, useRef, useState } from 'react';
import type { DrawnCard } from '@/lib/tarot/types';

// Docked draw bar (plan: conversational tarot flow). Card identities and
// orientations were already fixed by the engine seed when the reading was
// drawn server-side (PRD §25–§26) — clicking backs here only sequences the
// reveal, one card per click, then the bar collapses into the reading.

const FLIP_MS = 700;
const EXIT_MS = 250;

export function DrawBar({
  cards,
  onComplete,
  onCancel,
}: {
  cards: DrawnCard[];
  onComplete: (revealOrder: number[]) => void;
  onCancel: () => void;
}) {
  const total = cards.length;
  const fanSize = total + 4;
  const [revealedCount, setRevealedCount] = useState(0);
  const [flipping, setFlipping] = useState<{ fanIndex: number; cardIndex: number } | null>(null);
  const [used, setUsed] = useState<Set<number>>(new Set());
  const [fading, setFading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timers = timersRef.current;
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      timers.forEach(clearTimeout);
    };
  }, []);

  // Quota reached: fade the remaining backs, collapse the bar, hand back the
  // reveal order. Reduced motion skips straight to completion.
  useEffect(() => {
    if (revealedCount < total || doneRef.current) return;
    if (reduceMotion) {
      doneRef.current = true;
      onCompleteRef.current(cards.map((_, i) => i));
      return;
    }
    const push = (fn: () => void, delay: number) => timersRef.current.push(setTimeout(fn, delay));
    push(() => setFading(true), 150);
    push(() => setClosing(true), 150 + EXIT_MS);
    push(() => {
      doneRef.current = true;
      onCompleteRef.current(cards.map((_, i) => i));
    }, 150 + EXIT_MS + EXIT_MS);
  }, [revealedCount, total, cards, reduceMotion]);

  const drawBack = (fanIndex: number) => {
    if (closing || flipping !== null || revealedCount >= total || used.has(fanIndex)) return;
    const flip: { fanIndex: number; cardIndex: number } = { fanIndex, cardIndex: revealedCount };
    setFlipping(flip);
    const settle = reduceMotion ? 0 : FLIP_MS + EXIT_MS;
    timersRef.current.push(
      setTimeout(() => {
        setUsed((prev) => new Set(prev).add(fanIndex));
        setRevealedCount((c) => c + 1);
        setFlipping((current) => (current?.fanIndex === fanIndex ? null : current));
      }, settle),
    );
  };

  const flipCard = flipping ? cards[flipping.cardIndex] : null;

  return (
    <section
      aria-label="Draw your reading"
      className={`mystical rounded-2xl p-4 shadow-lg transition-all duration-[250ms] ease-out motion-reduce:transition-none ${
        closing ? 'translate-y-6 opacity-0' : 'translate-y-0 opacity-100'
      } animate-[eclipsay-rise-in_250ms_ease-out] motion-reduce:animate-none`}
    >
      {/* Region 1 — spread positions: every slot visible up front; the next
          slot is highlighted; revealed slots carry the server-fixed card. */}
      <div aria-label="Reading positions" className="rounded-xl border border-white/15 bg-white/5 p-3">
        <h3 className="text-xs font-medium uppercase tracking-widest opacity-75">Reading positions</h3>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {cards.map((card, i) => {
            const isNext = i === revealedCount && revealedCount < total;
            const revealed = i < revealedCount;
            return (
              <div key={card.drawOrder} className="flex w-14 shrink-0 flex-col">
                <div
                  className={`relative h-24 w-14 overflow-hidden rounded-lg shadow-lg ${
                    isNext
                      ? 'border border-white/60 [box-shadow:0_0_0_1px_oklch(0.62_0.07_285/0.5),0_0_20px_oklch(0.5_0.08_285/0.35)]'
                      : 'border border-white/20'
                  }`}
                >
                  {revealed ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`/cards/rws/${card.cardId}.jpg`}
                      alt={`${card.name}, ${card.orientation}`}
                      draggable={false}
                      className={`h-full w-full animate-[eclipsay-rise-in_250ms_ease-out] object-cover motion-reduce:animate-none ${
                        card.orientation === 'reversed' ? 'rotate-180' : ''
                      }`}
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-sm opacity-40">{i + 1}</span>
                  )}
                </div>
                <p className="mt-1 truncate text-[9px] uppercase tracking-wide opacity-75" title={card.position}>
                  {card.position}
                </p>
                {revealed && (
                  <p className="truncate text-[10px] opacity-90" title={card.name}>
                    {card.name}
                  </p>
                )}
                {revealed && card.orientation === 'reversed' && (
                  <span className="mt-0.5 w-fit rounded border border-white/30 px-1 py-px text-[9px] uppercase opacity-80">
                    Reversed
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Region 2 — face-down deck: picking a back only sequences the reveal;
          identities stay server-fixed and fill the next position. */}
      <div aria-label="Choose from the deck" className="mt-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium uppercase tracking-widest opacity-75">Choose from the deck</h3>
          <div className="flex items-center gap-3">
            <p className="text-[11px] opacity-75" aria-live="polite">
              {revealedCount}/{total} selected
            </p>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-white/70 underline underline-offset-4 hover:text-white"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
        <p className="mt-0.5 text-[11px] opacity-75">Tap any face-down card. Each choice fills the next position.</p>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: fanSize }, (_, i) => {
            const isUsed = used.has(i);
            const isFlipping = flipping?.fanIndex === i;
            const face = isFlipping ? flipCard : null;
            return (
              <button
                key={i}
                type="button"
                disabled={isUsed || revealedCount >= total || (flipping !== null && !isFlipping) || closing}
                aria-pressed={isUsed}
                aria-label={isUsed ? `Card ${i + 1} drawn` : `Draw card ${Math.min(revealedCount + 1, total)} of ${total}`}
                className={`relative h-24 w-14 shrink-0 rounded-lg transition-all duration-200 ease-out [perspective:900px] motion-reduce:transition-none ${
                  isUsed || (fading && !isFlipping) ? 'opacity-0' : 'opacity-100'
                } ${
                  isFlipping
                    ? 'scale-95 [box-shadow:0_0_0_1px_oklch(0.62_0.07_285/0.5),0_0_28px_oklch(0.5_0.08_285/0.4)]'
                    : 'hover:border-white/60 hover:[box-shadow:0_0_0_1px_oklch(0.62_0.07_285/0.35),0_0_24px_oklch(0.5_0.08_285/0.25)]'
                }`}
                onClick={() => drawBack(i)}
              >
                <span
                  className={`absolute inset-0 rounded-lg border border-white/25 shadow-lg transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:duration-[0ms] ${
                    isFlipping ? '[transform:rotateY(180deg)]' : ''
                  }`}
                >
                  <span className="absolute inset-0 overflow-hidden rounded-lg border border-black/10 bg-card [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    {face && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/cards/rws/${face.cardId}.jpg`}
                        alt={`${face.name}, ${face.orientation}`}
                        draggable={false}
                        className={`h-full w-full object-cover ${face.orientation === 'reversed' ? 'rotate-180' : ''}`}
                      />
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[10px] opacity-60">Illustrations: Pamela Colman Smith (1909), public domain.</p>
    </section>
  );
}
