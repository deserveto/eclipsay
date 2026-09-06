// Runtime AI configuration (plan: AI admin config). The active model per
// surface lives in `app_config` (key 'ai'), edited from /settings by an admin.
// Reads layer over env: DB row → OPENROUTER_MODEL → openrouter/free, so the
// app behaves exactly as before when nothing is configured. Values are
// non-secret (model ids only), hence the public-read policy on app_config.

import { z } from 'zod';
import { createClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const AI_CONFIG_KEY = 'ai';

export const REASONING_EFFORTS = ['low', 'medium', 'high'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const aiModelSlotSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  reasoning: z.object({ effort: z.enum(REASONING_EFFORTS) }).optional(),
});
export type AiModelSlot = z.infer<typeof aiModelSlotSchema>;

export const aiRuntimeConfigSchema = z.object({
  chat: aiModelSlotSchema,
  utility: aiModelSlotSchema,
});
export type AiRuntimeConfig = z.infer<typeof aiRuntimeConfigSchema>;
export type AiUsage = keyof AiRuntimeConfig;

export function defaultModelId(): string {
  return process.env.OPENROUTER_MODEL ?? 'openrouter/free';
}

export function defaultAiRuntimeConfig(): AiRuntimeConfig {
  const fallback = { provider: 'openrouter', model: defaultModelId() };
  return { chat: { ...fallback }, utility: { ...fallback } };
}

/** Lenient storage parse: unknown/malformed slots fall back individually. */
export function parseAiRuntimeConfig(raw: unknown): AiRuntimeConfig {
  const fallback = defaultAiRuntimeConfig();
  if (typeof raw !== 'object' || raw === null) return fallback;
  const row = raw as Record<string, unknown>;
  const slot = (usage: AiUsage): AiModelSlot => {
    const parsed = aiModelSlotSchema.safeParse(row[usage]);
    return parsed.success ? parsed.data : fallback[usage];
  };
  return { chat: slot('chat'), utility: slot('utility') };
}

// One read per minute per server instance, max — chat traffic never pays a
// DB round trip for config. After an admin save the writing instance is
// fresh immediately; other instances converge within the TTL.
const CACHE_TTL_MS = 60_000;
let cache: { config: AiRuntimeConfig; readAt: number } | null = null;

export function resetAiRuntimeConfigCache(): void {
  cache = null;
}

export async function getAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  if (cache && Date.now() - cache.readAt < CACHE_TTL_MS) return cache.config;
  const config = await readConfig();
  cache = { config, readAt: Date.now() };
  return config;
}

async function readConfig(): Promise<AiRuntimeConfig> {
  if (!isSupabaseServerConfigured()) return defaultAiRuntimeConfig();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', AI_CONFIG_KEY)
      .maybeSingle();
    if (error || !data) return defaultAiRuntimeConfig();
    return parseAiRuntimeConfig(data.value);
  } catch {
    return defaultAiRuntimeConfig();
  }
}

/** Service-role write — call only from the admin-gated API route. */
export async function saveAiRuntimeConfig(config: AiRuntimeConfig): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('app_config')
    .upsert(
      { key: AI_CONFIG_KEY, value: config, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  if (error) throw new Error(`Failed to save AI config: ${error.message}`);
  resetAiRuntimeConfigCache();
}
