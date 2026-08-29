'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isStaticToolUIPart } from 'ai';
import { ArrowUp, RefreshCw, PenLine, Sparkles, Clock, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Markdown } from '@/components/chat/markdown';
import { CrisisResources } from '@/components/chat/crisis-resources';
import { OnboardingDialogs } from '@/components/chat/onboarding-dialogs';
import { MigrationDialog } from '@/components/auth/migration-dialog';
import { SignInDialog } from '@/components/auth/sign-in-dialog';
import { toast } from 'sonner';
import { TarotSpread, DrawFailedCard } from '@/components/tarot/tarot-spread';
import { DrawBar } from '@/components/tarot/draw-bar';
import { ToolPartRenderer, type SearchHit } from '@/components/chat/tool-parts';
import { classify } from '@/lib/ai/safety';
import { track } from '@/lib/analytics';
import { useDataMode } from '@/hooks/use-data-mode';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { getSpread } from '@/lib/tarot/spreads';
import { appendMessage, getGuestSession, loadGuestStore, saveFollowUp, saveInsight as saveGuestInsight, saveMemory, saveReading, saveSession } from '@/lib/guest/store';
import { joinUiText, storedToUi, type ChatMessage } from '@/lib/chat/convert';
import { makeEntry } from '@/lib/journal/entries';
import type { DrawnCard } from '@/lib/tarot/types';
import type { MemoryCategory, StoredMessage, TarotReading } from '@/lib/types';

function titleFrom(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length === 0 ? 'New Reflection' : compact.slice(0, 48);
}
type GuestMemoryPayload = { enabled: boolean; items: { category: string; content: string }[] };

// Contract with POST /api/chat (guest mode only): guestMemory carries the
// guest's active memories so reflection stays personal without an account
// (PRD §13). `memoryEnabled` arrives on the guest profile with the memory
// migration and defaults to on.
function guestMemoryPayload(): GuestMemoryPayload {
  const store = loadGuestStore();
  const profile = store.profile;
  const items = store.memories
    .filter((memory) => memory.active)
    .map((memory) => ({ category: memory.category, content: memory.content.trim() }))
    .filter((item) => item.content.length > 0)
    .slice(0, 20);
  return { enabled: profile.memoryEnabled ?? true, items };
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
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
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        // Resolvable body: evaluated per request, so guest memories are read
        // fresh at send time instead of frozen into the transport.
        body: () => (mode === 'guest' ? { sessionId, guestMemory: guestMemoryPayload() } : { sessionId }),
      }),
    [sessionId, mode],
  );

  // Readings hydrated at mount render revealed; live ones animate.
  const initialMessageIds = useRef<Set<string>>(new Set());
  const [readings, setReadings] = useState<ReadingsState>({});
  const [clarifyingCardId, setClarifyingCardId] = useState<string | null>(null);
  const [declinedToolCalls, setDeclinedToolCalls] = useState<Set<string>>(new Set());
  const [drawBar, setDrawBar] = useState<{ readingId: string; spreadId: string; cards: DrawnCard[] } | null>(null);
  const [drawFailedSpread, setDrawFailedSpread] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [actedConfirms, setActedConfirms] = useState<Set<string>>(new Set());
  const [approvedContext, setApprovedContext] = useState<SearchHit[]>([]);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  // ?followup=<id> is consumed once per mount (useState initializer). The
  // banner already marked the follow-up 'revisited' on click; this card only
  // re-anchors the transcript and has no write side effects.
  const [followupId] = useState(() => searchParams.get('followup'));
  const [followupDismissed, setFollowupDismissed] = useState(false);
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);

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
          setLastActiveAt(dbMessages[dbMessages.length - 1].created_at);
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
        setLastActiveAt(session.updated_at);
      }
    };
    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, mode]);

  // Mount-only URL intents: 'prefill' carries text over from the journal
  // composer; 'tarot' seeds the starter prompt for the entry action. Each is
  // read exactly once per mount, and prefill never auto-sends.
  useEffect(() => {
    const prefill = searchParams.get('prefill');
    if (prefill && input.length === 0) {
      setInput(prefill.slice(0, 200));
    } else if (searchParams.get('tarot') === '1' && chat.messages.length === 0) {
      setInput("I'd like to explore something with a few cards.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fires once per recommend_reading tool call that reaches output-available
  // (plan: tarot_suggested analytics, previously never emitted).
  const suggestedTracked = useRef<Set<string>>(new Set());
  // Sync tool-produced readings (model-initiated draws/clarifications) into local state.
  useEffect(() => {
    for (const message of chat.messages) {
      for (const part of message.parts) {
        if (part.type === 'tool-recommend_reading' && !suggestedTracked.current.has(part.toolCallId)) {
          suggestedTracked.current.add(part.toolCallId);
          track('tarot_suggested');
        }
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

  // Every reading begins here (plan: recommendation → draw bar). The REST
  // draw fixes the seed server-side (PRD §25–§26); the bar only sequences
  // the reveal, and completion sends the [Cards drawn] summary for the model.
  const beginReading = async (spreadId: string) => {
    ensureGuestSession('Tarot reflection');
    const payload = await restDraw(spreadId);
    if (!payload) {
      setDrawFailedSpread(spreadId);
      return;
    }
    commitDraw(payload);
    setDrawBar({ readingId: payload.readingId, spreadId: payload.spreadId, cards: payload.cards });
  };

  const completeDraw = (order: number[]) => {
    if (!drawBar) return;
    const { readingId, spreadId, cards } = drawBar;
    setDrawBar(null);
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

  const saveInsightText = async (text: string): Promise<boolean> => {
    const now = new Date().toISOString();
    if (mode === 'account' && isSupabaseConfigured()) {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sessionId }),
      });
      if (!res.ok) {
        toast.error('Could not save the insight. It stays on screen — try again.');
        return false;
      }
    } else {
      // Guest: save locally, then offer the account as the value moment (§14).
      saveGuestInsight(makeEntry({ body: text, entry_type: 'insight', source_session_id: sessionId, created_at: now, updated_at: now }));
      setSignInOpen(true);
    }
    track('insight_saved');
    toast.success('Insight saved to your journal.');
    return true;
  };

  // Manual capture affordance (PRD §4.2 — user agency): every assistant
  // message can be saved through the exact write path the propose_insight
  // confirm uses; success just flips the local affordance to its saved state.
  const saveMessageInsight = (messageId: string, text: string) => {
    void saveInsightText(text).then((saved) => {
      if (saved) setSavedMessageIds((prev) => new Set(prev).add(messageId));
    });
  };

  // Crisis card visibility is derived only from the committed transcript
  // (PRD §52–§55): the classifier runs on the latest user text, and a
  // hydrated assistant reply can carry meta.crisis. Deterministic — the same
  // message list renders the same card, nothing flashes while a reply
  // streams, and a newer non-crisis exchange hides it again.
  const crisisVisible = useMemo(() => {
    let lastUserIndex = -1;
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex === -1) return false;
    if (classify(joinUiText(chat.messages[lastUserIndex])).crisis) return true;
    for (let i = lastUserIndex + 1; i < chat.messages.length; i++) {
      const message = chat.messages[i];
      if (message.role === 'assistant' && message.metadata?.crisis === true) return true;
    }
    return false;
  }, [chat.messages]);

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

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent className="max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl ring-0">
          <DialogHeader>
            <DialogTitle>Check in with me later</DialogTitle>
            <DialogDescription className="text-xs">
              A gentle in-app reminder to revisit this reflection. No emails, no pressure.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
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
        </DialogContent>
      </Dialog>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pt-6 pb-4">
          {followupId && !followupDismissed && (
            <div className="mb-6 rounded-2xl border border-border bg-card px-4 py-3.5">
              <p className="text-sm font-medium">Picking this back up</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {lastActiveAt ? `You were last here ${relativeTime(lastActiveAt)}. ` : ''}Whenever you&apos;re ready — no rush.
              </p>
              <div className="mt-2">
                <Button
                  size="xs"
                  variant="ghost"
                  aria-label="Dismiss this re-entry note"
                  onClick={() => setFollowupDismissed(true)}
                >
                  Got it
                </Button>
              </div>
            </div>
          )}
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
                const messageText = joinUiText(message);
                return (
                  <div key={message.id} className="group flex flex-col gap-2">
                    <ToolPartRenderer
                      message={message}
                      declined={declinedToolCalls.has(message.id)}
                      onBeginReading={(spreadId) => void beginReading(spreadId)}
                      onDecline={() => setDeclinedToolCalls((prev) => new Set(prev).add(message.id))}
                      onAnswerClarify={(text) => send(text)}
                      confirm={{
                        actedIds: actedConfirms,
                        markActed: markActed,
                        approvedEntryIds: new Set(approvedContext.map((c) => c.entryId)),
                        onSaveInsight: (text) => void saveInsightText(text),
                        onRememberThis: (content, category) => void rememberThis(content, category),
                        onBringItIn: bringItIn,
                      }}
                    />
                    <Markdown>{messageText}</Markdown>
                    {messageText.trim().length > 0 && (
                      <div>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={savedMessageIds.has(message.id)}
                          aria-label="Save this reflection to your journal"
                          className={`text-muted-foreground motion-reduce:transition-none ${
                            savedMessageIds.has(message.id)
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100'
                          }`}
                          onClick={() => saveMessageInsight(message.id, messageText)}
                        >
                          <NotebookPen aria-hidden />
                          {savedMessageIds.has(message.id) ? 'Saved' : 'Save to journal'}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {crisisVisible && <CrisisResources />}
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
                    void beginReading(spreadId);
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
      {drawBar && (
        <div className="bg-background/95 px-4 pb-2">
          <div className="mx-auto w-full max-w-2xl">
            <DrawBar cards={drawBar.cards} onComplete={completeDraw} onCancel={() => setDrawBar(null)} />
          </div>
        </div>
      )}

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
            onClick={() => setInput("I'd like to explore something with a few cards.")}
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
