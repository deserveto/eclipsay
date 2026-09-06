import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from './route';
import { resetAiRuntimeConfigCache } from '@/lib/ai/runtime-config';

// Route test: gate mapping, schema validation, and the service-role write
// boundary. runtime-config runs real (its DB seam is mocked); the provider
// whitelist is mocked to a fixed enabled set.
const mocks = vi.hoisted(() => ({
  adminGate: vi.fn<() => Promise<string | null>>(async () => null),
  configuredProviderIds: vi.fn(() => ['openrouter']),
  isSupabaseAdminConfigured: vi.fn(() => true),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/admin', () => ({ adminGate: mocks.adminGate }));
vi.mock('@/lib/ai/provider', () => ({
  configuredProviderIds: mocks.configuredProviderIds,
  REASONING_CAPABLE: ['openrouter'],
}));
vi.mock('@/lib/supabase/server', () => ({ isSupabaseServerConfigured: vi.fn(() => false) }));
vi.mock('@/lib/supabase/admin', () => ({
  isSupabaseAdminConfigured: mocks.isSupabaseAdminConfigured,
  createAdminClient: mocks.createAdminClient,
}));

function mockUpsert(error: unknown = null) {
  const upsert = vi.fn(async () => ({ error }));
  mocks.createAdminClient.mockReturnValue({ from: () => ({ upsert }) });
  return upsert;
}

function putJson(body: unknown): Promise<Response> {
  return PUT(
    new Request('http://localhost/api/admin/ai-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

const VALID_BODY = {
  chat: { provider: 'openrouter', model: 'free-x', reasoning: { effort: 'high' } },
  utility: { provider: 'openrouter', model: 'free-x' },
};

beforeEach(() => {
  resetAiRuntimeConfigCache();
  vi.stubEnv('OPENROUTER_MODEL', 'test/env-model');
  mocks.adminGate.mockClear().mockResolvedValue(null);
  mocks.configuredProviderIds.mockReturnValue(['openrouter']);
  mocks.isSupabaseAdminConfigured.mockReturnValue(true);
  mocks.createAdminClient.mockReset();
});

describe('gate mapping', () => {
  it.each([
    ['admin_disabled', 403],
    ['unauthenticated', 401],
    ['forbidden', 403],
  ])('maps %s to %s', async (code, status) => {
    mocks.adminGate.mockResolvedValue(code);
    const get = await GET();
    expect(get.status).toBe(status);
    expect(await get.json()).toEqual({ error: code });
  });
});

describe('GET', () => {
  it('returns the resolved config, enabled providers, and reasoning capability', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.providers).toEqual(['openrouter']);
    expect(json.reasoningCapable).toEqual(['openrouter']);
    expect(json.config).toEqual({
      chat: { provider: 'openrouter', model: 'test/env-model' },
      utility: { provider: 'openrouter', model: 'test/env-model' },
    });
  });
});

describe('PUT', () => {
  it('persists a valid config through the service-role client', async () => {
    const upsert = mockUpsert();

    const res = await putJson(VALID_BODY);
    expect(res.status).toBe(200);
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      {
        key: 'ai',
        value: VALID_BODY,
        updated_at: expect.any(String),
      },
      { onConflict: 'key' },
    );
  });

  it('rejects a provider that is not enabled', async () => {
    mockUpsert();
    const res = await putJson({
      ...VALID_BODY,
      chat: { provider: 'anthropic', model: 'claude-x' },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects a body missing a slot', async () => {
    mockUpsert();
    const res = await putJson({ chat: { provider: 'openrouter', model: 'free-x' } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
  });

  it('reports save failures as save_failed', async () => {
    mockUpsert({ message: 'db down' });
    const res = await putJson(VALID_BODY);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'save_failed' });
  });

  it('reports a missing service-role key as not_configured', async () => {
    mocks.isSupabaseAdminConfigured.mockReturnValue(false);
    const res = await putJson(VALID_BODY);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'not_configured' });
  });
});
