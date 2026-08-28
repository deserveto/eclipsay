'use client';

import { useState } from 'react';
import type { ToolUIPart } from 'ai';
import { SPREADS } from '@/lib/tarot/spreads';
import type { ChatMessage } from '@/lib/chat/convert';
import type { SpreadOption } from '@/lib/types';
import { DrawFailedCard } from '@/components/tarot/tarot-spread';

// Typed renderers for streamed tool parts (plan: Phase 2.7 / Phase 3).
// The reading panel itself renders from the session readings store, keyed by
// readingId — these parts only carry interaction affordances.

const SPREAD_CHOICES: SpreadOption[] = SPREADS.map((s) => ({
  spreadId: s.id,
  title: s.title,
  positions: s.positions,
}));

function SpreadSuggestionCard({
  part,
  onPickSpread,
  onDeclineSpread,
  declined,
}: {
  part: ToolUIPart;
  onPickSpread: (spreadId: string, mode: 'quick' | 'interactive') => void;
  onDeclineSpread: () => void;
  declined: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  if (part.state !== 'output-available' || declined) return null;
  const output = part.output as { options?: SpreadOption[] } | undefined;
  const options = output?.options ?? [];
  if (options.length === 0) return null;

  const extras = SPREAD_CHOICES.filter((s) => !options.some((o) => o.spreadId === s.spreadId));
  const listed = showAll ? [...options, ...extras] : options;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm">Shall we explore this with a few cards?</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {listed.map((option) => (
          <div key={option.spreadId} className="flex flex-col items-start gap-1">
            <button
              type="button"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-opacity hover:opacity-90"
              onClick={() => onPickSpread(option.spreadId, 'quick')}
            >
              Reflect with cards{listed.length > 1 ? ` — ${option.title}` : ''}
            </button>
            {showAll && <span className="text-[11px] text-muted-foreground">{option.positions.join(' · ')}</span>}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Hide other spreads' : 'Choose another spread'}
        </button>
        <button
          type="button"
          className="underline underline-offset-4 hover:text-foreground"
          onClick={() => onPickSpread(options[0].spreadId, 'interactive')}
        >
          Draw them myself
        </button>
        <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={onDeclineSpread}>
          Keep talking
        </button>
      </div>
    </div>
  );
}

function DrawResultPart({ part, onRetryDraw }: { part: ToolUIPart; onRetryDraw: () => void }) {
  if (part.state !== 'output-available') {
    return <p className="text-sm text-muted-foreground">Shuffling the deck…</p>;
  }
  const output = part.output as { error?: string } | undefined;
  if (output?.error) {
    return <DrawFailedCard onRetry={onRetryDraw} />;
  }
  return null; // Panel renders from the readings store, keyed by readingId.
}

function ClarifyResultPart({ part }: { part: ToolUIPart }) {
  if (part.state !== 'output-available') {
    return <p className="text-sm text-muted-foreground">Drawing a clarification card…</p>;
  }
  const output = part.output as
    | { error?: string; clarifier?: { name: string; orientation: string }; cardId?: string }
    | undefined;
  if (output?.error) return <DrawFailedCard onRetry={() => {}} />;
  if (!output?.clarifier) return null;
  return (
    <p className="text-xs text-muted-foreground">
      ↷ {output.clarifier.name} ({output.clarifier.orientation}) was drawn to clarify this card.
    </p>
  );
}

export function ToolPartRenderer({
  message,
  declined,
  onPickSpread,
  onDeclineSpread,
  onRetryDraw,
}: {
  message: ChatMessage;
  declined: boolean;
  onPickSpread: (spreadId: string, mode: 'quick' | 'interactive') => void;
  onDeclineSpread: () => void;
  onRetryDraw: () => void;
}) {
  return (
    <>
      {message.parts
        .filter((part): part is ToolUIPart => part.type.startsWith('tool-'))
        .map((part) => {
          switch (part.type) {
            case 'tool-suggest_spread':
              return (
                <SpreadSuggestionCard
                  key={part.toolCallId}
                  part={part}
                  declined={declined}
                  onPickSpread={onPickSpread}
                  onDeclineSpread={onDeclineSpread}
                />
              );
            case 'tool-draw_tarot_cards':
              return <DrawResultPart key={part.toolCallId} part={part} onRetryDraw={onRetryDraw} />;
            case 'tool-request_clarification':
              return <ClarifyResultPart key={part.toolCallId} part={part} />;
            default:
              return (
                <div
                  key={part.toolCallId}
                  className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
                >
                  Preparing something…
                </div>
              );
          }
        })}
    </>
  );
}
