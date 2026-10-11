import { NextResponse } from "next/server";
import { PROVIDERS, providerInfo, type ProviderStatus } from "@/lib/keywords/registry";
import { ProviderHttpError } from "@/lib/keywords/http";

export const dynamic = "force-dynamic";

// Live checks hit public third-party APIs; cache them so page loads don't fan out upstream.
const CHECK_TTL_MS = 5 * 60_000;
let cache: { at: number; value: ProviderStatus[] } | undefined;
let inflight: Promise<ProviderStatus[]> | undefined;

async function check(): Promise<ProviderStatus[]> {
  return Promise.all(
    PROVIDERS.map(async (p): Promise<ProviderStatus> => {
      const info = providerInfo(p, process.env);
      if (!info.config.ok) return { ...info, state: info.config.state, detail: info.config.reason };
      if (!p.implemented || !p.liveCheck) return { ...info, state: "NOT_CONFIGURED", detail: "Adapter not implemented yet." };
      const started = Date.now();
      try {
        await p.liveCheck({ env: process.env, now: new Date() });
        return { ...info, state: "CONNECTED", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started };
      } catch (err) {
        const rate = err instanceof ProviderHttpError && err.category === "rate_limited";
        return { ...info, state: rate ? "RATE_LIMITED" : "ERROR", checkedAt: new Date().toISOString(), detail: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - started };
      }
    }),
  );
}

export async function GET() {
  if (!cache || Date.now() - cache.at > CHECK_TTL_MS) {
    inflight ??= check().finally(() => (inflight = undefined));
    cache = { at: Date.now(), value: await inflight };
  }
  return NextResponse.json({ providers: cache.value, checkedAt: new Date(cache.at).toISOString() }, { headers: { "cache-control": "private, no-store" } });
}
