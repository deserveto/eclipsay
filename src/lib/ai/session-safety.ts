import type { MessageMeta } from '@/lib/types';
import { classifyTranscript, type SafetyClassification } from './safety';
import { createClient } from '@/lib/supabase/server';

type SessionMessageRow = {
  role: string;
  content: string;
  meta?: MessageMeta | null;
};

export async function getAccountSessionSafety(sessionId: string, userId: string): Promise<SafetyClassification> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('messages')
    .select('role, content, meta')
    .eq('session_id', sessionId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  // Audit A27: stored meta is written from client-controlled request
  // metadata, so it must never exclude a message from classification. Tarot
  // event notices carry only card summaries — classifying them is safe.
  const userTexts = ((data ?? []) as SessionMessageRow[])
    .filter((message) => message.role === 'user')
    .map((message) => message.content);
  return classifyTranscript(userTexts);
}
