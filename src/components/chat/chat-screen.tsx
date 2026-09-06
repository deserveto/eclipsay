'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { RefreshCw, PenLine, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiChatInput } from '@/components/ui/ai-chat-input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Markdown } from '@/components/chat/markdown';
import { CrisisResources } from '@/components/chat/crisis-resources';
import { OnboardingDialogs } from '@/components/chat/onboarding-dialogs';
import { toast } from 'sonner';
import { TarotSpread, DrawFailedCard } from '@/components/tarot/tarot-spread';
import { DrawBar } from '@/components/tarot/draw-bar';
import { ToolPartRenderer, type SearchHit } from '@/components/chat/tool-parts';
import { ComposerClarification, ComposerPlainClarification } from '@/components/chat/composer-clarification';
import { classifyTranscript } from '@/lib/ai/safety';
import { track } from '@/lib/analytics';
import { useDataMode } from '@/hooks/use-data-mode';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { appendMessage, getGuestSession, loadGuestStore, saveFollowUp, saveInsight as saveGuestInsight, saveMemory, saveReading, saveSession, updateMessageMeta, GUEST_STORE_ERROR_EVENT } from '@/lib/guest/store';
import { guestSaveToast } from '@/lib/account-nudge';
import { isMessageCaptured, markMessageCaptured } from '@/lib/chat/captures';
import { activeAskUserPart, activePlainClarification, extractToolParts, isSystemNotice, joinUiText, pickInterruptedReading, staleInteractiveMessageIds, storedToUi, type ChatMessage } from '@/lib/chat/convert';
import { generateSessionTitle } from '@/lib/chat/session-actions';
import { titleFrom } from '@/lib/chat/title';
import { getSpread } from '@/lib/tarot/spreads';
import { makeEntry } from '@/lib/journal/entries';
import type { DrawnCard } from '@/lib/tarot/types';
import type { FollowUp, MemoryCategory, MessageMeta, StoredMessage, TarotReading } from '@/lib/types';

const TAROT_UNAVAILABLE_MESSAGE = 'Cards are unavailable for this reflection. Start a new reflection to explore with cards.';
const MEMORY_DISABLED_MESSAGE = 'Memory is off. Turn it back on to add memories.';

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

type ReadingsState = Record<string, { spreadId: string; cards: DrawnCard[]; seed: number; createdAt: string }>;

export function ChatScreen({ initialSessionId }: { initialSessionId?: string }) {
  const { mode, resolving } = useDataMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState('');
  const lastSent = useRef('');
  // First exchange of a fresh session (captured at send time, consumed at
  // stream finish): drives one-shot AI title generation. `firstTitle` is
  // the guest compare-and-swap guard — only replace the placeholder the
  // store actually holds, never a user's rename.
  const firstUserText = useRef<string | null>(null);
  const firstTitle = useRef<string | undefined>(undefined);

  // Stable per-screen session id; a deep link reuses the existing session.
  const sessionId = useMemo(() => initialSessionId ?? crypto.randomUUID(), [initialSessionId]);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        // Resolvable body: evaluated per request, so guest memories are read
        // fresh at send time instead of frozen into the transport.
        // Audit A36: guests get the conservative teen prompt policy unless
        // this browser completed the age step as adult.
        body: () =>
          mode === 'guest'
            ? {
                sessionId,
                guestMemory: guestMemoryPayload(),
                guestAdultConfirmed: loadGuestStore().profile.ageBracket === '18_plus',
              }
            : { sessionId },
      }),
    [sessionId, mode],
  );

  // Readings hydrated at mount render revealed; live ones animate.
  const initialMessageIds = useRef<Set<string>>(new Set());
  const [readings, setReadings] = useState<ReadingsState>({});
  const [clarifyingCardId, setClarifyingCardId] = useState<string | null>(null);
  const [declinedToolCalls, setDeclinedToolCalls] = useState<Set<string>>(new Set());
  const [drawBar, setDrawBar] = useState<{ readingId: string; spreadId: string; cards: DrawnCard[] } | null>(null);
  const [dismissedReadings, setDismissedReadingIds] = useState<Set<string>>(new Set());
  const [drawFailedSpread, setDrawFailedSpread] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [actedConfirms, setActedConfirms] = useState<Set<string>>(new Set());
  const [approvedContext, setApprovedContext] = useState<SearchHit[]>([]);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [savingMessageIds, setSavingMessageIds] = useState<Set<string>>(new Set());
  // Audit A15: a provider stall must never lock the composer — a local
  // timeout backs the Stop affordance.
  const [timedOut, setTimedOut] = useState(false);
  // Audit A16: a transcript that ends with an uninterpreted draw notice gets
  // a persistent retry affordance that survives reload.
  const [needsInterpretation, setNeedsInterpretation] = useState(false);
  // Audit A13: hydration failures must be visible, never read as "empty".
  const [loadError, setLoadError] = useState(false);
  const [hydrateNonce, setHydrateNonce] = useState(0);
  // ?followup=<id> is consumed once per mount (useState initializer). The
  // banner already marked the follow-up 'revisited' on click; this card only
  // re-anchors the transcript and has no write side effects.
  const [followupId] = useState(() => searchParams.get('followup'));
  const [followupDismissed, setFollowupDismissed] = useState(false);
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);
  // Confirm cards remember their resolved state across navigation (PRD §62):
  // acted tool calls and declined recommendations restore from message meta.
  const restoreConfirmState = (messages: StoredMessage[]) => {
    const acted = new Set<string>();
    const declinedToolCallIds = new Set<string>();
    const dismissed = new Set<string>();
    for (const m of messages) {
      for (const id of m.meta.actedToolCallIds ?? []) acted.add(id);
      // Audit A31: acted/declined confirm state persists for accounts too.
      for (const id of m.meta.declinedToolCallIds ?? []) declinedToolCallIds.add(id);
      // Pre-A31 guests persisted a whole-message declined flag.
      if (m.meta.declined) {
        for (const tool of m.meta.tools ?? []) {
          if (tool.type === 'tool-recommend_reading') declinedToolCallIds.add(tool.toolCallId);
        }
      }
      for (const id of m.meta.dismissedReadingIds ?? []) dismissed.add(id);
    }
    if (acted.size > 0) setActedConfirms(acted);
    if (declinedToolCallIds.size > 0) setDeclinedToolCalls(declinedToolCallIds);
    if (dismissed.size > 0) setDismissedReadingIds(dismissed);
    return dismissed;
  };

  // Audit A16: a transcript whose LAST event is a draw/clarify notice was
  // never interpreted (e.g. the reply failed and the user reloaded). The
  // cards are persisted verbatim; regenerate() re-asks the model on the same
  // transcript without redrawing or duplicating the user turn (audit A32).
  const detectUninterpretedDraw = (messages: ChatMessage[]) => {
    const last = messages[messages.length - 1];
    setNeedsInterpretation(last?.role === 'user' && isSystemNotice(last.metadata));
  };

  // A reading persisted without a transcript anchor means navigation (or a
  // reload) interrupted the draw mid-bar. The cards are already fixed by the
  // server seed (PRD §25), so resume the bar instead of losing the draw —
  // but only the newest reading, and only one drawn after the transcript's
  // last event, so completed or closed draws never resurrect the bar.
  const resumeInterruptedDraw = (messages: StoredMessage[], allReadings: ReadingsState, dismissed: Set<string>) => {
    const readingId = pickInterruptedReading(messages, allReadings, dismissed);
    if (!readingId) return;
    const reading = allReadings[readingId];
    setDrawBar({ readingId, spreadId: reading.spreadId, cards: reading.cards });
  };

  const chat = useChat<ChatMessage>({
    id: sessionId,
    transport,
    onError: () => {},
    onFinish: (event) => {
      // Audit A03: guest persistence is guest-only. Account transcripts are
      // persisted server-side (PRD §34); writing here would leak the reply
      // into the shared local store of the next visitor.
      if (mode === 'guest') {
        const tools = extractToolParts(event.message);
        appendMessage(sessionId, {
          id: event.message.id,
          session_id: sessionId,
          user_id: '',
          role: 'assistant',
          content: joinUiText(event.message),
          meta: { ...(event.message.metadata ?? {}), ...(tools.length > 0 ? { tools } : {}) },
          created_at: new Date().toISOString(),
        });
      }
      // One-shot title generation after the very first assistant reply.
      // Fire-and-forget: a failed or rejected title keeps the placeholder.
      const firstText = firstUserText.current;
      if (firstText !== null) {
        firstUserText.current = null;
        const replyText = joinUiText(event.message).trim();
        if (replyText.length > 0) {
          const expectedTitle = firstTitle.current;
          firstTitle.current = undefined;
          void generateSessionTitle({ sessionId, mode, userText: firstText, assistantText: replyText, expectedTitle });
        }
      }
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
        // Audit A13: a failed read renders an explicit error with retry — it
        // must never look like an empty session or fall back to guest data.
        if (msgs.error || reads.error) {
          setLoadError(true);
          return;
        }
        const dbMessages = (msgs.data ?? []) as unknown as StoredMessage[];
        if (dbMessages.length > 0) {
          initialMessageIds.current = new Set(dbMessages.map((m) => m.id));
          chat.setMessages(dbMessages.map(storedToUi));
          setLastActiveAt(dbMessages[dbMessages.length - 1].created_at);
          detectUninterpretedDraw(dbMessages.map(storedToUi));
        }
        const dbReadings: ReadingsState = {};
        for (const r of (reads.data ?? []) as unknown as TarotReading[]) {
          dbReadings[r.id] = { spreadId: r.spread_id, cards: r.cards, seed: r.seed, createdAt: r.created_at };
        }
        setReadings(dbReadings);
        resumeInterruptedDraw(dbMessages, dbReadings, restoreConfirmState(dbMessages));
        return;
      }
      // Guest mode: everything lives in localStorage.
      const session = getGuestSession(sessionId);
      if (session) {
        initialMessageIds.current = new Set(session.messages.map((m) => m.id));
        if (session.messages.length > 0) {
          const uiMessages = session.messages.map(storedToUi);
          chat.setMessages(uiMessages);
          detectUninterpretedDraw(uiMessages);
        }
        const stored: ReadingsState = {};
        for (const r of session.readings) stored[r.id] = { spreadId: r.spread_id, cards: r.cards, seed: r.seed, createdAt: r.created_at };
        setReadings(stored);
        setLastActiveAt(session.updated_at);
        resumeInterruptedDraw(session.messages, stored, restoreConfirmState(session.messages));
      }
    };
    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, mode, hydrateNonce]);

  // Mount-only URL intents (audit A21): `intent=tarot` seeds the tarot
  // starter (optionally naming a spread from Explore), `prefill` carries
  // journal text over. Tarot intent wins over prefill so "Reflect with
  // tarot" never degrades into plain journal text. Nothing auto-sends.
  useEffect(() => {
    const intent = searchParams.get('intent');
    const spreadId = searchParams.get('spread');
    const prefill = searchParams.get('prefill');
    if (intent === 'tarot' && chat.messages.length === 0 && input.length === 0) {
      const spread = spreadId ? getSpread(spreadId) : undefined;
      setInput(
        spread
          ? `I'd like to explore something with a few cards — maybe the ${spread.title} spread.`
          : "I'd like to explore something with a few cards.",
      );
    } else if (prefill && input.length === 0) {
      setInput(prefill.slice(0, 200));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fires once per recommend_reading tool call (plan: tarot_suggested
  // analytics). The pre-A34 model-driven clarification merge lived here; the
  // tool no longer draws, so readings only change through the app actions.
  const suggestedTracked = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const message of chat.messages) {
      for (const part of message.parts) {
        if (part.type === 'tool-recommend_reading' && !suggestedTracked.current.has(part.toolCallId)) {
          suggestedTracked.current.add(part.toolCallId);
          track('tarot_suggested');
        }
      }
    }
  }, [chat.messages]);

  // A stream that outlives its mount (the user navigated away mid-reply)
  // still persists through onFinish; merge whatever landed while we were
  // gone. Skipped while a local generation is in flight so the live
  // transcript is never clobbered.
  useEffect(() => {
    if (mode !== 'guest') return;
    const merge = () => {
      if (chat.status === 'submitted' || chat.status === 'streaming') return;
      const session = getGuestSession(sessionId);
      if (!session) return;
      setReadings((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const r of session.readings) {
          if (!next[r.id]) {
            next[r.id] = { spreadId: r.spread_id, cards: r.cards, seed: r.seed, createdAt: r.created_at };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      // The stale snapshot gates the call: ai@7's setMessages always pushes a
      // new state object, so an unconditional updater loop here would blow
      // past React's update-depth limit (this effect re-runs on every
      // messages change). Inside the updater, the freshest transcript wins —
      // the guest-store event fires synchronously inside send(), before the
      // optimistic message has flushed, and the fresh dedupe keeps that row
      // from importing twice.
      const known = new Set(chat.messages.map((m) => m.id));
      const incoming = session.messages.filter((m) => !known.has(m.id));
      if (incoming.length === 0) return;
      chat.setMessages((prev) => {
        const freshKnown = new Set(prev.map((m) => m.id));
        const freshIncoming = incoming.filter((m) => !freshKnown.has(m.id));
        return freshIncoming.length > 0 ? [...prev, ...freshIncoming.map(storedToUi)] : prev;
      });
    };
    merge();
    window.addEventListener('eclipsay:guest-store-changed', merge);
    return () => window.removeEventListener('eclipsay:guest-store-changed', merge);

    // `chat` is a stable hook object; messages/status are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sessionId, chat.messages, chat.status]);

  // Audit A03: guest sessions are created in guest mode only. Creating one
  // in account mode is what let account readings/messages leak into the
  // shared local store.
  const ensureGuestSession = (firstText: string) => {
    if (mode !== 'guest' || resolving) return;
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
    // Fresh session: remember this exchange so the first assistant reply can
    // trigger one-shot title generation. The guest CAS guard is the title the
    // store holds right now (before ensureGuestSession writes the placeholder).
    if (chat.messages.length === 0) {
      firstUserText.current = trimmed;
      firstTitle.current = getGuestSession(sessionId)?.title ?? titleFrom(trimmed);
    }
    // A previous failed generation leaves status 'error'; clear it so the
    // user can keep reflecting (their message must never be swallowed).
    const fullMetadata = {
      ...metadata,
      approvedContext: approvedContext.length > 0 ? approvedContext.map(({ entryId, title }) => ({ entryId, title })) : undefined,
    };
    // One id shared by the optimistic message and the guest-store row below:
    // the store-change merge dedupes by id, so the persisted row can never
    // re-import as a second transcript copy of the same message.
    const messageId = crypto.randomUUID();
    // ai@7: a full CreateUIMessage passes through verbatim, keeping our id
    // (shared with the guest-store row below). The old { text, messageId }
    // shape now means "edit the message with this id" and throws.
    const attempt = () =>
      chat.sendMessage({ id: messageId, role: 'user', parts: [{ type: 'text', text: trimmed }], metadata: fullMetadata });
    if (chat.status === 'error') {
      chat.clearError();
      setTimeout(attempt, 80);
    } else if (chat.status === 'ready') {
      attempt();
    } else {
      return; // busy — nothing to send right now
    }
    // Audit A03: writes are gated on a RESOLVED guest mode. While auth is
    // still resolving the visitor may be an account user — skip the local
    // write; the account path persists server-side either way (PRD §34).
    if (mode === 'guest' && !resolving) {
      ensureGuestSession(trimmed);
      // Same id as the optimistic message above (guest mode only — account
      // sessions persist entirely server-side, PRD §34). The id also makes
      // account persistence idempotent (audit A32).
      appendMessage(sessionId, {
        id: messageId,
        session_id: sessionId,
        user_id: '',
        role: 'user',
        content: trimmed,
        meta: fullMetadata,
        created_at: new Date().toISOString(),
      });
    }
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
    const createdAt = new Date().toISOString();
    setReadings((prev) => ({
      ...prev,
      [payload.readingId]: { spreadId: payload.spreadId, cards: payload.cards, seed: payload.seed, createdAt },
    }));
    // Audit A03: account readings persist server-side in the draw route;
    // only guests mirror them into the local store.
    if (mode === 'guest' && !resolving) {
      saveReading(sessionId, {
        id: payload.readingId,
        session_id: sessionId,
        user_id: '',
        spread_id: payload.spreadId,
        seed: payload.seed,
        cards: payload.cards,
        created_at: createdAt,
      });
    }
    track('tarot_started');
  };

  // Every reading begins here (plan: recommendation → draw bar). The REST
  // draw fixes the seed server-side (PRD §25–§26); the bar only sequences
  // the reveal, and completion sends the [Cards drawn] summary for the model.
  const beginReading = async (spreadId: string) => {
    if (tarotUnavailable) {
      toast.error(TAROT_UNAVAILABLE_MESSAGE);
      return;
    }
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
    if (tarotUnavailable) {
      setDrawBar(null);
      toast.error(TAROT_UNAVAILABLE_MESSAGE);
      return;
    }
    if (!drawBar) return;
    const { readingId, spreadId, cards } = drawBar;
    setDrawBar(null);
    // Language-neutral event notice: data only, no natural-language ask. The
    // "interpret now" directive lives in the system prompt (route-side), so
    // this notice's wording can never set the reply's language.
    const summary = cards.map((c, i) => `${i + 1}. ${c.name} (${c.orientation}) — ${c.position}`).join(' | ');
    send(`[Cards drawn · ${spreadId}] ${summary}`, { systemNotice: 'draw', readingId, revealOrder: order });
  };

  // Closing the bar is a decision, not an interruption: remember the reading
  // (guests persist it on the transcript's last message) so hydration never
  // resurrects a draw the user walked away from (PRD §25–§26).
  const cancelDrawBar = () => {
    if (!drawBar) return;
    const next = new Set(dismissedReadings).add(drawBar.readingId);
    setDismissedReadingIds(next);
    const lastMessage = chat.messages[chat.messages.length - 1];
    if (mode === 'guest' && lastMessage) {
      updateMessageMeta(sessionId, lastMessage.id, { dismissedReadingIds: [...next] });
    }
    setDrawBar(null);
  };

  // Returns whether the clarification card was drawn (so the proposing
  // confirm card can settle — audit A34). Guests keep their local reading in
  // sync with the original seed and creation time intact (audit A05).
  const clarifyCard = async (readingId: string, cardId: string): Promise<boolean> => {
    if (tarotUnavailable) {
      toast.error(TAROT_UNAVAILABLE_MESSAGE);
      return false;
    }
    const reading = readings[readingId];
    // A clarification is only meaningful when its interpret message can be
    // sent (send no-ops while a generation is in flight) — otherwise the
    // drawn card would appear with no reading attached.
    if (!reading || clarifyingCardId || chat.status !== 'ready') return false;
    setClarifyingCardId(cardId);
    try {
      const res = await fetch('/api/tarot/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId, cardId, alreadyDrawn: reading.cards.map((c) => c.cardId), sessionId }),
      });
      if (!res.ok) return false;
      const { clarifier } = (await res.json()) as { clarifier: DrawnCard };
      const cards = [...reading.cards, clarifier];
      setReadings((prev) => ({ ...prev, [readingId]: { ...prev[readingId], cards } }));
      if (mode === 'guest' && !resolving) {
        // Audit A05: clarification EXPANDS a reading — the seeded identity
        // (seed + created_at) must survive, or history/exports break.
        saveReading(sessionId, {
          id: readingId,
          session_id: sessionId,
          user_id: '',
          spread_id: reading.spreadId,
          seed: reading.seed,
          cards,
          created_at: reading.createdAt,
        });
      }
      const target = reading.cards.find((c) => c.cardId === cardId);
      // Language-neutral event notice (see completeDraw): data only.
      send(
        `[Clarification · ${clarifier.cardId} → ${cardId}] ${clarifier.name} (${clarifier.orientation}) clarifies ${target?.name ?? cardId}`,
        { systemNotice: 'clarify', clarify: { readingId, targetCardId: cardId, clarifierCardId: clarifier.cardId } },
      );
      return true;
    } finally {
      setClarifyingCardId(null);
    }
  };

  // ── Propose-then-confirm actions (PRD §39, §41, §62) ─────────────────

  // Audit A31: account confirm/decline decisions persist onto the assistant
  // message row (located by its serialized tool part, since the client never
  // knows the DB row id), so proposals stay settled across reloads exactly
  // like the guest path (PRD §62).
  const persistAccountConfirmState = async (toolCallId: string, kind: 'acted' | 'declined') => {
    if (mode !== 'account' || !isSupabaseConfigured()) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('messages')
        .select('id, meta')
        .eq('session_id', sessionId)
        .contains('meta', { tools: [{ toolCallId }] })
        .maybeSingle();
      if (!data) return;
      const meta = (data.meta ?? {}) as MessageMeta;
      const patch: MessageMeta =
        kind === 'acted'
          ? { actedToolCallIds: [...new Set([...(meta.actedToolCallIds ?? []), toolCallId])] }
          : { declinedToolCallIds: [...new Set([...(meta.declinedToolCallIds ?? []), toolCallId])] };
      await supabase.from('messages').update({ meta: { ...meta, ...patch } }).eq('id', data.id);
    } catch {
      // Worst case the card becomes actionable again after reload — never
      // block the user interaction on the persistence write.
    }
  };

  const handleActed = (messageId: string, toolCallId: string) => {
    const next = new Set(actedConfirms).add(toolCallId);
    setActedConfirms(next);
    // Guests persist the resolved state so cards stay settled after
    // navigating away and back (PRD §62); accounts now do the same (A31).
    if (mode === 'guest') updateMessageMeta(sessionId, messageId, { actedToolCallIds: [...next] });
    else void persistAccountConfirmState(toolCallId, 'acted');
  };

  const handleDeclined = (messageId: string, toolCallId: string) => {
    const next = new Set(declinedToolCalls).add(toolCallId);
    setDeclinedToolCalls(next);
    if (mode === 'guest') updateMessageMeta(sessionId, messageId, { declinedToolCallIds: [...next] });
    else void persistAccountConfirmState(toolCallId, 'declined');
  };

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
      track('insight_saved');
      toast.success('Insight saved to your journal.');
    } else {
      saveGuestInsight(makeEntry({ body: text, entry_type: 'insight', source_session_id: sessionId, created_at: now, updated_at: now }));
      // Audit A23: exactly one success notification per save — guestSaveToast
      // already IS the success toast (with the one-time account nudge).
      track('insight_saved');
      guestSaveToast('Insight saved to your journal.', router.push);
    }
    return true;
  };

  // Manual capture affordance (PRD §4.2 — user agency): every assistant
  // message can be saved through the exact write path the propose_insight
  // confirm uses. Audit A23: a persisted capture key makes the affordance
  // idempotent across reloads, and a pending lock blocks double-submits.
  const saveMessageInsight = (messageId: string, text: string) => {
    if (savingMessageIds.has(messageId) || isMessageCaptured(sessionId, messageId)) {
      setSavedMessageIds((prev) => new Set(prev).add(messageId));
      return;
    }
    setSavingMessageIds((prev) => new Set(prev).add(messageId));
    void saveInsightText(text).then((saved) => {
      if (saved) {
        markMessageCaptured(sessionId, messageId);
        setSavedMessageIds((prev) => new Set(prev).add(messageId));
      }
      setSavingMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    });
  };

  const sessionSafety = useMemo(() => {
    // Audit A27: every user message is classified — metadata is
    // client-controlled and must never gate the safety policy.
    const userMessages = chat.messages.filter((message) => message.role === 'user');
    const transcriptSafety = classifyTranscript(userMessages.map(joinUiText));
    const persistedCrisis = chat.messages.some((message) => message.role === 'assistant' && message.metadata?.crisis === true);
    return {
      highStakes: transcriptSafety.highStakes || persistedCrisis,
      crisis: transcriptSafety.crisis || persistedCrisis,
    };
  }, [chat.messages]);
  const crisisVisible = sessionSafety.crisis;
  const tarotUnavailable = sessionSafety.highStakes;

  useEffect(() => {
    if (tarotUnavailable && drawBar) setDrawBar(null);
  }, [drawBar, tarotUnavailable]);

  // One write path for both the manual Check-in dialog and the model's
  // create_followup proposal (audit A33). Returns success so the proposal
  // card settles only when the reminder actually exists.
  const scheduleFollowUpAt = async (dueAt: Date): Promise<boolean> => {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (dueAt.getTime() <= now || dueAt.getTime() > now + 366 * day) return false;
    const followUp: FollowUp = {
      id: crypto.randomUUID(),
      user_id: '',
      session_id: sessionId,
      journal_entry_id: null,
      due_at: dueAt.toISOString(),
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    if (mode === 'account' && isSupabaseConfigured()) {
      try {
        const res = await fetch('/api/followups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, dueAt: followUp.due_at }),
        });
        if (!res.ok) {
          toast.error('Could not schedule the check-in.');
          return false;
        }
      } catch {
        toast.error('Could not schedule the check-in.');
        return false;
      }
    } else {
      if (mode !== 'guest' || resolving) return false;
      saveFollowUp(followUp);
    }
    track('followup_created');
    toast.success('Check-in scheduled. Eclipsay will remind you here in the app.');
    return true;
  };

  const scheduleFollowUp = (when: 'tomorrow' | '3days' | '1week') => {
    const day = 24 * 60 * 60 * 1000;
    const dueAt =
      when === 'tomorrow' ? new Date(Date.now() + day) : when === '3days' ? new Date(Date.now() + 3 * day) : new Date(Date.now() + 7 * day);
    return scheduleFollowUpAt(dueAt);
  };

  const rememberThis = async (content: string, category: string): Promise<boolean> => {
    if (mode === 'guest' && !loadGuestStore().profile.memoryEnabled) {
      toast.error(MEMORY_DISABLED_MESSAGE);
      return false;
    }
    const now = new Date().toISOString();
    if (mode === 'account' && isSupabaseConfigured()) {
      try {
        const res = await fetch('/api/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, category, source: 'Reflection' }),
        });
        if (!res.ok) {
          const payload: unknown = await res.json().catch(() => null);
          const errorCode =
            payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
              ? payload.error
              : undefined;
          toast.error(errorCode === 'memory_disabled' ? MEMORY_DISABLED_MESSAGE : 'Could not save the memory right now.');
          return false;
        }
      } catch {
        toast.error('Could not save the memory right now.');
        return false;
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
    return true;
  };

  const bringItIn = (hit: SearchHit) => {
    setApprovedContext((prev) => (prev.some((c) => c.entryId === hit.entryId) ? prev : [...prev, hit]));
  };

  const removeApproved = (entryId: string) => {
    setApprovedContext((prev) => prev.filter((c) => c.entryId !== entryId));
  };

  // Interactive cards (reading suggestions, ask_user chips) retire once the
  // user's next message lands (PRD §30): derived from transcript position so
  // hydration reproduces the same state without persisted flags.
  const staleInteractiveIds = useMemo(() => staleInteractiveMessageIds(chat.messages), [chat.messages]);

  // The live ask_user batch docks above the composer (PRD §30); it appears
  // only after streaming finishes, and answering (acted) or any later user
  // message (stale) retires it.
  const activeClarification = useMemo(
    () => activeAskUserPart(chat.messages, staleInteractiveIds, actedConfirms),
    [chat.messages, staleInteractiveIds, actedConfirms],
  );
  const plainClarification = useMemo(
    () => (activeClarification ? null : activePlainClarification(chat.messages, staleInteractiveIds)),
    [activeClarification, chat.messages, staleInteractiveIds],
  );
  const busy = chat.status === 'submitted' || chat.status === 'streaming';
  const failed = chat.status === 'error';
  const empty = chat.messages.length === 0 && !loadError;
  const onboardingEligible = useMemo(() => {
    if (busy || sessionSafety.highStakes) return false;
    const latestAssistant = [...chat.messages].reverse().find((message) => message.role === 'assistant');
    if (!latestAssistant || joinUiText(latestAssistant).trim().length === 0) return false;
    return latestAssistant.parts.every((part) => !part.type.startsWith('tool-'));
  }, [busy, chat.messages, sessionSafety.highStakes]);

  // Audit A15: back a stalled generation with a local timeout slightly above
  // the route's maxDuration; stopping preserves the user turn and any
  // partial content, and the recovery UI offers Try again / Continue.
  useEffect(() => {
    if (!busy) return;
    setTimedOut(false);
    const timer = window.setTimeout(() => {
      chat.stop();
      setTimedOut(true);
    }, 65_000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  useEffect(() => {
    // Audit A19: storage denial/quota must surface honestly — input is kept,
    // the user just learns their data won't persist.
    const onStoreError = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
      if (reason === 'quota') toast.error('This browser\u2019s storage is full — your reflections may not be saved. Free up space or export your data.');
      else toast.error('This browser is blocking local storage — your reflections won\u2019t be saved here.');
    };
    window.addEventListener(GUEST_STORE_ERROR_EVENT, onStoreError);
    return () => window.removeEventListener(GUEST_STORE_ERROR_EVENT, onStoreError);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {mode === 'guest' && !resolving && <OnboardingDialogs eligible={onboardingEligible} />}
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
          {loadError ? (
            <div role="alert" className="my-24 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                Your reflections couldn&apos;t be loaded just now. Nothing is lost — try again.
              </p>
              <Button size="sm" variant="secondary" onClick={() => { setLoadError(false); setHydrateNonce((n) => n + 1); }}>
                <RefreshCw className="size-3.5" aria-hidden />
                Try again
              </Button>
            </div>
          ) : empty ? (
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
                const machineNotice = isSystemNotice(meta);
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
                          onClarify={tarotUnavailable ? undefined : clarifyCard}
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
                                className="grid size-6 place-items-center text-muted-foreground hover:text-foreground"
                                onClick={() => removeApproved(chip.entryId)}
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {!machineNotice && (
                        <div className="flex justify-end">
                          <div
                            className={`max-w-[85%] rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5 leading-7 whitespace-pre-wrap ${
                              meta?.readingId || meta?.clarify ? 'text-xs text-muted-foreground italic' : 'text-[15px]'
                            }`}
                          >
                            {joinUiText(message)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                const messageText = joinUiText(message);
                return (
                  <div key={message.id} className="group flex flex-col gap-2">
                    <Markdown>{messageText}</Markdown>
                    <ToolPartRenderer
                      message={message}
                      declinedToolCallIds={declinedToolCalls}
                      stale={staleInteractiveIds.has(message.id)}
                      tarotUnavailable={tarotUnavailable}
                      dockedToolCallId={activeClarification?.messageId === message.id ? activeClarification.part.toolCallId : undefined}
                      onBeginReading={(spreadId) => void beginReading(spreadId)}
                      onDecline={(messageId, toolCallId) => handleDeclined(messageId, toolCallId)}
                      confirm={{
                        actedIds: actedConfirms,
                        markActed: (toolCallId) => handleActed(message.id, toolCallId),
                        approvedEntryIds: new Set(approvedContext.map((c) => c.entryId)),
                        onSaveInsight: (text) => saveInsightText(text),
                        onRememberThis: (content, category) => rememberThis(content, category),
                        onBringItIn: bringItIn,
                        onScheduleFollowUp: (dueAt) => scheduleFollowUpAt(new Date(dueAt)),
                        onClarifyRequest: (readingId, cardId) => clarifyCard(readingId, cardId),
                      }}
                    />
                    {messageText.trim().length > 0 && (
                      <div>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={savedMessageIds.has(message.id) || savingMessageIds.has(message.id)}
                          aria-label="Save this reflection to your journal"
                          className="text-muted-foreground motion-reduce:transition-none"
                          onClick={() => saveMessageInsight(message.id, messageText)}
                        >
                          <NotebookPen aria-hidden />
                          {savedMessageIds.has(message.id) ? 'Saved' : savingMessageIds.has(message.id) ? 'Saving…' : 'Save to journal'}
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
                  {/* Audit A15: an explicit Stop — a stalled generation must
                      never lock the composer until navigation. */}
                  <Button size="xs" variant="ghost" onClick={() => chat.stop()}>
                    Stop
                  </Button>
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
              {needsInterpretation && !busy && !failed && !timedOut && (
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  {/* Audit A16: reload after a failed interpretation keeps a
                      clear retry path — without redrawing the cards. */}
                  <p className="text-sm">Your cards are on the table, waiting to be read.</p>
                  <div className="mt-2">
                    <Button size="sm" variant="secondary" onClick={() => { setNeedsInterpretation(false); chat.regenerate(); }}>
                      <RefreshCw className="size-3.5" aria-hidden />
                      Interpret now
                    </Button>
                  </div>
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
              {(failed || timedOut) && (
                <div
                  role="alert"
                  className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
                >
                  <p className="text-sm">
                    {timedOut ? 'This reflection took too long and was stopped.' : 'Something went wrong while generating this reflection.'}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setTimedOut(false); chat.regenerate(); }}>
                      <RefreshCw className="size-3.5" aria-hidden />
                      Try again
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setInput(lastSent.current);
                        chat.clearError();
                        setTimedOut(false);
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
          <DrawBar cards={drawBar.cards} onComplete={completeDraw} onCancel={cancelDrawBar} />
          </div>
        </div>
      )}

      <div className="bg-background/95 px-4 pt-2 pb-3">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {activeClarification && !busy ? (
            <ComposerClarification
              part={activeClarification.part}
              onSubmit={(text) => send(text)}
              markActed={(toolCallId) => handleActed(activeClarification.messageId, toolCallId)}
            />
          ) : plainClarification && !busy ? (
            <ComposerPlainClarification
              question={plainClarification.question}
              options={plainClarification.options}
              onSubmit={(text) => send(text)}
            />
          ) : null}
          <AiChatInput
            value={input}
            onValueChange={setInput}
            onSubmit={() => send(input)}
            onOpenCheckIn={() => setCheckInOpen(true)}
            onExploreCards={() => setInput("I'd like to explore something with a few cards.")}
            busy={busy}
            cardsDisabled={tarotUnavailable}
          />
        </div>
      </div>
    </div>
  );
}
