'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isStaticToolUIPart } from 'ai';
import { ArrowUp, RefreshCw, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Markdown } from '@/components/chat/markdown';
import { OnboardingDialogs } from '@/components/chat/onboarding-dialogs';
import { useDataMode } from '@/hooks/use-data-mode';
import { track } from '@/lib/analytics';
import { joinUiText, storedToUi } from '@/lib/chat/convert';
import { appendMessage, getGuestSession, saveSession } from '@/lib/guest/store';

function titleFrom(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length === 0 ? 'New Reflection' : compact.slice(0, 48);
}

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

  const chat = useChat({
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
        meta: {},
        created_at: new Date().toISOString(),
      });
    },
  });

  // Restore a persisted transcript on deep link (never re-generate, PRD §26).
  useEffect(() => {
    if (!initialSessionId) return;
    const session = getGuestSession(initialSessionId);
    if (session && session.messages.length > 0) {
      chat.setMessages(session.messages.map(storedToUi));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId]);

  // Pre-fill composer from "Reflect with tarot" entry action (Phase 3 completes the flow).
  useEffect(() => {
    if (searchParams.get('tarot') === '1' && chat.messages.length === 0) {
      setInput("I'd like to explore something with a few cards.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const send = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || chat.status !== 'ready') return;
    const isNew = !getGuestSession(sessionId);
    if (isNew) {
      const now = new Date().toISOString();
      saveSession({
        id: sessionId,
        user_id: '',
        title: titleFrom(trimmed),
        created_at: now,
        updated_at: now,
        messages: [],
        readings: [],
      });
      track('reflection_started');
      window.history.replaceState(null, '', `/reflect/${sessionId}`);
    }
    appendMessage(sessionId, {
      id: crypto.randomUUID(),
      session_id: sessionId,
      user_id: '',
      role: 'user',
      content: trimmed,
      meta: {},
      created_at: new Date().toISOString(),
    });
    lastSent.current = trimmed;
    setInput('');
    chat.sendMessage({ text: trimmed });
  };

  const busy = chat.status === 'submitted' || chat.status === 'streaming';
  const failed = chat.status === 'error';
  const empty = chat.messages.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {mode === 'guest' && <OnboardingDialogs />}

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
              {chat.messages.map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5 text-[15px] leading-7 whitespace-pre-wrap">
                      {joinUiText(message)}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex flex-col gap-2">
                    <Markdown>{joinUiText(message)}</Markdown>
                    {message.parts.filter(isStaticToolUIPart).map((part) => (
                      <div
                        key={part.toolCallId}
                        className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
                      >
                        Preparing something…
                      </div>
                    ))}
                  </div>
                ),
              )}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                  <span className="size-2 animate-pulse rounded-full bg-primary/60" />
                  Reflecting…
                </div>
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
