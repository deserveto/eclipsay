import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getModel, isAiConfigured, resetProviderRegistryForTests } from './provider';
import type { AiModelSlot, AiRuntimeConfig } from './runtime-config';

// The registry resolves whatever runtime config says; config itself is the
// seam mocked here. Provider construction reads env directly, so each test
// stubs exactly the keys it wants configured.
const configMocks = vi.hoisted(() => ({
  getAiRuntimeConfig: vi.fn(),
}));

vi.mock('@/lib/ai/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAiRuntimeConfig: configMocks.getAiRuntimeConfig,
}));
const ALL_PROVIDER_KEYS = [
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'POOLSIDE_API_KEY',
];

function stubProviderEnv(present: string[]) {
  for (const key of ALL_PROVIDER_KEYS) {
    vi.stubEnv(key, present.includes(key) ? 'test-key' : (undefined as unknown as string));
  }
}

function configWith(chat: AiModelSlot, utility: AiModelSlot): AiRuntimeConfig {
  return { chat, utility };
}

beforeEach(() => {
  resetProviderRegistryForTests();
  configMocks.getAiRuntimeConfig.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isAiConfigured', () => {
  it('is true when any provider key exists and false with none', () => {
    stubProviderEnv([]);
    expect(isAiConfigured()).toBe(false);
    stubProviderEnv(['OPENROUTER_API_KEY']);
    expect(isAiConfigured()).toBe(true);
  });
});

describe('getModel', () => {
  it('resolves an openrouter slot with reasoning excluded by default', async () => {
    stubProviderEnv(['OPENROUTER_API_KEY']);
    configMocks.getAiRuntimeConfig.mockResolvedValue(
      configWith(
        { provider: 'openrouter', model: 'free-x' },
        { provider: 'openrouter', model: 'free-x' },
      ),
    );

    const selection = await getModel('chat');
    expect(selection.model).toMatchObject({ modelId: 'free-x' });
    expect(selection.providerOptions).toEqual({
      openrouter: { reasoning: { exclude: true } },
    });
    expect(selection.maxOutputTokens).toBeUndefined();
  });

  it('applies the configured reasoning effort for openrouter chat', async () => {
    stubProviderEnv(['OPENROUTER_API_KEY']);
    configMocks.getAiRuntimeConfig.mockResolvedValue(
      configWith(
        { provider: 'openrouter', model: 'free-x', reasoning: { effort: 'high' } },
        { provider: 'openrouter', model: 'free-x' },
      ),
    );

    const selection = await getModel('chat');
    expect(selection.providerOptions).toEqual({
      openrouter: { reasoning: { effort: 'high', exclude: true } },
    });
  });

  it('maps anthropic thinking to a budget and raises the output ceiling', async () => {
    stubProviderEnv(['ANTHROPIC_API_KEY']);
    configMocks.getAiRuntimeConfig.mockResolvedValue(
      configWith(
        { provider: 'anthropic', model: 'claude-x', reasoning: { effort: 'medium' } },
        { provider: 'anthropic', model: 'claude-x' },
      ),
    );

    const selection = await getModel('chat');
    expect(selection.model).toMatchObject({ modelId: 'claude-x' });
    expect(selection.providerOptions).toEqual({
      anthropic: { thinking: { type: 'enabled', budgetTokens: 4096 } },
    });
    // Anthropic requires max_tokens > thinking budget.
    expect(selection.maxOutputTokens).toBeGreaterThan(4096);
  });

  it('never lets the utility surface think, even if its slot says so', async () => {
    stubProviderEnv(['ANTHROPIC_API_KEY']);
    configMocks.getAiRuntimeConfig.mockResolvedValue(
      configWith(
        { provider: 'anthropic', model: 'claude-x' },
        { provider: 'anthropic', model: 'claude-x', reasoning: { effort: 'high' } },
      ),
    );

    const selection = await getModel('utility');
    expect(selection.providerOptions).toEqual({});
    expect(selection.maxOutputTokens).toBeUndefined();
  });

  it('treats poolside as openai-compatible but not reasoning-capable', async () => {
    stubProviderEnv(['POOLSIDE_API_KEY']);
    configMocks.getAiRuntimeConfig.mockResolvedValue(
      configWith(
        { provider: 'poolside', model: 'laguna-s-2.1', reasoning: { effort: 'low' } },
        { provider: 'poolside', model: 'laguna-s-2.1' },
      ),
    );

    const selection = await getModel('chat');
    expect(selection.model).toMatchObject({ modelId: 'laguna-s-2.1' });
    expect(selection.providerOptions).toEqual({});
  });

  it('falls back to the first CONFIGURED provider when a persisted slot goes stale (audit A35)', async () => {
    stubProviderEnv(['OPENROUTER_API_KEY']);
    configMocks.getAiRuntimeConfig.mockResolvedValue(
      configWith(
        // A slot saved while an Anthropic key existed; the key is gone now.
        { provider: 'anthropic', model: 'claude-x' },
        { provider: 'anthropic', model: 'claude-x' },
      ),
    );

    // Old behavior: cryptic registry rejection. A35: resolve to a usable
    // openrouter default with a warning instead.
    const selection = await getModel('chat');
    expect(selection.model).toMatchObject({ modelId: 'openrouter/free' });
  });

  it('resolves a direct-provider-only setup with a usable default model (audit A35)', async () => {
    stubProviderEnv(['ANTHROPIC_API_KEY']);
    configMocks.getAiRuntimeConfig.mockResolvedValue(
      configWith(
        { provider: 'openrouter', model: 'openrouter/free' },
        { provider: 'openrouter', model: 'openrouter/free' },
      ),
    );

    const selection = await getModel('chat');
    expect(selection.model).toMatchObject({ modelId: 'claude-3-5-haiku-latest' });
  });

  it('fails with an actionable message when no provider key exists at all', async () => {
    stubProviderEnv([]);
    configMocks.getAiRuntimeConfig.mockResolvedValue(
      configWith(
        { provider: 'openrouter', model: 'openrouter/free' },
        { provider: 'openrouter', model: 'openrouter/free' },
      ),
    );

    await expect(getModel('chat')).rejects.toThrow(/No AI provider is configured/i);
  });
});
