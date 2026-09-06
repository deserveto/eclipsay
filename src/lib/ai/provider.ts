import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  createProviderRegistry,
  type LanguageModel,
  type ProviderRegistryProvider,
} from 'ai';
import type { ProviderV3, ProviderV4 } from '@ai-sdk/provider';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import {
  defaultModelId,
  getAiRuntimeConfig,
  type AiUsage,
  type ReasoningEffort,
} from '@/lib/ai/runtime-config';

// Multi-provider registry (plan: AI admin config). A provider exists only when
// its API key is configured; the active model per surface (chat / utility)
// comes from app_config via runtime-config, layered over OPENROUTER_MODEL as
// fallback — so with nothing configured the app behaves exactly as before.
// The registry is the single model seam: chat, journal-assist, and session
// titles all resolve through getModel(usage). Tarot purity is untouched — the
// model still never draws (PRD §25–§26).

export const PROVIDER_IDS = ['openrouter', 'openai', 'anthropic', 'google', 'poolside'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

const PROVIDER_ENV: Record<ProviderId, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  poolside: 'POOLSIDE_API_KEY',
};

/** Providers whose reasoning effort this registry knows how to express. */
export const REASONING_CAPABLE: readonly ProviderId[] = ['openrouter', 'openai', 'anthropic', 'google'];

export function configuredProviderIds(): ProviderId[] {
  return PROVIDER_IDS.filter((id) => Boolean(process.env[PROVIDER_ENV[id]]));
}

export function isReasoningCapable(providerId: string): boolean {
  return (REASONING_CAPABLE as readonly string[]).includes(providerId);
}

export function isAiConfigured(): boolean {
  return configuredProviderIds().length > 0;
}

let registryCache: { key: string; registry: ProviderRegistryProvider } | null = null;

/** Test seam: forget the memoized registry after env changes. */
export function resetProviderRegistryForTests(): void {
  registryCache = null;
}

function getRegistry(): ProviderRegistryProvider {
  const ids = configuredProviderIds();
  const key = ids.join(',');
  if (registryCache?.key === key) return registryCache.registry;
  const providers: Record<string, ProviderV4 | ProviderV3> = {};
  for (const id of ids) providers[id] = buildProvider(id);
  registryCache = { key, registry: createProviderRegistry(providers) };
  return registryCache.registry;
}

function buildProvider(id: ProviderId): ProviderV4 | ProviderV3 {
  switch (id) {
    case 'openrouter':
      return createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY ?? '',
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
          'X-Title': 'Eclipsay',
        },
      });
    case 'poolside':
      // OpenAI-compatible hosted endpoint (https://docs.poolside.ai/api/overview)
      return createOpenAICompatible({
        name: 'poolside',
        baseURL: 'https://inference.poolside.ai/v1',
        apiKey: process.env.POOLSIDE_API_KEY ?? '',
      });
    case 'openai':
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    case 'anthropic':
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    case 'google':
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
  }
}

export interface AiModelSelection {
  model: LanguageModel;
  providerOptions: ProviderOptions;
  /** Set when a provider needs an explicit ceiling above its thinking budget. */
  maxOutputTokens?: number;
}

// Anthropic requires max_tokens > thinking budget; Google takes a raw token
// budget instead of a named effort.
const ANTHROPIC_THINKING_BUDGET: Record<ReasoningEffort, number> = { low: 2048, medium: 4096, high: 8192 };
const GOOGLE_THINKING_BUDGET: Record<ReasoningEffort, number> = { low: 1024, medium: 4096, high: 8192 };

// Audit A35: every provider that can be key-configured gets an explicit,
// usable default model, so a single direct-provider key (and no DB config)
// still resolves. Poolside has no known public default — it fails loudly
// with an actionable message instead of a cryptic registry error.
function fallbackModelId(provider: ProviderId): string {
  switch (provider) {
    case 'openrouter':
      return defaultModelId();
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-haiku-latest';
    case 'google':
      return 'gemini-2.0-flash';
    case 'poolside':
      throw new Error(
        'POOLSIDE_API_KEY is set but no model is configured for it — pick one in Settings → AI model.',
      );
  }
}

/**
 * Resolves the active model for a surface into everything the AI SDK call
 * needs: the model itself, provider options (reasoning), and an optional
 * output ceiling. Thinking is a chat-only affordance — utility calls (session
 * titles, journal notes) never pay for reasoning, whatever the slot says.
 */
export async function getModel(usage: AiUsage): Promise<AiModelSelection> {
  const config = await getAiRuntimeConfig();
  let slot = config[usage];
  const configured = configuredProviderIds();
  if (configured.length === 0) {
    throw new Error('No AI provider is configured — set at least one provider API key.');
  }
  // Audit A35: a persisted slot (or the OpenRouter default) is only usable
  // if that provider's key is still configured. Stale slots fall back to the
  // first configured provider with a warning naming the exact fix.
  if (!(configured as string[]).includes(slot.provider)) {
    const provider = configured[0];
    const model = fallbackModelId(provider);
    console.warn(
      `[ai] ${usage} slot '${slot.provider}:${slot.model}' is unusable because that provider has no API key; ` +
        `falling back to ${provider}:${model}. Provide the key or update Settings → AI model.`,
    );
    slot = { provider, model };
  }
  const model = getRegistry().languageModel(`${slot.provider}:${slot.model}`);
  const effort = usage === 'chat' ? slot.reasoning?.effort : undefined;
  return { model, ...reasoningSelection(slot.provider, effort) };
}

function reasoningSelection(
  providerId: string,
  effort: ReasoningEffort | undefined,
): Omit<AiModelSelection, 'model'> {
  if (!isReasoningCapable(providerId)) return { providerOptions: {} };
  if (providerId === 'openrouter') {
    return {
      providerOptions: {
        openrouter: {
          // `exclude` keeps reasoning out of the persisted/streamed payload;
          // `effort` controls whether the model thinks at all.
          reasoning: effort ? { effort, exclude: true } : { exclude: true },
        },
      },
    };
  }
  if (!effort) return { providerOptions: {} };
  switch (providerId) {
    case 'openai':
      return { providerOptions: { openai: { reasoningEffort: effort } } };
    case 'anthropic': {
      const budgetTokens = ANTHROPIC_THINKING_BUDGET[effort];
      return {
        providerOptions: { anthropic: { thinking: { type: 'enabled', budgetTokens } } },
        maxOutputTokens: budgetTokens + 8192,
      };
    }
    case 'google':
      return {
        providerOptions: { google: { thinkingConfig: { thinkingBudget: GOOGLE_THINKING_BUDGET[effort] } } },
      };
    default:
      // Reasoning-capable set grew without a mapping — fail open, no thinking.
      return { providerOptions: {} };
  }
}
