import { NextResponse } from 'next/server';
import { adminGate, type AdminGateCode } from '@/lib/auth/admin';
import { PROVIDER_IDS, configuredProviderIds, type ProviderId } from '@/lib/ai/provider';
import { getModelOptions } from '@/lib/ai/model-catalog';

// Model catalog for the admin picker (plan: AI admin config). Lists come from
// each provider's own models endpoint (see lib/ai/model-catalog.ts for
// normalization + caching). Provider must be enabled via its env key,
// otherwise 400.

function gateResponse(gate: AdminGateCode): NextResponse {
  return NextResponse.json({ error: gate }, { status: gate === 'unauthenticated' ? 401 : 403 });
}

export async function GET(request: Request) {
  const gate = await adminGate();
  if (gate) return gateResponse(gate);

  const providerId = new URL(request.url).searchParams.get('provider') ?? '';
  if (
    !(PROVIDER_IDS as readonly string[]).includes(providerId) ||
    !configuredProviderIds().includes(providerId as ProviderId)
  ) {
    return NextResponse.json({ error: 'unsupported_provider' }, { status: 400 });
  }

  try {
    return NextResponse.json({ models: await getModelOptions(providerId) });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }
}
