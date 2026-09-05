'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isStaticToolUIPart } from 'ai';
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
import { appendMessage, getGuestSession, loadGuestStore, saveFollowUp, saveInsight as saveGuestInsight, saveMemory, saveReading, saveSession, updateMessageMeta } from '@/lib/guest/store';
import { guestSaveToast } from '@/lib/account-nudge';
import { activeAskUserPart, activePlainClarification, extractToolParts, isSystemNotice, joinUiText, pickInterruptedReading, staleInteractiveMessageIds, storedToUi, type ChatMessage } from '@/lib/chat/convert';
import { generateSessionTitle } from '@/lib/chat/session-actions';
import { titleFrom } from '@/lib/chat/title';
import { makeEntry } from '@/lib/journal/entries';
import type { DrawnCard } from '@/lib/tarot/types';
import type { MemoryCategory, StoredMessage, TarotReading } from '@/lib/types';

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

type ReadingsState = Record<string, { spreadId: string; cards: DrawnCard[]; createdAt: string }>;

export function ChatScreen({ initialSessionId }: { initialSessionId?: string }) {
  const { mode } = useDataMode();
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
  const [dismissedReadings, setDismissedReadingIds] = useState<Set<string>>(new Set());
  const [drawFailedSpread, setDrawFailedSpread] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [actedConfirms, setActedConfirms] = useState<Set<string>>(new Set());
  const [approvedContext, setApprovedContext] = useState<SearchHit[]>([]);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
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
    const declined = new Set<string>();
    const dismissed = new Set<string>();
    for (const m of messages) {
      for (const id of m.meta.actedToolCallIds ?? []) acted.add(id);
      if (m.meta.declined) declined.add(m.id);
      for (const id of m.meta.dismissedReadingIds ?? []) dismissed.add(id);
    }
    if (acted.size > 0) setActedConfirms(acted);
    if (declined.size > 0) setDeclinedToolCalls(declined);
    if (dismissed.size > 0) setDismissedReadingIds(dismissed);
    return dismissed;
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
        const dbMessages = (msgs.data ?? []) as unknown as StoredMessage[];
        if (dbMessages.length > 0) {
          initialMessageIds.current = new Set(dbMessages.map((m) => m.id));
          chat.setMessages(dbMessages.map(storedToUi));
          setLastActiveAt(dbMessages[dbMessages.length - 1].created_at);
        }
        const dbReadings: ReadingsState = {};
        for (const r of (reads.data ?? []) as unknown as TarotReading[]) {
          dbReadings[r.id] = { spreadId: r.spread_id, cards: r.cards, createdAt: r.created_at };
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
          chat.setMessages(session.messages.map(storedToUi));
        }
        const stored: ReadingsState = {};
        for (const r of session.readings) stored[r.id] = { spreadId: r.spread_id, cards: r.cards, createdAt: r.created_at };
        setReadings(stored);
        setLastActiveAt(session.updated_at);
        resumeInterruptedDraw(session.messages, stored, restoreConfirmState(session.messages));
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
            next[r.id] = { spreadId: r.spread_id, cards: r.cards, createdAt: r.created_at };
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
    if (mode === 'guest') {
      ensureGuestSession(trimmed);
      // Same id as the optimistic message above (guest mode only — account
      // sessions persist entirely server-side, PRD §34).
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
    setReadings((prev) => ({ ...prev, [payload.readingId]: { spreadId: payload.spreadId, cards: payload.cards, createdAt } }));
    saveReading(sessionId, {
      id: payload.readingId,
      session_id: sessionId,
      user_id: '',
      spread_id: payload.spreadId,
      seed: payload.seed,
      cards: payload.cards,
      created_at: createdAt,
    });
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

  const clarifyCard = async (readingId: string, cardId: string) => {
    if (tarotUnavailable) {
      toast.error(TAROT_UNAVAILABLE_MESSAGE);
      return;
    }
    const reading = readings[readingId];
    // A clarification is only meaningful when its interpret message can be
    // sent (send no-ops while a generation is in flight) — otherwise the
    // drawn card would appear with no reading attached.
    if (!reading || clarifyingCardId || chat.status !== 'ready') return;
    setClarifyingCardId(cardId);
    try {
      const res = await fetch('/api/tarot/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId, cardId, alreadyDrawn: reading.cards.map((c) => c.cardId), sessionId }),
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
      // Language-neutral event notice (see completeDraw): data only.
      send(
        `[Clarification · ${clarifier.cardId} → ${cardId}] ${clarifier.name} (${clarifier.orientation}) clarifies ${target?.name ?? cardId}`,
        { systemNotice: 'clarify', clarify: { readingId, targetCardId: cardId, clarifierCardId: clarifier.cardId } },
      );
    } finally {
      setClarifyingCardId(null);
    }
  };

  // ── Propose-then-confirm actions (PRD §39, §41, §62) ─────────────────

  const handleActed = (messageId: string, toolCallId: string) => {
    const next = new Set(actedConfirms).add(toolCallId);
    setActedConfirms(next);
    // Guests persist the resolved state so cards stay settled after
    // navigating away and back (PRD §62).
    if (mode === 'guest') updateMessageMeta(sessionId, messageId, { actedToolCallIds: [...next] });
  };

  const handleDeclined = (messageId: string) => {
    const next = new Set(declinedToolCalls).add(messageId);
    setDeclinedToolCalls(next);
    if (mode === 'guest') updateMessageMeta(sessionId, messageId, { declined: true });
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
    } else {
      saveGuestInsight(makeEntry({ body: text, entry_type: 'insight', source_session_id: sessionId, created_at: now, updated_at: now }));
      // Guest: save locally first, then offer the account as the value moment
      // (§14) — a non-blocking toast action, shown once (plan: Accounts §5).
      guestSaveToast('Insight saved to your journal.', router.push);
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

  const sessionSafety = useMemo(() => {
    const userMessages = chat.messages.filter(
      (message) => message.role === 'user' && !isSystemNotice(message.metadata),
    );
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
  const empty = chat.messages.length === 0;
  const onboardingEligible = useMemo(() => {
    if (busy || sessionSafety.highStakes) return false;
    const latestAssistant = [...chat.messages].reverse().find((message) => message.role === 'assistant');
    if (!latestAssistant || joinUiText(latestAssistant).trim().length === 0) return false;
    return latestAssistant.parts.every((part) => !part.type.startsWith('tool-'));
  }, [busy, chat.messages, sessionSafety.highStakes]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {mode === 'guest' && <OnboardingDialogs eligible={onboardingEligible} />}
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
                      declined={declinedToolCalls.has(message.id)}
                      stale={staleInteractiveIds.has(message.id)}
                      tarotUnavailable={tarotUnavailable}
                      dockedToolCallId={activeClarification?.messageId === message.id ? activeClarification.part.toolCallId : undefined}
                      onBeginReading={(spreadId) => void beginReading(spreadId)}
                      onClarifyRetry={(readingId, cardId) => void clarifyCard(readingId, cardId)}
                      onDecline={() => handleDeclined(message.id)}
                      confirm={{
                        actedIds: actedConfirms,
                        markActed: (toolCallId) => handleActed(message.id, toolCallId),
                        approvedEntryIds: new Set(approvedContext.map((c) => c.entryId)),
                        onSaveInsight: (text) => void saveInsightText(text),
                        onRememberThis: (content, category) => rememberThis(content, category),
                        onBringItIn: bringItIn,
                      }}
                    />
                    {messageText.trim().length > 0 && (
                      <div>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={savedMessageIds.has(message.id)}
                          aria-label="Save this reflection to your journal"
                          className="text-muted-foreground motion-reduce:transition-none"
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
