import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { resetModelListCacheForTests } from '@/lib/ai/model-catalog';

// Route test: normalization of each provider's catalog shape, the enabled
// provider whitelist, and the in-memory cache. The gate is stubbed open —
// its matrix is covered in the ai-config route test and the auth lib tests.
const mocks = vi.hoisted(() => ({
  adminGate: vi.fn<() => Promise<string | null>>(async () => null),
  configuredProviderIds: vi.fn(() => ['openrouter', 'poolside']),
}));

vi.mock('@/lib/auth/admin', () => ({ adminGate: mocks.adminGate }));
vi.mock('@/lib/ai/provider', () => ({
  PROVIDER_IDS: ['openrouter', 'openai', 'anthropic', 'google', 'poolside'],
  configuredProviderIds: mocks.configuredProviderIds,
}));

function getJson(provider: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/admin/models?provider=${provider}`));
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  resetModelListCacheForTests();
  mocks.adminGate.mockClear().mockResolvedValue(null);
  mocks.configuredProviderIds.mockReturnValue(['openrouter', 'poolside']);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('GET /api/admin/models', () => {
  it('normalizes the openrouter catalog and sorts by name', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: [
          { id: 'zeta/small', name: 'Zeta Small' },
          { id: 'alpha/big', name: 'Alpha Big' },
          { id: 'no-name' },
        ],
      }),
    );

    const res = await getJson('openrouter');
    expect(res.status).toBe(200);
    expect((await res.json() as { models: { id: string; name: string }[] }).models).toEqual([
      { id: 'alpha/big', name: 'Alpha Big' },
      { id: 'no-name', name: 'no-name' },
      { id: 'zeta/small', name: 'Zeta Small' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('caches a provider catalog for the TTL', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ id: 'one' }] }));
    await getJson('openrouter');
    await getJson('openrouter');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects providers that are not enabled', async () => {
    const res = await getJson('anthropic');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unsupported_provider' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unknown provider ids', async () => {
    const res = await getJson('evil-provider');
    expect(res.status).toBe(400);
  });

  it('reports provider fetch failures as fetch_failed', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const res = await getJson('poolside');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'fetch_failed' });
  });
});
