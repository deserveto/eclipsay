import { z } from 'zod';
import { generateText } from 'ai';
import { coerceTitle, titleFrom, titlePrompt, titleSystemPrompt } from '@/lib/chat/title';
import { getModel, isAiConfigured } from '@/lib/ai/provider';
import { createClient, getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { guardGeneratedOutput } from '@/lib/ai/output-guard';
import { isSystemNotice } from '@/lib/chat/convert';
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rate-limit';
import type { MessageMeta } from '@/lib/types';

// Title generation for a conversation (PRD §34). Works for both modes:
// guests send the first exchange's texts in the body (their sessions have no
// server row); accounts may omit them — the first stored messages are read
// here, RLS-scoped. The model only names the conversation; it never draws.

export const maxDuration = 30;

const bodySchema = z.object({
  userText: z.string().max(8000).optional(),
  assistantText: z.string().max(8000).optional(),
  // Manual regeneration from the sidebar may replace an earlier generated
  // title. The automatic first-reply trigger omits this and is guarded:
  // it only replaces the untouched placeholder, never a user rename.
  overwrite: z.boolean().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  if (!isAiConfigured()) {
    return Response.json({ error: 'generation_failed' }, { status: 500 });
  }
  // Audit A07: anonymous spend control.
  const limit = rateLimit(clientKey(request, 'title'), 20, 60_000);
  if (!limit.ok) return tooManyRequests(limit);
  const { sessionId } = await params;
  if (!z.string().uuid().safeParse(sessionId).success) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 });
  const { overwrite } = parsed.data;

  const user = isSupabaseServerConfigured() ? await getAuthUser() : null;

  let userText = parsed.data.userText?.trim() ?? '';
  let assistantText = parsed.data.assistantText?.trim() ?? '';
  if (user && (userText.length === 0 || assistantText.length === 0)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('messages')
      .select('role, content, meta')
      .eq('session_id', sessionId)
      .order('created_at');
    for (const row of (data ?? []) as { role: string; content: string; meta?: MessageMeta | null }[]) {
      if (userText.length === 0 && row.role === 'user' && !isSystemNotice(row.meta ?? undefined)) {
        userText = row.content;
      }
      if (assistantText.length === 0 && row.role === 'assistant') assistantText = row.content;
    }
  }
  if (userText.length === 0) return Response.json({ error: 'invalid_body' }, { status: 400 });

  let title: string;
  try {
    const selection = await getModel('utility');
    const { text } = await generateText({
      ...selection,
      system: titleSystemPrompt(),
      prompt: titlePrompt(userText, assistantText),
    });
    const coercedTitle = coerceTitle(text);
    const guardedTitle = guardGeneratedOutput(coercedTitle, 1);
    if (!guardedTitle || text.trim().length === 0) {
      console.error('[title] generation rejected', { reason: text.trim().length === 0 ? 'empty_output' : 'output_guard' });
      return Response.json({ error: 'generation_failed' }, { status: 500 });
    }
    title = guardedTitle;
  } catch (error) {
    // Never log raw provider errors: they may contain conversation text.
    console.error('[title] generation failed', {
      name: error instanceof Error ? error.name : 'unknown',
      ...((typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number')
        ? { statusCode: error.statusCode } : {}),
    });
    // Generation is cosmetic; the placeholder title stays and the client
    // surfaces nothing.
    return Response.json({ error: 'generation_failed' }, { status: 500 });
  }

  let applied = true;
  if (user && isSupabaseServerConfigured()) {
    const supabase = await createClient();
    const guarded = supabase
      .from('reflection_sessions')
      .update({ title })
      .eq('id', sessionId)
      .eq('user_id', user.id);
    const { data } = await (overwrite ? guarded : guarded.eq('title', titleFrom(userText)))
      .select('id')
      .maybeSingle();
    applied = data !== null;
  }

  return Response.json({ title, applied });
}
