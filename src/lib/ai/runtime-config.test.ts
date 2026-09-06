import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultAiRuntimeConfig,
  getAiRuntimeConfig,
  parseAiRuntimeConfig,
  resetAiRuntimeConfigCache,
} from './runtime-config';

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  isSupabaseServerConfigured: vi.fn(() => false),
}));

vi.mock('@/lib/supabase/server', () => supabaseMocks);

function mockConfigRow(result: { data: unknown; error: unknown }) {
  supabaseMocks.createClient.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => result,
        }),
      }),
    }),
  });
}

beforeEach(() => {
  resetAiRuntimeConfigCache();
  supabaseMocks.createClient.mockReset();
  supabaseMocks.isSupabaseServerConfigured.mockReturnValue(false);
  vi.stubEnv('OPENROUTER_MODEL', 'test/env-model');
});

describe('parseAiRuntimeConfig', () => {
  it('returns env defaults for a missing or non-object row', () => {
    const fallback = defaultAiRuntimeConfig();
    expect(parseAiRuntimeConfig(null)).toEqual(fallback);
    expect(parseAiRuntimeConfig('nope')).toEqual(fallback);
  });

  it('keeps valid slots and falls back per slot, not per row', () => {
    const fallback = defaultAiRuntimeConfig();
    const parsed = parseAiRuntimeConfig({
      chat: { provider: 'anthropic', model: 'claude-x', reasoning: { effort: 'high' } },
      utility: { provider: 'openrouter' }, // missing model → falls back
    });
    expect(parsed.chat).toEqual({
      provider: 'anthropic',
      model: 'claude-x',
      reasoning: { effort: 'high' },
    });
    expect(parsed.utility).toEqual(fallback.utility);
  });

  it('rejects unknown reasoning efforts', () => {
    const parsed = parseAiRuntimeConfig({
      chat: { provider: 'openrouter', model: 'm', reasoning: { effort: 'maximal' } },
      utility: { provider: 'openrouter', model: 'm' },
    });
    expect(parsed.chat).toEqual(defaultAiRuntimeConfig().chat);
  });
});

describe('getAiRuntimeConfig', () => {
  it('falls back to env defaults when supabase is not configured', async () => {
    const config = await getAiRuntimeConfig();
    expect(config).toEqual(defaultAiRuntimeConfig());
    expect(supabaseMocks.createClient).not.toHaveBeenCalled();
  });

  it('reads the app_config row when supabase is configured', async () => {
    supabaseMocks.isSupabaseServerConfigured.mockReturnValue(true);
    mockConfigRow({
      data: {
        value: {
          chat: { provider: 'poolside', model: 'poolside/laguna-s-2.1' },
          utility: { provider: 'openrouter', model: 'test/env-model' },
        },
      },
      error: null,
    });

    const config = await getAiRuntimeConfig();
    expect(config.chat).toEqual({ provider: 'poolside', model: 'poolside/laguna-s-2.1' });
  });

  it('falls back to defaults when the row is missing or errored', async () => {
    supabaseMocks.isSupabaseServerConfigured.mockReturnValue(true);
    mockConfigRow({ data: null, error: null });
    expect(await getAiRuntimeConfig()).toEqual(defaultAiRuntimeConfig());

    resetAiRuntimeConfigCache();
    mockConfigRow({ data: null, error: { message: 'rls' } });
    expect(await getAiRuntimeConfig()).toEqual(defaultAiRuntimeConfig());
  });

  it('caches the read so chat traffic pays at most one DB hit per TTL', async () => {
    supabaseMocks.isSupabaseServerConfigured.mockReturnValue(true);
    mockConfigRow({ data: { value: defaultAiRuntimeConfig() }, error: null });

    await getAiRuntimeConfig();
    await getAiRuntimeConfig();
    expect(supabaseMocks.createClient).toHaveBeenCalledTimes(1);
  });
});
