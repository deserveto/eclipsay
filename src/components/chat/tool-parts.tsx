'use client';

import { useState } from 'react';
import type { ToolUIPart } from 'ai';
import { SPREADS } from '@/lib/tarot/spreads';
import type { SpreadOption } from '@/lib/types';
import type { ChatMessage } from '@/lib/chat/convert';
import { DrawFailedCard } from '@/components/tarot/tarot-spread';
export type SearchHit = { entryId: string; title: string; createdAt?: string };

type ConfirmHandlers = {
  onSaveInsight: (text: string) => void;
  onRememberThis: (content: string, category: string) => void;
  onBringItIn: (hit: SearchHit) => void;
  markActed: (toolCallId: string) => void;
  actedIds: Set<string>;
  approvedEntryIds: Set<string>;
};
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
function InsightConfirmCard({
  part,
  onSaveInsight,
  markActed,
  actedIds,
}: {
  part: ToolUIPart;
  onSaveInsight: (text: string) => void;
  markActed: (toolCallId: string) => void;
  actedIds: Set<string>;
}) {
  if (part.state !== 'output-available') return null;
  const output = part.output as { insightId?: string; text?: string } | undefined;
  if (!output?.insightId || !output.text) return null;
  const acted = actedIds.has(part.toolCallId);
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">Insight</p>
      <p className="mt-1 text-sm leading-6">&ldquo;{output.text}&rdquo;</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={acted}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          onClick={() => {
            markActed(part.toolCallId);
            onSaveInsight(output.text!);
          }}
        >
          {acted ? 'Saved' : 'Save insight'}
        </button>
      </div>
    </div>
  );
}

function MemoryConfirmCard({
  part,
  onRememberThis,
  markActed,
  actedIds,
}: {
  part: ToolUIPart;
  onRememberThis: (content: string, category: string) => void;
  markActed: (toolCallId: string) => void;
  actedIds: Set<string>;
}) {
  if (part.state !== 'output-available') return null;
  const output = part.output as { memoryId?: string; content?: string; category?: string } | undefined;
  if (!output?.memoryId || !output.content) return null;
  const acted = actedIds.has(part.toolCallId);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Remember this?</p>
      <p className="mt-1 text-sm leading-6">{output.content}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={acted}
          className="rounded-lg bg-secondary px-3 py-1.5 text-xs transition-opacity hover:opacity-90 disabled:opacity-60"
          onClick={() => {
            markActed(part.toolCallId);
            onRememberThis(output.content!, output.category ?? 'context');
          }}
        >
          {acted ? 'Remembered' : 'Remember this'}
        </button>
      </div>
    </div>
  );
}

function SearchJournalCard({
  part,
  onBringItIn,
  approvedEntryIds,
}: {
  part: ToolUIPart;
  onBringItIn: (hit: SearchHit) => void;
  approvedEntryIds: Set<string>;
}) {
  if (part.state !== 'output-available') return null;
  const output = part.output as { results?: SearchHit[] } | undefined;
  const results = output?.results ?? [];
  if (results.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm">
        There&apos;s an older reflection that seems related to what you&apos;re describing. Want to bring it into this
        conversation?
      </p>
      <div className="mt-2 space-y-1.5">
        {results.map((hit) => {
          const brought = approvedEntryIds.has(hit.entryId);
          return (
            <div key={hit.entryId} className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-muted-foreground">{hit.title}</span>
              {brought ? (
                <span className="text-xs text-primary">Brought in</span>
              ) : (
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-xs transition-opacity hover:opacity-90"
                  onClick={() => onBringItIn(hit)}
                >
                  Bring it in
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


export function ToolPartRenderer({
  message,
  declined,
  onPickSpread,
  onDeclineSpread,
  onRetryDraw,
  confirm,
}: {
  message: ChatMessage;
  declined: boolean;
  onPickSpread: (spreadId: string, mode: 'quick' | 'interactive') => void;
  onDeclineSpread: () => void;
  onRetryDraw: () => void;
  confirm: ConfirmHandlers;
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
            case 'tool-propose_insight':
              return <InsightConfirmCard key={part.toolCallId} part={part} onSaveInsight={confirm.onSaveInsight} markActed={confirm.markActed} actedIds={confirm.actedIds} />;
            case 'tool-propose_memory':
              return <MemoryConfirmCard key={part.toolCallId} part={part} onRememberThis={confirm.onRememberThis} markActed={confirm.markActed} actedIds={confirm.actedIds} />;
            case 'tool-search_journal':
              return <SearchJournalCard key={part.toolCallId} part={part} onBringItIn={confirm.onBringItIn} approvedEntryIds={confirm.approvedEntryIds} />;
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
