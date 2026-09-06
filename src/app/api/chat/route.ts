import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  hasToolCall,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import type { User } from '@supabase/supabase-js';
import { getModel, isAiConfigured } from '@/lib/ai/provider';
import { buildSystemPrompt, type MemoryForPrompt } from '@/lib/ai/system-prompt';
import { isTeenAge } from '@/lib/auth/validation';
import { classifyTranscript } from '@/lib/ai/safety';
import { CHAT_BUDGETS, chatBodySchema, validateUIMessages } from '@/lib/ai/request-validation';
import { getAccountSessionSafety } from '@/lib/ai/session-safety';
import { tarotUnavailableTransform } from '@/lib/ai/tarot-output-guard';
import { createTarotTools } from '@/lib/ai/tools';
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { createClient, getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import type { MessageMeta, PersistedToolPart, Profile, SpreadId } from '@/lib/types';

export const maxDuration = 60;

function joinText(message: UIMessage): string {
  let text = '';
  for (const part of message.parts) {
    if (part.type === 'text') text += part.text;
  }
  return text;
}

function titleFrom(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length === 0 ? 'New Reflection' : compact.slice(0, 48);
}

const READING_INTENT = /\b(?:tarot|cards?|card\s+reading|reading|spread)\b/i;
const SPECIFIC_READING_CONTEXT =
  /\b(?:about|regarding|whether|between|which|decision|choice|career|work|relationship|family|love|goal|situation|question|feeling|focus|guidance)\b/i;

function requiresStructuredClarification(text: string): boolean {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 0 && compact.length <= 120 && READING_INTENT.test(compact) && !SPECIFIC_READING_CONTEXT.test(compact);
}

// Tool outputs are produced by our own tool factories (tools.ts) — these are
// the persistence boundary's named contracts.
type RecommendReadingOutput = { recommendedSpreadId: SpreadId; context?: string };
type ClarifyOutput = { readingId: string; cardId: string; clarifier?: { cardId: string } };

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return Response.json({ error: 'generation_failed' }, { status: 500 });
  }

  // Audit A07: anonymous spend control before any expensive work.
  const limit = rateLimit(clientKey(request, 'chat'), 30, 5 * 60_000);
  if (!limit.ok) return tooManyRequests(limit);

  // Audit A06: bound the raw payload before parsing it.
  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (rawText.length > CHAT_BUDGETS.maxBodyChars) {
    return Response.json({ error: 'payload_too_large' }, { status: 413 });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(rawText) as unknown;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = chatBodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  const { sessionId, messages, guestMemory, guestAdultConfirmed } = parsed.data;
  // Audit A06: structural validation with budgets — malformed shapes must
  // return a structured 400, never reach provider conversion.
  const messagesCheck = validateUIMessages(messages);
  if (!messagesCheck.ok) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  const uiMessages = messages as unknown as UIMessage[];

  const lastUser = [...uiMessages].reverse().find((m) => m.role === 'user');
  // Audit A27: metadata is client-controlled and must never gate the safety
  // classifier. Every user message's text is classified, including tarot
  // event notices — their card summaries are benign, and over-matching is safe.
  const userMessages = uiMessages.filter((message) => message.role === 'user');
  const userText = lastUser ? joinText(lastUser) : '';
  const requestSessionSafety = classifyTranscript(userMessages.map(joinText));
  // Tarot event notices (PRD §25, §32): the client announces a draw or a
  // clarification draw as bracketed data. The interpret directive is injected
  // into the system prompt so the notice's wording never sets the reply
  // language — the model answers in the user's own language instead.
  const lastMeta = (lastUser?.metadata ?? {}) as MessageMeta;
  const tarotEvent = lastMeta.systemNotice ?? (lastMeta.readingId ? ('draw' as const) : lastMeta.clarify ? ('clarify' as const) : undefined);

  let user: User | null = null;
  let profile: Profile | null = null;
  let memories: MemoryForPrompt[] = [];
  if (isSupabaseServerConfigured()) {
    user = await getAuthUser();
  }

  const effectiveSessionId = sessionId;
  // Audit A29: the STICKY session policy — request transcript plus, for
  // accounts, everything already stored on the session — drives tools AND
  // the system prompt, so a neutral follow-up after high-stakes content keeps
  // the grounded-response instructions.
  let sessionSafety = requestSessionSafety;
  if (user) {
    if (!effectiveSessionId) {
      return Response.json({ error: 'session_required' }, { status: 400 });
    }
    try {
      const accountSafety = await getAccountSessionSafety(effectiveSessionId, user.id);
      sessionSafety = {
        highStakes: requestSessionSafety.highStakes || accountSafety.highStakes,
        crisis: requestSessionSafety.crisis || accountSafety.crisis,
      };
    } catch {
      return Response.json({ error: 'safety_check_failed' }, { status: 500 });
    }
  }
  const tarotUnavailable = sessionSafety.highStakes;
  const forceStructuredClarification =
    !tarotUnavailable && !tarotEvent && requiresStructuredClarification(userText);
  if (tarotUnavailable && tarotEvent) {
    return Response.json({ error: 'tarot_unavailable' }, { status: 403 });
  }

  if (user) {
    if (!effectiveSessionId) {
      return Response.json({ error: 'session_required' }, { status: 400 });
    }
    const supabase = await createClient();

    // Ensure the profile row exists and personalize (PRD §12, §59).
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (existingProfile) {
      profile = existingProfile;
    } else {
      const seedProfile = {
        id: user.id,
        // Identity fields stay null here: this fallback row is created for
        // non-signup sessions (legacy/OAuth users own them via the trigger
        // or /api/auth/complete-profile), never invented by chat.
        full_name: null,
        display_name: null,
        date_of_birth: null,
        reflection_goal: null,
        tarot_familiarity: null,
        memory_enabled: true,
        created_at: new Date().toISOString(),
      };
      await supabase.from('profiles').upsert(seedProfile);
    }

    // Approved memories feed the prompt only when memory_enabled (PRD §59).
    if (profile?.memory_enabled) {
      const { data: memoryRows } = await supabase
        .from('memories')
        .select('category, content')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(20);
      memories = (memoryRows ?? []) as MemoryForPrompt[];
    }

    const { data: existing } = await supabase
      .from('reflection_sessions')
      .select('id')
      .eq('id', effectiveSessionId)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('reflection_sessions').insert({
        id: effectiveSessionId,
        user_id: user.id,
        title: titleFrom(userText),
      });
      if (error) return Response.json({ error: 'session_create_failed' }, { status: 500 });
    }

    // Audit A32: persist each user turn once by its stable client message id.
    // Retries/regeneration replay the same transcript; the unique index on
    // (session_id, client_id) makes duplicate rows impossible.
    const clientId = typeof lastUser?.id === 'string' ? lastUser.id : null;
    if (clientId) {
      const { data: alreadyPersisted } = await supabase
        .from('messages')
        .select('id')
        .eq('session_id', effectiveSessionId)
        .eq('client_id', clientId)
        .maybeSingle();
      if (!alreadyPersisted) {
        const { error } = await supabase.from('messages').insert({
          session_id: effectiveSessionId,
          user_id: user.id,
          role: 'user',
          content: userText,
          meta: lastMeta,
          client_id: clientId,
        });
        // A concurrent request may have won the idempotent insert; stream anyway.
        if (error && error.code !== '23505') {
          return Response.json({ error: 'persist_failed' }, { status: 500 });
        }
      }
    } else {
      const { error } = await supabase.from('messages').insert({
        session_id: effectiveSessionId,
        user_id: user.id,
        role: 'user',
        content: userText,
        meta: lastMeta,
      });
      if (error) return Response.json({ error: 'persist_failed' }, { status: 500 });
    }
  } else if (guestMemory?.enabled) {
    // Guests keep data client-side (PRD §13); memories reach the prompt only when
    // this request explicitly opts in, sanitized like the account path (PRD §59).
    memories = guestMemory.items
      .map((item) => ({ category: item.category, content: item.content.trim() }))
      .filter((item) => item.content.length > 0)
      .slice(0, 20);
  }

  let approvedContext: { title: string; body: string }[] = [];
  const approvedMeta = (lastUser?.metadata ?? {}) as { approvedContext?: { entryId: string }[] };
  const approvedIds = (approvedMeta.approvedContext ?? []).map((c) => c.entryId).filter(Boolean);
  if (user && approvedIds.length > 0 && isSupabaseServerConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('journal_entries')
      .select('title, body')
      .in('id', approvedIds)
      .eq('user_id', user.id);
    approvedContext = (data ?? []) as { title: string; body: string }[];
  }

  const tools = tarotUnavailable ? undefined : createTarotTools({ user });

  let modelSelection;
  try {
    modelSelection = await getModel('chat');
  } catch {
    return Response.json({ error: 'generation_failed' }, { status: 500 });
  }

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(uiMessages);
  } catch {
    // Audit A06: a payload that passed budget checks but not SDK conversion
    // is still a client error — structured 400, not a 500.
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const result = streamText({
    model: modelSelection.model,
    system: buildSystemPrompt({
      profile,
      memories,
      // Audit A29: sticky session safety, not just the current message.
      safety: sessionSafety,
      approvedContext,
      tarotEvent,
      tarotUnavailable,
      // Privacy boundary (plan: Accounts §7): only the derived 13–17 band
      // crosses into the prompt — never the birth date, full name, or email.
      // Audit A36: guests are treated conservatively (teen) unless this
      // browser explicitly completed the age step as adult.
      teenUser: user ? isTeenAge(profile?.date_of_birth) : guestAdultConfirmed !== true,
    }),
    messages: modelMessages,
    // Reasoning policy (effort + payload exclusion) lives in the provider
    // seam; the UI stream boundary also strips reasoning parts.
    providerOptions: modelSelection.providerOptions,
    maxOutputTokens: modelSelection.maxOutputTokens,
    stopWhen: [isStepCount(5), hasToolCall('recommend_reading'), hasToolCall('ask_user')],
    toolChoice: forceStructuredClarification ? { type: 'tool', toolName: 'ask_user' } : undefined,
    tools,
    experimental_transform: tarotUnavailable ? tarotUnavailableTransform() : undefined,
  });

  if (user && effectiveSessionId) {
    const supabase = await createClient();
    const userId = user.id;
    const sid = effectiveSessionId;
    void (async () => {
      try {
        const [text, responseMessages] = await Promise.all([result.text, result.responseMessages]);
        const meta: MessageMeta = {
          // Persist the sticky crisis classification so surfaces can react on
          // load without re-classifying (plan: Safety classifier, audit A29).
          ...(sessionSafety.crisis ? { crisis: true } : {}),
        };
        // Serialize every static tool part so question chips, recommendation
        // cards, and confirm proposals re-render on hydration (PRD §62).
        const tools: PersistedToolPart[] = [];
        for (const message of responseMessages) {
          const content = typeof message.content === 'string' ? [] : message.content;
          for (const part of content) {
            if (part.type !== 'tool-result') continue;
            tools.push({
              type: `tool-${part.toolName}`,
              toolCallId: part.toolCallId,
              state: 'output-available',
              output: part.output,
            });
            const output = part.output as unknown as RecommendReadingOutput | ClarifyOutput | undefined;
            if (part.toolName === 'recommend_reading' && output && 'recommendedSpreadId' in output) {
              meta.readingRecommendation = {
                recommendedSpreadId: output.recommendedSpreadId,
                context: output.context ?? '',
              };
            }
            if (part.toolName === 'request_clarification' && output && 'clarifier' in output && output.clarifier) {
              meta.clarify = {
                readingId: output.readingId,
                targetCardId: output.cardId,
                clarifierCardId: output.clarifier.cardId,
              };
            }
          }
        }
        if (tools.length > 0) meta.tools = tools;
        await supabase.from('messages').insert({
          session_id: sid,
          user_id: userId,
          role: 'assistant',
          content: text,
          meta,
        });
        await supabase.from('reflection_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sid);
      } catch {
        // Persistence failure must not break the streamed response.
      }
    })();
  }

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendReasoning: false,
      onError: (error) => {
        console.error('[chat] stream error', error instanceof Error ? error.message : 'unknown');
        return 'An error occurred while generating the response.';
      },
    }),
  });
}
