'use client';

import { useState } from 'react';
import type { ToolUIPart } from 'ai';
import type { ChatMessage } from '@/lib/chat/convert';
import { DrawFailedCard } from '@/components/tarot/tarot-spread';
import { DECLINE_CHOICE, isQuestionBatch, type ClarificationQuestion } from '@/components/chat/composer-clarification';
export type SearchHit = { entryId: string; title: string; createdAt?: string };

type ConfirmHandlers = {
  actedIds: Set<string>;
  markActed: (toolCallId: string) => void;
  approvedEntryIds: Set<string>;
  onSaveInsight: (text: string) => Promise<boolean>;
  onRememberThis: (content: string, category: string) => Promise<boolean>;
  onBringItIn: (hit: SearchHit) => void;
  onScheduleFollowUp: (dueAt: string) => Promise<boolean>;
  onClarifyRequest: (readingId: string, cardId: string) => Promise<boolean>;
};

// Typed renderers for streamed tool parts (plan: Phase 2.7 / Phase 3).
// Assistant prose always renders first (chat-screen); these action surfaces
// follow it. The reading panel itself renders from the session readings
// store, keyed by readingId — these parts only carry interaction affordances.

function RecommendationCard({
  part,
  declined,
  acted,
  stale,
  tarotUnavailable,
  onBeginReading,
  onDecline,
  markActed,
}: {
  part: ToolUIPart;
  declined: boolean;
  acted: boolean;
  stale: boolean;
  tarotUnavailable: boolean;
  onBeginReading: (spreadId: string) => void;
  onDecline: (toolCallId: string) => void;
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
  const positions = output.positions ?? [];
  const alternatives = output.alternatives ?? [];
  const begin = (spreadId: string) => {
    markActed(part.toolCallId);
    onBeginReading(spreadId);
  };
  return (
    <div className="mystical rounded-2xl p-4 shadow-lg">
      <p className="text-[11px] font-medium uppercase tracking-widest opacity-75">Reading suggestion</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-medium">{output.title}</h3>
        <span className="rounded-full border border-white/25 px-2 py-0.5 text-[11px] opacity-90">
          {output.cardCount} {output.cardCount === 1 ? 'card' : 'cards'}
        </span>
      </div>
      {output.context && <p className="mt-1.5 text-sm leading-6 opacity-90">{output.context}</p>}
      {positions.length > 0 && (
        <ol className="mt-3 rounded-xl border border-white/15 bg-white/5 px-3.5 py-1.5">
          {positions.map((position, i) => (
            <li key={`${i}.${position}`} className="flex gap-2.5 py-1 text-sm leading-6">
              <span className="w-4 shrink-0 text-right text-xs tabular-nums opacity-60">{i + 1}</span>
              <span className="opacity-90">{position}</span>
            </li>
          ))}
        </ol>
      )}
      {tarotUnavailable ? (
        <p className="mt-3 text-xs opacity-75">Cards are unavailable for this reflection.</p>
      ) : stale && !acted ? (
        <p className="mt-3 text-xs opacity-75">Set aside — just ask if you&rsquo;d like this reading.</p>
      ) : (
        <div className="mt-3.5">
          <button
            type="button"
            disabled={acted}
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_8%)] disabled:opacity-60"
            onClick={() => begin(output.recommendedSpreadId!)}
          >
            {acted ? 'Reading started' : 'Begin reading'}
          </button>
          {!acted && alternatives.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="text-xs opacity-75">Prefer a different depth?</span>
              {alternatives.map((alt) => (
                <button
                  key={alt.spreadId}
                  type="button"
                  className="rounded-full border border-white/25 px-3 py-1 text-xs opacity-90 transition-colors hover:bg-white/10"
                  onClick={() => begin(alt.spreadId)}
                >
                  {alt.cardCount} {alt.cardCount === 1 ? 'card' : 'cards'} — {alt.title}
                </button>
              ))}
            </div>
          )}
          {!acted && (
            <button
              type="button"
              className="mt-2.5 block text-xs text-white/70 underline underline-offset-4 hover:text-white"
              onClick={() => onDecline(part.toolCallId)}
            >
              Not now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Non-docked ask_user parts render as settled history: a compact,
// noninteractive record of what was asked. The live batch docks above the
// composer instead (chat-screen), so its part renders nothing here.
function AskUserHistory({
  part,
  acted,
  stale,
}: {
  part: ToolUIPart;
  acted: boolean;
  stale: boolean;
}) {
  if (part.state !== 'output-available') return null;
  if (!isQuestionBatch(part.output)) return null; // pre-cutover payloads stay retired
  const questions: ClarificationQuestion[] = part.output.questions;
  const status = acted ? 'Answered' : stale ? 'Continued in chat' : null;
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
      {questions.map((q) => (
        <p key={q.question} className="text-xs leading-5 text-muted-foreground">
          <span className="font-medium text-foreground/70">{q.question}</span>
          <span className="mx-1.5">—</span>
          {[...q.options, DECLINE_CHOICE].join(' · ')}
        </p>
      ))}
      {status && <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{status}</p>}
    </div>
  );
}

function ClarifyResultPart({
  part,
  acted,
  stale,
  onClarifyRequest,
  markActed,
}: {
  part: ToolUIPart;
  acted: boolean;
  stale: boolean;
  onClarifyRequest: (readingId: string, cardId: string) => Promise<boolean>;
  markActed: (toolCallId: string) => void;
}) {
  if (part.state !== 'output-available') {
    return <p className="text-sm text-muted-foreground">Suggesting a clarification card…</p>;
  }
  const output = part.output as
    | { error?: string; readingId?: string; clarifier?: { name: string; orientation: string }; cardId?: string; requested?: boolean }
    | undefined;
  if (output?.error) {
    if (typeof output.readingId !== 'string' || typeof output.cardId !== 'string') {
      return <DrawFailedCard />;
    }
    return <DrawFailedCard onRetry={() => void onClarifyRequest(output.readingId!, output.cardId!)} />;
  }
  // Legacy hydrated parts carried the drawn card directly (pre-A34); keep
  // rendering them as settled history.
  if (output?.clarifier) {
    return (
      <p className="text-xs text-muted-foreground">
        ↷ {output.clarifier.name} ({output.clarifier.orientation}) was drawn to clarify this card.
      </p>
    );
  }
  if (acted) {
    return <p className="text-xs text-muted-foreground">↷ Clarification card added to the reading.</p>;
  }
  if (stale || !output?.requested || typeof output?.readingId !== 'string' || typeof output?.cardId !== 'string') {
    return null;
  }
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm">
        One more card could clarify <span className="font-medium">{output.cardId.replace(/_/g, ' ')}</span>.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded-lg bg-secondary px-3 py-1.5 text-xs transition-opacity hover:opacity-90 disabled:opacity-60"
          onClick={() => {
            void onClarifyRequest(output.readingId!, output.cardId!).then((drawn) => {
              if (drawn) markActed(part.toolCallId);
            });
          }}
        >
          Draw clarification card
        </button>
      </div>
    </div>
  );
}

function InsightConfirmCard({
  part,
  onSaveInsight,
  markActed,
  actedIds,
}: {
  part: ToolUIPart;
  onSaveInsight: (text: string) => Promise<boolean>;
  markActed: (toolCallId: string) => void;
  actedIds: Set<string>;
}) {
  // Audit A30: the proposal resolves only after persistence SUCCEEDS — a
  // failed save keeps the card actionable for retry, never a false "Saved".
  const [pending, setPending] = useState(false);
  if (part.state !== 'output-available') return null;
  const output = part.output as { insightId?: string; text?: string } | undefined;
  if (!output?.insightId || !output.text) return null;
  const acted = actedIds.has(part.toolCallId);
  const disabled = acted || pending;
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">Insight</p>
      <p className="mt-1 text-sm leading-6">&ldquo;{output.text}&rdquo;</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          onClick={async () => {
            setPending(true);
            try {
              const saved = await onSaveInsight(output.text!);
              if (saved) markActed(part.toolCallId);
            } finally {
              setPending(false);
            }
          }}
        >
          {acted ? 'Saved' : pending ? 'Saving…' : 'Save insight'}
        </button>
      </div>
    </div>
  );
}

function FollowUpConfirmCard({
  part,
  onScheduleFollowUp,
  markActed,
  actedIds,
}: {
  part: ToolUIPart;
  onScheduleFollowUp: (dueAt: string) => Promise<boolean>;
  markActed: (toolCallId: string) => void;
  actedIds: Set<string>;
}) {
  // Audit A33: the model can propose a follow-up; this card is its only
  // confirmation path. The due date is validated before the write is offered.
  const [pending, setPending] = useState(false);
  if (part.state !== 'output-available') {
    return <p className="text-sm text-muted-foreground">Preparing a check-in suggestion…</p>;
  }
  const output = part.output as { followupId?: string; dueAt?: string; error?: string } | undefined;
  if (output?.error || !output?.dueAt || Number.isNaN(new Date(output.dueAt).getTime())) {
    return null;
  }
  const acted = actedIds.has(part.toolCallId);
  const due = new Date(output.dueAt);
  const dueLabel = due.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const disabled = acted || pending;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Check in later</p>
      <p className="mt-1 text-sm leading-6">
        I can nudge you to revisit this reflection around {dueLabel} — right here in the app. No email, no pressure.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          className="rounded-lg bg-secondary px-3 py-1.5 text-xs transition-opacity hover:opacity-90 disabled:opacity-60"
          onClick={async () => {
            setPending(true);
            try {
              const saved = await onScheduleFollowUp(output.dueAt!);
              if (saved) markActed(part.toolCallId);
            } finally {
              setPending(false);
            }
          }}
        >
          {acted ? 'Scheduled' : pending ? 'Scheduling…' : 'Schedule it'}
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
  onRememberThis: (content: string, category: string) => Promise<boolean>;
  markActed: (toolCallId: string) => void;
  actedIds: Set<string>;
}) {
  const [pending, setPending] = useState(false);
  if (part.state !== 'output-available') return null;
  const output = part.output as { memoryId?: string; content?: string; category?: string } | undefined;
  if (!output?.memoryId || !output.content) return null;
  const acted = actedIds.has(part.toolCallId);
  const disabled = acted || pending;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Remember this?</p>
      <p className="mt-1 text-sm leading-6">{output.content}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          className="rounded-lg bg-secondary px-3 py-1.5 text-xs transition-opacity hover:opacity-90 disabled:opacity-60"
          onClick={async () => {
            setPending(true);
            try {
              const saved = await onRememberThis(output.content!, output.category ?? 'context');
              if (saved) markActed(part.toolCallId);
            } catch {
              // Failed saves remain retryable and never resolve the proposal.
            } finally {
              setPending(false);
            }
          }}
        >
          {acted ? 'Remembered' : pending ? 'Saving…' : 'Remember this'}
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
  declinedToolCallIds,
  stale,
  tarotUnavailable,
  dockedToolCallId,

  onBeginReading,
  onDecline,
  confirm,
}: {
  message: ChatMessage;
  declinedToolCallIds: Set<string>;
  stale: boolean;
  tarotUnavailable?: boolean;
  /** The live ask_user batch renders docked above the composer; it renders nothing here. */
  dockedToolCallId?: string;
  onBeginReading: (spreadId: string) => void;
  onDecline: (messageId: string, toolCallId: string) => void;
  confirm: ConfirmHandlers;
}) {
  return (
    <>
      {message.parts
        .filter((part): part is ToolUIPart => part.type.startsWith('tool-'))
        .map((part) => {
          switch (part.type) {
            case 'tool-ask_user':
              if (part.toolCallId === dockedToolCallId) return null;
              return (
                <AskUserHistory
                  key={part.toolCallId}
                  part={part}
                  acted={confirm.actedIds.has(part.toolCallId)}
                  stale={stale}
                />
              );
            case 'tool-recommend_reading':
              return (
                <RecommendationCard
                  key={part.toolCallId}
                  part={part}
                  declined={declinedToolCallIds.has(part.toolCallId)}
                  acted={confirm.actedIds.has(part.toolCallId)}
                  stale={stale}
                  tarotUnavailable={tarotUnavailable ?? false}
                  onBeginReading={onBeginReading}
                  onDecline={(toolCallId) => onDecline(message.id, toolCallId)}
                  markActed={confirm.markActed}
                />
              );
            case 'tool-request_clarification':
              return (
                <ClarifyResultPart
                  key={part.toolCallId}
                  part={part}
                  acted={confirm.actedIds.has(part.toolCallId)}
                  stale={stale}
                  onClarifyRequest={confirm.onClarifyRequest}
                  markActed={confirm.markActed}
                />
              );
            case 'tool-propose_insight':
              return <InsightConfirmCard key={part.toolCallId} part={part} onSaveInsight={confirm.onSaveInsight} markActed={confirm.markActed} actedIds={confirm.actedIds} />;
            case 'tool-propose_memory':
              return <MemoryConfirmCard key={part.toolCallId} part={part} onRememberThis={confirm.onRememberThis} markActed={confirm.markActed} actedIds={confirm.actedIds} />;
            case 'tool-search_journal':
              return <SearchJournalCard key={part.toolCallId} part={part} onBringItIn={confirm.onBringItIn} approvedEntryIds={confirm.approvedEntryIds} />;
            case 'tool-create_followup':
              return <FollowUpConfirmCard key={part.toolCallId} part={part} onScheduleFollowUp={confirm.onScheduleFollowUp} markActed={confirm.markActed} actedIds={confirm.actedIds} />;
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
