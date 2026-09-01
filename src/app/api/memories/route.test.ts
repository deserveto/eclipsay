import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getAuthUser: vi.fn(async (): Promise<{ id: string } | null> => ({ id: 'user-1' })),
  isSupabaseServerConfigured: vi.fn(() => true),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  getAuthUser: mocks.getAuthUser,
  isSupabaseServerConfigured: mocks.isSupabaseServerConfigured,
}));

const validBody = { content: 'I prefer quiet mornings.', category: 'preference', source: 'Added by you' };

type ProfileResult = { memory_enabled?: boolean } | null;

function configureClient(profile: ProfileResult, profileError: { message: string } | null = null, insertError: { message: string } | null = null) {
  const maybeSingle = vi.fn(async () => ({ data: profile, error: profileError }));
  const profileSelect = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
  const single = vi.fn(async () => ({ data: { id: 'memory-1' }, error: insertError }));
  const memoryInsert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
  mocks.from.mockImplementation((table: string) => (table === 'profiles' ? { select: profileSelect } : { insert: memoryInsert }));
  mocks.createClient.mockResolvedValue({ from: mocks.from });
  return { maybeSingle, memoryInsert, single };
}

function postJson(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost:3000/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSupabaseServerConfigured.mockReturnValue(true);
  mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });
});

describe('POST /api/memories memory setting boundary', () => {
  it('returns memory_disabled without inserting when the profile opts out', async () => {
    const client = configureClient({ memory_enabled: false });

    const res = await postJson(validBody);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'memory_disabled' });
    expect(client.memoryInsert).not.toHaveBeenCalled();
  });

  it('creates a memory when the profile enables memory', async () => {
    const client = configureClient({ memory_enabled: true });

    const res = await postJson(validBody);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'memory-1' });
    expect(client.memoryInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        content: validBody.content,
        category: validBody.category,
        source: validBody.source,
        active: true,
      }),
    );
  });

  it('keeps the existing default-enabled behavior when the profile is missing', async () => {
    const client = configureClient(null);

    const res = await postJson(validBody);

    expect(res.status).toBe(200);
    expect(client.memoryInsert).toHaveBeenCalledTimes(1);
  });

  it('fails closed when reading the memory setting fails', async () => {
    const client = configureClient(null, { message: 'profile read failed' });

    const res = await postJson(validBody);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'memory_setting_unavailable' });
    expect(client.memoryInsert).not.toHaveBeenCalled();
  });

  it('keeps insert failures distinct from the setting boundary', async () => {
    configureClient({ memory_enabled: true }, null, { message: 'insert failed' });

    const res = await postJson(validBody);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'insert_failed' });
  });
});
