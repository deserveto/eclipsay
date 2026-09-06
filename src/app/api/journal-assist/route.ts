import { z } from 'zod';
import { generateText, isStepCount } from 'ai';
import { getModel, isAiConfigured } from '@/lib/ai/provider';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { classify } from '@/lib/ai/safety';
import { guardGeneratedOutput } from '@/lib/ai/output-guard';
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rate-limit';

// AI-assisted journal (PRD §38): generates an AI note; never rewrites the
// entry body. The client appends the note to entry.ai_notes.

const bodySchema = z.object({
  action: z.enum(['unpack', 'prompts', 'insight', 'summary']),
  content: z.string().min(1).max(20000),
});

const ACTION_PROMPTS: Record<string, string> = {
  unpack: 'Help the person unpack what they wrote. Offer a few angles they may not have considered, gently.',
  prompts: 'Offer 3 reflection prompts that would help them go deeper. Number them.',
  insight: 'Distill one potential insight from their writing, phrased tentatively and in service of their own reflection.',
  summary: 'Summarize what they seem to be feeling in two or three sentences, without diagnosing.',
};

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return Response.json({ error: 'generation_failed' }, { status: 500 });
  }
  // Audit A07: anonymous spend control.
  const limit = rateLimit(clientKey(request, 'journal-assist'), 10, 60_000);
  if (!limit.ok) return tooManyRequests(limit);
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 });

  const safety = classify(parsed.data.content);
  const system = `${buildSystemPrompt({ profile: null, memories: [], safety })}

You are assisting inside the person's private journal. ${ACTION_PROMPTS[parsed.data.action]}
Keep it brief (under 150 words). Do not rewrite their entry. Do not claim certainty about their feelings.`;

  try {
    const { model } = await getModel('utility');
    const result = await generateText({
      model,
      system,
      prompt: parsed.data.content,
      stopWhen: isStepCount(1),
    });
    const note = guardGeneratedOutput(result.text, 12);
    if (!note) return Response.json({ error: 'generation_failed' }, { status: 500 });
    return Response.json({ note, safety });
  } catch {
    return Response.json({ error: 'generation_failed' }, { status: 500 });
  }
}
