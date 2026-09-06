// Anonymous spend/spam control (audit A07). In-memory fixed-window limiter:
// a single server instance is bounded; horizontally scaled deployments MUST
// add a shared limiter (e.g. Upstash Redis) or CDN-edge rules — recorded as a
// staging gate in docs/REMEDIATION-2026-09-07.md. Keys are IP-scoped per
// endpoint; an instance restart merely resets the windows (fail open, never
// blocking legitimate users longer than one window).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweepAt > SWEEP_INTERVAL_MS) {
    lastSweepAt = now;
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(k);
    }
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
  lastSweepAt = 0;
}

export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `${scope}:${ip}`;
}

export function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    { error: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  );
}
