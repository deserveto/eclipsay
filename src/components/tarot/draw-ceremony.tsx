'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

// Interactive Draw ceremony (PRD §28): Focus → Shuffle → Cut → Choose → Reveal.
// NOTE: card identities were already fixed by the engine seed when the draw
// initiated (server-side, plan §25/§26 guarantees). Selections here only
// control the reveal order — nothing about the draw depends on these choices.

export function DrawCeremony({
  count,
  onComplete,
  onCancel,
}: {
  count: number;
  onComplete: (order: number[]) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<'focus' | 'shuffle' | 'cut' | 'choose'>('focus');
  const [chosen, setChosen] = useState<number[]>([]);
  const fanSize = count + 8;

  useEffect(() => {
    if (phase !== 'shuffle') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setPhase('cut'), reduceMotion ? 150 : 1600);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase === 'choose' && chosen.length >= count) {
      const t = setTimeout(() => onComplete(chosen), 450);
      return () => clearTimeout(t);
    }
  }, [phase, chosen, count, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Interactive card draw">
      <div className="mystical w-full max-w-lg rounded-2xl p-6 text-center shadow-2xl">
        {phase === 'focus' && (
          <>
            <h2 className="text-lg font-medium">Take a breath.</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm opacity-80">
              Hold your question in mind. There is no rush — the cards are only a lens.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button size="sm" onClick={() => setPhase('shuffle')}>
                Shuffle the deck
              </Button>
              <Button size="sm" variant="ghost" className="text-white/80 hover:bg-white/10" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {phase === 'shuffle' && (
          <>
            <h2 className="text-lg font-medium">Shuffling…</h2>
            <div className="relative mx-auto mt-6 h-28 w-20" aria-hidden>
              <div className="mystical-card-back absolute inset-0 rounded-xl border border-white/25 motion-safe:animate-pulse" />
              <div className="mystical-card-back absolute inset-0 rotate-6 rounded-xl border border-white/25 motion-safe:animate-pulse" />
              <div className="mystical-card-back absolute inset-0 -rotate-6 rounded-xl border border-white/25 motion-safe:animate-pulse" />
            </div>
          </>
        )}

        {phase === 'cut' && (
          <>
            <h2 className="text-lg font-medium">Cut the deck.</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm opacity-80">Pick a point in the deck that feels right.</p>
            <div className="mt-6 flex gap-1.5 overflow-x-auto pb-2">
              {Array.from({ length: fanSize }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className="mystical-card-back h-24 w-14 shrink-0 rounded-lg border border-white/25 transition-transform hover:-translate-y-1.5"
                  aria-label={`Cut position ${i + 1}`}
                  onClick={() => setPhase('choose')}
                />
              ))}
            </div>
          </>
        )}

        {phase === 'choose' && (
          <>
            <h2 className="text-lg font-medium">
              Choose {count} card{count > 1 ? 's' : ''}.
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-sm opacity-80">
              {chosen.length} of {count} chosen
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {Array.from({ length: fanSize }, (_, i) => {
                const isChosen = chosen.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!isChosen && chosen.length >= count}
                    className={`mystical-card-back h-24 w-14 rounded-lg border transition-transform ${
                      isChosen ? 'mystical-ring -translate-y-2 border-white/60' : 'border-white/25 hover:-translate-y-1'
                    } disabled:opacity-40`}
                    aria-label={`Card ${i + 1}${isChosen ? ' (chosen)' : ''}`}
                    aria-pressed={isChosen}
                    onClick={() => setChosen((prev) => (prev.includes(i) ? prev : [...prev, i]))}
                  />
                );
              })}
            </div>
            <button
              type="button"
              className="mt-6 text-xs text-white/70 underline underline-offset-4 hover:text-white"
              onClick={onCancel}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
