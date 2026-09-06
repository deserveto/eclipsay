import { NextResponse } from 'next/server';
import { adminGate, type AdminGateCode } from '@/lib/auth/admin';
import { configuredProviderIds, REASONING_CAPABLE } from '@/lib/ai/provider';
import { aiRuntimeConfigSchema, getAiRuntimeConfig, saveAiRuntimeConfig } from '@/lib/ai/runtime-config';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';

// Admin-controlled AI model configuration (plan: AI admin config). GET returns
// the resolved runtime config plus the providers enabled by env keys; PUT
// validates against the same schema the UI uses, whitelist-checks providers,
// and persists through the service-role client. Storage contract lives in
// 0004_app_config.sql.

const putSchema = aiRuntimeConfigSchema.superRefine((config, ctx) => {
  const enabled: string[] = configuredProviderIds();
  for (const usage of ['chat', 'utility'] as const) {
    if (!enabled.includes(config[usage].provider)) {
      ctx.addIssue({
        code: 'custom',
        path: [usage, 'provider'],
        message: `Provider '${config[usage].provider}' is not configured`,
      });
    }
  }
});

function gateResponse(gate: AdminGateCode): NextResponse {
  return NextResponse.json({ error: gate }, { status: gate === 'unauthenticated' ? 401 : 403 });
}

export async function GET() {
  const gate = await adminGate();
  if (gate) return gateResponse(gate);
  const config = await getAiRuntimeConfig();
  return NextResponse.json({ config, providers: configuredProviderIds(), reasoningCapable: REASONING_CAPABLE });
}

export async function PUT(request: Request) {
  const gate = await adminGate();
  if (gate) return gateResponse(gate);
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  try {
    await saveAiRuntimeConfig(parsed.data);
  } catch {
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ config: parsed.data });
}
