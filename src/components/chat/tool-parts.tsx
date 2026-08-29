'use client';

import type { ToolUIPart } from 'ai';
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

function RecommendationCard({
  part,
  declined,
  acted,
  onBeginReading,
  onDecline,
  markActed,
}: {
  part: ToolUIPart;
  declined: boolean;
  acted: boolean;
  onBeginReading: (spreadId: string) => void;
  onDecline: () => void;
  markActed: (toolCallId: string) => void;
}) {
  if (part.state !== 'output-available' || declined) return null;
  const output = part.output as
    | {
        error?: string;
        context?: string;
        recommendedSpreadId?: string;
        title?: string;
        positions?: string[];
        cardCount?: number;
        alternatives?: { spreadId: string; title: string; cardCount: number }[];
      }
    | undefined;
  if (!output?.recommendedSpreadId || !output.title || output.error) return null;
  const begin = (spreadId: string) => {
    markActed(part.toolCallId);
    onBeginReading(spreadId);
  };
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">Reading suggestion</p>
      <p className="mt-1 text-sm leading-6">{output.context}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        A {output.cardCount}-card {output.title} — {output.positions?.join(' · ')}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={acted}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_8%)] disabled:opacity-60"
          onClick={() => begin(output.recommendedSpreadId!)}
        >
          {acted ? 'Reading started' : 'Begin reading'}
        </button>
        {!acted &&
          (output.alternatives ?? []).map((alt) => (
            <button
              key={alt.spreadId}
              type="button"
              className="rounded-full bg-secondary px-3 py-1.5 text-xs transition-opacity hover:opacity-90"
              onClick={() => begin(alt.spreadId)}
            >
              {alt.cardCount} {alt.cardCount === 1 ? 'card' : 'cards'} — {alt.title}
            </button>
          ))}
        {!acted && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={onDecline}
          >
            Not now
          </button>
        )}
      </div>
    </div>
  );
}

function AskUserCard({
  part,
  acted,
  onAnswer,
  markActed,
}: {
  part: ToolUIPart;
  acted: boolean;
  onAnswer: (text: string) => void;
  markActed: (toolCallId: string) => void;
}) {
  if (part.state !== 'output-available') {
    return <p className="text-sm text-muted-foreground">Thinking it through…</p>;
  }
  const output = part.output as { question?: string; options?: string[] } | undefined;
  if (!output?.question) return null;
  const answer = (text: string) => {
    markActed(part.toolCallId);
    onAnswer(text);
  };
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[15px] leading-7">{output.question}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {(output.options ?? []).map((option) => (
          <button
            key={option}
            type="button"
            disabled={acted}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/10 disabled:opacity-50"
            onClick={() => answer(option)}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          disabled={acted}
          className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
          onClick={() => answer("I'd rather not say")}
        >
          I&apos;d rather not say
        </button>
      </div>
    </div>
  );
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
              <span className="truncate text-sm text-muted-foreground" title={hit.title}>
                {hit.title}
              </span>
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
  onBeginReading,
  onDecline,
  onAnswerClarify,
  confirm,
}: {
  message: ChatMessage;
  declined: boolean;
  onBeginReading: (spreadId: string) => void;
  onDecline: () => void;
  onAnswerClarify: (text: string) => void;
  confirm: ConfirmHandlers;
}) {
  return (
    <>
      {message.parts
        .filter((part): part is ToolUIPart => part.type.startsWith('tool-'))
        .map((part) => {
          switch (part.type) {
            case 'tool-ask_user':
              return (
                <AskUserCard
                  key={part.toolCallId}
                  part={part}
                  acted={confirm.actedIds.has(part.toolCallId)}
                  onAnswer={onAnswerClarify}
                  markActed={confirm.markActed}
                />
              );
            case 'tool-recommend_reading':
              return (
                <RecommendationCard
                  key={part.toolCallId}
                  part={part}
                  declined={declined}
                  acted={confirm.actedIds.has(part.toolCallId)}
                  onBeginReading={onBeginReading}
                  onDecline={onDecline}
                  markActed={confirm.markActed}
                />
              );
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
