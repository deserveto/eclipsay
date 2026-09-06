// Per-provider model catalog (plan: AI admin config). Lists come from each
// provider's own models endpoint, normalized to {id, name} and cached
// in-memory for 10 minutes. Lives outside the route module because Next route
// files may only export HTTP verbs.

export interface AdminModelOption {
  id: string;
  name: string;
}

const LIST_TTL_MS = 10 * 60_000;
const listCache = new Map<string, { at: number; models: AdminModelOption[] }>();

/** Test seam. */
export function resetModelListCacheForTests(): void {
  listCache.clear();
}

function asModels(json: unknown, pick: (raw: Record<string, unknown>) => AdminModelOption | null): AdminModelOption[] {
  if (typeof json !== 'object' || json === null) return [];
  // OpenAI-family lists live under `data`; Google lists under `models`.
  const rows = 'data' in json ? json.data : 'models' in json ? json.models : null;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (typeof row !== 'object' || row === null) return null;
      const record = row as Record<string, unknown>; // post-guard: keyed object, unknown props
      return pick(record);
    })
    .filter((m): m is AdminModelOption => m !== null);
}

async function fetchModels(providerId: string): Promise<AdminModelOption[]> {
  const signal = AbortSignal.timeout(10_000);
  switch (providerId) {
    case 'openrouter': {
      const res = await fetch('https://openrouter.ai/api/v1/models', { signal });
      if (!res.ok) throw new Error(`openrouter ${res.status}`);
      return asModels(await res.json(), (m) =>
        typeof m.id === 'string' ? { id: m.id, name: typeof m.name === 'string' ? m.name : m.id } : null,
      );
    }
    case 'openai': {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}` },
        signal,
      });
      if (!res.ok) throw new Error(`openai ${res.status}`);
      return asModels(await res.json(), (m) => (typeof m.id === 'string' ? { id: m.id, name: m.id } : null));
    }
    case 'anthropic': {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
        },
        signal,
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      return asModels(await res.json(), (m) =>
        typeof m.id === 'string'
          ? { id: m.id, name: typeof m.display_name === 'string' ? m.display_name : m.id }
          : null,
      );
    }
    case 'google': {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '' },
        signal,
      });
      if (!res.ok) throw new Error(`google ${res.status}`);
      // v1beta lists tuner and embedding variants; only chat-capable matter here.
      return asModels(await res.json(), (m) => {
        const name = typeof m.name === 'string' ? m.name.replace(/^models\//, '') : null;
        const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
        if (name === null || (methods.length > 0 && !methods.includes('generateContent'))) return null;
        return { id: name, name: typeof m.displayName === 'string' ? m.displayName : name };
      });
    }
    case 'poolside': {
      // OpenAI-compatible catalog (https://docs.poolside.ai/api/overview)
      const res = await fetch('https://inference.poolside.ai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.POOLSIDE_API_KEY ?? ''}` },
        signal,
      });
      if (!res.ok) throw new Error(`poolside ${res.status}`);
      return asModels(await res.json(), (m) => (typeof m.id === 'string' ? { id: m.id, name: m.id } : null));
    }
    default:
      throw new Error(`unsupported provider '${providerId}'`);
  }
}

/** Cached, name-sorted catalog for one enabled provider. */
export async function getModelOptions(providerId: string): Promise<AdminModelOption[]> {
  const cached = listCache.get(providerId);
  if (cached && Date.now() - cached.at < LIST_TTL_MS) return cached.models;
  const models = (await fetchModels(providerId)).sort((a, b) => a.name.localeCompare(b.name));
  listCache.set(providerId, { at: Date.now(), models });
  return models;
}
