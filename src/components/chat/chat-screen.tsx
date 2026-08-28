'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isStaticToolUIPart } from 'ai';
import { ArrowUp, RefreshCw, PenLine, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Markdown } from '@/components/chat/markdown';
import { OnboardingDialogs } from '@/components/chat/onboarding-dialogs';
import { MigrationDialog } from '@/components/auth/migration-dialog';
import { SignInDialog } from '@/components/auth/sign-in-dialog';
import { toast } from 'sonner';
import { TarotSpread, DrawFailedCard } from '@/components/tarot/tarot-spread';
import { DrawCeremony } from '@/components/tarot/draw-ceremony';
import { ToolPartRenderer, type SearchHit } from '@/components/chat/tool-parts';
import { track } from '@/lib/analytics';
import { useDataMode } from '@/hooks/use-data-mode';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { getSpread, SPREADS } from '@/lib/tarot/spreads';
import { appendMessage, getGuestSession, saveFollowUp, saveInsight as saveGuestInsight, saveMemory, saveReading, saveSession } from '@/lib/guest/store';
import { joinUiText, storedToUi, type ChatMessage } from '@/lib/chat/convert';
import { makeEntry } from '@/lib/journal/entries';
import type { DrawnCard } from '@/lib/tarot/types';
import type { MemoryCategory, StoredMessage, TarotReading } from '@/lib/types';

function titleFrom(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length === 0 ? 'New Reflection' : compact.slice(0, 48);
}

type ReadingsState = Record<string, { spreadId: string; cards: DrawnCard[] }>;

export function ChatScreen({ initialSessionId }: { initialSessionId?: string }) {
  const { mode } = useDataMode();
  const searchParams = useSearchParams();
  const [input, setInput] = useState('');
  const lastSent = useRef('');

  // Stable per-screen session id; a deep link reuses the existing session.
  const sessionId = useMemo(() => initialSessionId ?? crypto.randomUUID(), [initialSessionId]);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', body: { sessionId } }),
    [sessionId],
  );

  // Readings hydrated at mount render revealed; live ones animate.
  const initialMessageIds = useRef<Set<string>>(new Set());
  const [readings, setReadings] = useState<ReadingsState>({});
  const [clarifyingCardId, setClarifyingCardId] = useState<string | null>(null);
  const [declinedToolCalls, setDeclinedToolCalls] = useState<Set<string>>(new Set());
  const [ceremony, setCeremony] = useState<{ cards: DrawnCard[]; readingId: string; spreadId: string } | null>(null);
  const [drawFailedSpread, setDrawFailedSpread] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [actedConfirms, setActedConfirms] = useState<Set<string>>(new Set());
  const [approvedContext, setApprovedContext] = useState<SearchHit[]>([]);

  const chat = useChat<ChatMessage>({
    id: sessionId,
    transport,
    onError: () => {},
    onFinish: (event) => {
      appendMessage(sessionId, {
        id: event.message.id,
        session_id: sessionId,
        user_id: '',
        role: 'assistant',
        content: joinUiText(event.message),
        meta: event.message.metadata ?? {},
        created_at: new Date().toISOString(),
      });
    },
  });

  // Hydrate transcript + readings on deep link (never re-generate, PRD §26).
  useEffect(() => {
    const hydrate = async () => {
      // Account mode: messages + readings come from Supabase (RLS-scoped, §34).
      if (mode === 'account' && isSupabaseConfigured()) {
        const supabase = createClient();
        const [msgs, reads] = await Promise.all([
          supabase.from('messages').select('*').eq('session_id', sessionId).order('created_at'),
          supabase.from('tarot_readings').select('*').eq('session_id', sessionId).order('created_at'),
        ]);
        const dbMessages = (msgs.data ?? []) as unknown as StoredMessage[];
        if (dbMessages.length > 0) {
          initialMessageIds.current = new Set(dbMessages.map((m) => m.id));
          chat.setMessages(dbMessages.map(storedToUi));
        }
        const dbReadings: ReadingsState = {};
        for (const r of (reads.data ?? []) as unknown as TarotReading[]) {
          dbReadings[r.id] = { spreadId: r.spread_id, cards: r.cards };
        }
        setReadings(dbReadings);
        return;
      }
      // Guest mode: everything lives in localStorage.
      const session = getGuestSession(sessionId);
      if (session) {
        initialMessageIds.current = new Set(session.messages.map((m) => m.id));
        if (session.messages.length > 0) {
          chat.setMessages(session.messages.map(storedToUi));
        }
        const stored: ReadingsState = {};
        for (const r of session.readings) stored[r.id] = { spreadId: r.spread_id, cards: r.cards };
        setReadings(stored);
      }
    };
    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, mode]);

  // Pre-fill composer from "Reflect with tarot" entry action.
  useEffect(() => {
    if (searchParams.get('tarot') === '1' && chat.messages.length === 0) {
      setInput("I'd like to explore something with a few cards.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [spreadPickerOpen, setSpreadPickerOpen] = useState(false);

  // Sync tool-produced readings (model-initiated draws/clarifications) into local state.
  useEffect(() => {
    for (const message of chat.messages) {
      for (const part of message.parts) {
        if (!isStaticToolUIPart(part) || part.state !== 'output-available') continue;
        const output = part.output as
          | {
              error?: string;
              readingId?: string;
              spreadId?: string;
              cards?: DrawnCard[];
              clarifier?: DrawnCard;
              cardId?: string;
            }
          | undefined;
        if (!output || output.error) continue;

        if (part.type === 'tool-draw_tarot_cards' && output.cards && output.readingId && !readings[output.readingId]) {
          const readingId = output.readingId;
          const cards = output.cards;
          const spreadId = output.spreadId ?? 'one_card';
          setReadings((prev) => ({ ...prev, [readingId]: { spreadId, cards } }));
          saveReading(sessionId, {
            id: readingId,
            session_id: sessionId,
            user_id: '',
            spread_id: spreadId,
            seed: 0,
            cards,
            created_at: new Date().toISOString(),
          });
        }

        if (part.type === 'tool-request_clarification' && output.clarifier && output.readingId) {
          const readingId = output.readingId;
          const clarifier = output.clarifier;
          setReadings((prev) => {
            const reading = prev[readingId];
            if (!reading || reading.cards.some((c) => c.cardId === clarifier.cardId)) return prev;
            const cards = [...reading.cards, clarifier];
            saveReading(sessionId, {
              id: readingId,
              session_id: sessionId,
              user_id: '',
              spread_id: reading.spreadId,
              seed: 0,
              cards,
              created_at: new Date().toISOString(),
            });
            return { ...prev, [readingId]: { ...reading, cards } };
          });
        }
      }
    }
  }, [chat.messages, readings, sessionId]);

  const ensureGuestSession = (firstText: string) => {
    if (!getGuestSession(sessionId)) {
      const now = new Date().toISOString();
      saveSession({
        id: sessionId,
        user_id: '',
        title: titleFrom(firstText),
        created_at: now,
        updated_at: now,
        messages: [],
        readings: [],
      });
      track('reflection_started');
      window.history.replaceState(null, '', `/reflect/${sessionId}`);
    }
  };

  const send = (text: string, metadata?: ChatMessage['metadata']) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    // A previous failed generation leaves status 'error'; clear it so the
    // user can keep reflecting (their message must never be swallowed).
    const fullMetadata = {
      ...metadata,
      approvedContext: approvedContext.length > 0 ? approvedContext.map(({ entryId, title }) => ({ entryId, title })) : undefined,
    };
    const attempt = () => chat.sendMessage({ text: trimmed, metadata: fullMetadata });
    if (chat.status === 'error') {
      chat.clearError();
      setTimeout(attempt, 80);
    } else if (chat.status === 'ready') {
      attempt();
    } else {
      return; // busy — nothing to send right now
    }
    ensureGuestSession(trimmed);
    appendMessage(sessionId, {
      id: crypto.randomUUID(),
      session_id: sessionId,
      user_id: '',
      role: 'user',
      content: trimmed,
      meta: metadata ?? {},
      created_at: new Date().toISOString(),
    });
    lastSent.current = trimmed;
    setInput('');
  };

  // ── Draw flows (server-side seeded draws; plan global constraints) ────

  const restDraw = async (spreadId: string) => {
    const res = await fetch('/api/tarot/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadId, sessionId }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { readingId: string; spreadId: string; seed: number; cards: DrawnCard[] };
  };

  const commitDraw = (payload: { readingId: string; spreadId: string; seed: number; cards: DrawnCard[] }) => {
    setReadings((prev) => ({ ...prev, [payload.readingId]: { spreadId: payload.spreadId, cards: payload.cards } }));
    saveReading(sessionId, {
      id: payload.readingId,
      session_id: sessionId,
      user_id: '',
      spread_id: payload.spreadId,
      seed: payload.seed,
      cards: payload.cards,
      created_at: new Date().toISOString(),
    });
    track('tarot_started');
  };

  const startQuickDraw = async (spreadId: string) => {
    ensureGuestSession('Tarot reflection');
    const payload = await restDraw(spreadId);
    if (!payload) {
      setDrawFailedSpread(spreadId);
      return;
    }
    commitDraw(payload);
    const title = getSpread(spreadId)?.title ?? 'reading';
    const summary = payload.cards.map((c, i) => `${i + 1}. ${c.name} (${c.orientation}) — ${c.position}`).join(' | ');
    send(`[Cards drawn · ${title}] ${summary}. Please interpret this reading reflectively.`, {
      readingId: payload.readingId,
    });
  };

  const startInteractiveDraw = async (spreadId: string) => {
    ensureGuestSession('Tarot reflection');
    const payload = await restDraw(spreadId);
    if (!payload) {
      setDrawFailedSpread(spreadId);
      return;
    }
    commitDraw(payload);
    setCeremony({ cards: payload.cards, readingId: payload.readingId, spreadId: payload.spreadId });
  };

  const completeCeremony = (order: number[]) => {
    if (!ceremony) return;
    const { readingId, spreadId, cards } = ceremony;
    setCeremony(null);
    const title = getSpread(spreadId)?.title ?? 'reading';
    const summary = cards.map((c, i) => `${i + 1}. ${c.name} (${c.orientation}) — ${c.position}`).join(' | ');
    send(`[Cards drawn · ${title}] ${summary}. Please interpret this reading reflectively.`, {
      readingId,
      revealOrder: order,
    });
  };

  const clarifyCard = async (readingId: string, cardId: string) => {
    const reading = readings[readingId];
    if (!reading || clarifyingCardId) return;
    setClarifyingCardId(cardId);
    try {
      const res = await fetch('/api/tarot/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId, cardId, alreadyDrawn: reading.cards.map((c) => c.cardId) }),
      });
      if (!res.ok) return;
      const { clarifier } = (await res.json()) as { clarifier: DrawnCard };
      const cards = [...reading.cards, clarifier];
      setReadings((prev) => ({ ...prev, [readingId]: { ...prev[readingId], cards } }));
      saveReading(sessionId, {
        id: readingId,
        session_id: sessionId,
        user_id: '',
        spread_id: reading.spreadId,
        seed: 0,
        cards,
        created_at: new Date().toISOString(),
      });
      const target = reading.cards.find((c) => c.cardId === cardId);
      send(
        `[Clarification] ${clarifier.name} (${clarifier.orientation}) was drawn to clarify ${target?.name ?? cardId}. Please interpret the pair together.`,
        { clarify: { readingId, targetCardId: cardId, clarifierCardId: clarifier.cardId } },
      );
    } finally {
      setClarifyingCardId(null);
    }
  };

  // ── Propose-then-confirm actions (PRD §39, §41, §62) ─────────────────

  const markActed = (toolCallId: string) => setActedConfirms((prev) => new Set(prev).add(toolCallId));

  const saveInsightText = async (text: string) => {
    const now = new Date().toISOString();
    if (mode === 'account' && isSupabaseConfigured()) {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sessionId }),
      });
      if (!res.ok) {
        toast.error('Could not save the insight. It stays on screen — try again.');
        return;
      }
    } else {
      // Guest: save locally, then offer the account as the value moment (§14).
      saveGuestInsight(makeEntry({ body: text, entry_type: 'insight', source_session_id: sessionId, created_at: now, updated_at: now }));
      setSignInOpen(true);
    }
    track('insight_saved');
    toast.success('Insight saved to your journal.');
  };

  const scheduleFollowUp = async (when: 'tomorrow' | '3days' | '1week') => {
    const day = 24 * 60 * 60 * 1000;
    const dueAt =
      when === 'tomorrow' ? new Date(Date.now() + day) : when === '3days' ? new Date(Date.now() + 3 * day) : new Date(Date.now() + 7 * day);
    const followUp: import('@/lib/types').FollowUp = {
      id: crypto.randomUUID(),
      user_id: '',
      session_id: sessionId,
      journal_entry_id: null,
      due_at: dueAt.toISOString(),
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    if (mode === 'account' && isSupabaseConfigured()) {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, dueAt: followUp.due_at }),
      });
      if (!res.ok) {
        toast.error('Could not schedule the check-in.');
        return;
      }
    } else {
      saveFollowUp(followUp);
    }
    track('followup_created');
    toast.success('Check-in scheduled. Eclipsay will remind you here in the app.');
  };

  const rememberThis = async (content: string, category: string) => {
    const now = new Date().toISOString();
    if (mode === 'account' && isSupabaseConfigured()) {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, category, source: 'Reflection' }),
      });
      if (!res.ok) {
        toast.error('Could not save the memory right now.');
        return;
      }
    } else {
      saveMemory({
        id: crypto.randomUUID(),
        user_id: '',
        category: category as MemoryCategory,
        content,
        source: 'Reflection',
        active: true,
        created_at: now,
        updated_at: now,
      });
    }
    track('memory_created');
    toast.success('Remembered. You can edit or forget it anytime in Memory.');
  };

  const bringItIn = (hit: SearchHit) => {
    setApprovedContext((prev) => (prev.some((c) => c.entryId === hit.entryId) ? prev : [...prev, hit]));
  };

  const removeApproved = (entryId: string) => {
    setApprovedContext((prev) => prev.filter((c) => c.entryId !== entryId));
  };

  const busy = chat.status === 'submitted' || chat.status === 'streaming';
  const failed = chat.status === 'error';
  const empty = chat.messages.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {mode === "guest" && <OnboardingDialogs />}
      <MigrationDialog enabled={mode === "account"} />
      <SignInDialog
        open={signInOpen}
        onOpenChange={setSignInOpen}
        title="Create an account to keep this reflection."
      />

      {ceremony && (
        <DrawCeremony count={ceremony.cards.length} onCancel={() => setCeremony(null)} onComplete={completeCeremony} />
      )}
      {checkInOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Schedule a check-in"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h2 className="text-base font-medium">Check in with me later</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A gentle in-app reminder to revisit this reflection. No emails, no pressure.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {(
                [
                  { key: 'tomorrow', label: 'Tomorrow' },
                  { key: '3days', label: 'In 3 days' },
                  { key: '1week', label: 'In 1 week' },
                ] as const
              ).map(({ key, label }) => (
                <Button
                  key={key}
                  variant="secondary"
                  onClick={() => {
                    setCheckInOpen(false);
                    void scheduleFollowUp(key);
                  }}
                >
                  {label}
                </Button>
              ))}
              <Button variant="ghost" onClick={() => setCheckInOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {spreadPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a spread"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h2 className="text-base font-medium">Choose a spread</h2>
            <p className="mt-1 text-xs text-muted-foreground">Cards are always drawn fresh by the engine.</p>
            <div className="mt-4 flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
              {SPREADS.map((spread) => (
                <div key={spread.id} className="rounded-xl border border-border px-3.5 py-3">
                  <p className="text-sm font-medium">{spread.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{spread.positions.join(' · ')}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSpreadPickerOpen(false);
                        void startQuickDraw(spread.id);
                      }}
                    >
                      Draw for me
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSpreadPickerOpen(false);
                        void startInteractiveDraw(spread.id);
                      }}
                    >
                      I&apos;ll choose the cards
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-right">
              <Button size="sm" variant="ghost" onClick={() => setSpreadPickerOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pt-6 pb-4">
          {empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
              <h1 className="text-2xl font-medium tracking-tight">What&apos;s on your mind?</h1>
              <p className="max-w-sm text-sm text-muted-foreground">
                Start wherever it feels natural — a feeling, a decision, or something in between.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {chat.messages.map((message) => {
                const meta = message.metadata;
                const isInitial = initialMessageIds.current.has(message.id);
                const readingForMessage = meta?.readingId ? readings[meta.readingId] : undefined;
                if (message.role === 'user') {
                  return (
                    <div key={message.id} className="flex flex-col gap-2">
                      {readingForMessage && meta?.readingId && (
                        <TarotSpread
                          reading={{
                            readingId: meta.readingId,
                            spreadId: readingForMessage.spreadId,
                            cards: readingForMessage.cards,
                          }}
                          startRevealed={isInitial}
                          revealOrder={meta.revealOrder as number[] | undefined}
                          onClarify={clarifyCard}
                          clarifyingCardId={clarifyingCardId}
                          onRevealComplete={() => track('tarot_completed')}
                        />
                      )}
                      {(meta?.approvedContext?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {meta!.approvedContext!.map((chip) => (
                            <span
                              key={chip.entryId}
                              className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                            >
                              Using: &ldquo;{chip.title}&rdquo;
                              <button
                                type="button"
                                aria-label={`Remove context ${chip.title}`}
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => removeApproved(chip.entryId)}
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-end">
                        <div
                          className={`max-w-[85%] rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5 leading-7 whitespace-pre-wrap ${
                            meta?.readingId ? 'text-xs text-muted-foreground italic' : 'text-[15px]'
                          }`}
                        >
                          {joinUiText(message)}
                        </div>
                      </div>
                    </div>
                  );
                }
                const modelDrawPanel =
                  meta?.readingId && readings[meta.readingId]
                    ? !(chat.messages.some((m) => m.role === 'user' && m.metadata?.readingId === meta.readingId))
                    : false;
                return (
                  <div key={message.id} className="flex flex-col gap-2">
                    <ToolPartRenderer
                      message={message}
                      declined={declinedToolCalls.has(message.id)}
                      onPickSpread={(spreadId: string, drawMode: 'quick' | 'interactive') =>
                        drawMode === 'quick' ? void startQuickDraw(spreadId) : void startInteractiveDraw(spreadId)
                      }
                      onDeclineSpread={() => setDeclinedToolCalls((prev) => new Set(prev).add(message.id))}
                      onRetryDraw={() => chat.regenerate()}
                      confirm={{
                        actedIds: actedConfirms,
                        markActed: markActed,
                        approvedEntryIds: new Set(approvedContext.map((c) => c.entryId)),
                        onSaveInsight: (text) => void saveInsightText(text),
                        onRememberThis: (content, category) => void rememberThis(content, category),
                        onBringItIn: bringItIn,
                      }}
                    />
                    {modelDrawPanel && meta?.readingId && readings[meta.readingId] && (
                      <TarotSpread
                        reading={{
                          readingId: meta.readingId,
                          spreadId: readings[meta.readingId].spreadId,
                          cards: readings[meta.readingId].cards,
                        }}
                        startRevealed={isInitial}
                        onClarify={clarifyCard}
                        clarifyingCardId={clarifyingCardId}
                        onRevealComplete={() => track('tarot_completed')}
                      />
                    )}
                    <Markdown>{joinUiText(message)}</Markdown>
                  </div>
                );
              })}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                  <span className="size-2 animate-pulse rounded-full bg-primary/60" />
                  Reflecting…
                </div>
              )}
              {drawFailedSpread && (
                <DrawFailedCard
                  onRetry={() => {
                    const spreadId = drawFailedSpread;
                    setDrawFailedSpread(null);
                    void startQuickDraw(spreadId);
                  }}
                />
              )}
              {failed && (
                <div
                  role="alert"
                  className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
                >
                  <p className="text-sm">Something went wrong while generating this reflection.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => chat.regenerate()}>
                      <RefreshCw className="size-3.5" aria-hidden />
                      Try again
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setInput(lastSent.current);
                        chat.clearError();
                      }}
                    >
                      <PenLine className="size-3.5" aria-hidden />
                      Continue writing
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-background/95 px-4 py-3">
        <form
          className="mx-auto flex w-full max-w-2xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Check in with me later"
            title="Check in with me later"
            onClick={() => setCheckInOpen(true)}
          >
            <Clock className="size-4 text-primary" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Explore with cards"
            title="Explore with cards"
            onClick={() => setSpreadPickerOpen(true)}
          >
            <Sparkles className="size-4 text-primary" aria-hidden />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="What's on your mind?"
            aria-label="Message"
            rows={1}
            className="max-h-40 min-h-11 resize-none"
          />
          <Button type="submit" size="icon" disabled={busy || input.trim().length === 0} aria-label="Send">
            <ArrowUp className="size-4" aria-hidden />
          </Button>
        </form>
      </div>
    </div>
  );
}
