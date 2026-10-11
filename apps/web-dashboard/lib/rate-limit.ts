/**
 * Fixed-window, in-memory limiter. Per server instance only; it protects upstream public APIs
 * from bursts on a single node and is not a substitute for a shared limiter in production.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { start: number; count: number }>();
  return (key: string, now = Date.now()): { ok: boolean; retryAfterS: number } => {
    const entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
      return { ok: true, retryAfterS: 0 };
    }
    entry.count++;
    return entry.count <= limit ? { ok: true, retryAfterS: 0 } : { ok: false, retryAfterS: Math.ceil((entry.start + windowMs - now) / 1000) };
  };
}

export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
