import { z } from 'zod';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import type { User } from '@supabase/supabase-js';
import { getModel, isAiConfigured } from '@/lib/ai/provider';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { classify } from '@/lib/ai/safety';
import { createClient, getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().uuid().optional(),
  messages: z.array(z.custom<UIMessage>()).min(1),
});

function joinText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function titleFrom(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length === 0 ? 'New Reflection' : compact.slice(0, 48);
}

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return Response.json({ error: 'generation_failed' }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { sessionId, messages } = parsed.data;
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const userText = lastUser ? joinText(lastUser) : '';
  const safety = classify(userText);

  let user: User | null = null;
  if (isSupabaseServerConfigured()) {
    user = await getAuthUser();
  }

  const effectiveSessionId = sessionId;
  if (user) {
    if (!effectiveSessionId) {
      return Response.json({ error: 'session_required' }, { status: 400 });
    }
    const supabase = await createClient();
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
    const { error } = await supabase.from('messages').insert({
      session_id: effectiveSessionId,
      user_id: user.id,
      role: 'user',
      content: userText,
      meta: {},
    });
    if (error) return Response.json({ error: 'persist_failed' }, { status: 500 });
  }

  const result = streamText({
    model: getModel(),
    system: buildSystemPrompt({ profile: null, memories: [], safety }),
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(5),
  });

  if (user && effectiveSessionId) {
    const supabase = await createClient();
    const sid = effectiveSessionId;
    const userId = user.id;
    void (async () => {
      try {
        const text = await result.text;
        await supabase.from('messages').insert({
          session_id: sid,
          user_id: userId,
          role: 'assistant',
          content: text,
          meta: {},
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
      onError: (error) => {
        console.error('[chat] stream error', error);
        return 'An error occurred while generating the response.';
      },
    }),
  });
}
