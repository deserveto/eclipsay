'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getCard } from '@/lib/tarot/cards';
import type { DrawnCard } from '@/lib/tarot/types';

const ARCANA_LABEL: Record<string, string> = {
  major: 'Major Arcana',
  wands: 'Wands',
  cups: 'Cups',
  swords: 'Swords',
  pentacles: 'Pentacles',
};

// Card detail (PRD §49, §65): all content from the static dataset.
export function CardDetailDialog({ card, onClose }: { card: DrawnCard | null; onClose: () => void }) {
  const info = card ? getCard(card.cardId) : null;
  return (
    <Dialog open={Boolean(card)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {card && info && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-xl">
                {card.name}
                <Badge variant="secondary">{ARCANA_LABEL[info.arcana] ?? info.arcana}</Badge>
                <Badge variant={card.orientation === 'reversed' ? 'outline' : 'secondary'}>{card.orientation}</Badge>
                {card.position && <span className="text-xs font-normal text-muted-foreground">· {card.position}</span>}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/cards/rws/${card.cardId}.jpg`}
                alt={`${card.name}, ${card.orientation}`}
                className={`h-56 w-36 shrink-0 rounded-lg border object-cover ${card.orientation === 'reversed' ? 'rotate-180' : ''}`}
              />
              <div className="min-w-0 flex-1 space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Upright keywords
                  </p>
                  <p>{info.keywordsUpright.join(', ')}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Reversed keywords
                  </p>
                  <p>{info.keywordsReversed.join(', ')}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Traditional meaning
                  </p>
                  <p className="leading-6">{info.traditional}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Reflection</p>
                <p className="leading-6">{info.reflection}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Relationships</p>
                  <p className="leading-6">{info.themes.relationships}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Career</p>
                  <p className="leading-6">{info.themes.career}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Growth</p>
                  <p className="leading-6">{info.themes.growth}</p>
                </div>
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground">
                Illustration: Pamela Colman Smith (1909), public domain.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
