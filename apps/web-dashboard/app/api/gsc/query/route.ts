import { NextResponse, type NextRequest } from "next/server";
import { defaultDateRange, querySearchAnalytics, readGscConfig } from "@/lib/gsc/client";
import type { GscQueryRequest } from "@/lib/gsc/types";
import { ProviderHttpError } from "@/lib/keywords/http";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(10, 60_000);
const noStore = { "cache-control": "private, no-store" };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many requests. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }

  const cfg = readGscConfig(process.env);
  if (!cfg.ok) {
    return NextResponse.json(
      {
        error: cfg.reason,
        state: cfg.state,
        missing: cfg.missing,
        setup: true,
      },
      { status: 503, headers: noStore },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const o = (body && typeof body === "object" ? body : {}) as Partial<GscQueryRequest>;
  const defaults = defaultDateRange();
  const startDate = typeof o.startDate === "string" && DATE.test(o.startDate) ? o.startDate : defaults.startDate;
  const endDate = typeof o.endDate === "string" && DATE.test(o.endDate) ? o.endDate : defaults.endDate;
  if (startDate > endDate) {
    return NextResponse.json({ error: "startDate must be on or before endDate." }, { status: 400, headers: noStore });
  }

  const req: GscQueryRequest = {
    startDate,
    endDate,
    dimensions: Array.isArray(o.dimensions) ? o.dimensions : ["query"],
    rowLimit: typeof o.rowLimit === "number" ? o.rowLimit : 50,
    startRow: typeof o.startRow === "number" ? o.startRow : 0,
    pageFilter: typeof o.pageFilter === "string" ? o.pageFilter : undefined,
    queryFilter: typeof o.queryFilter === "string" ? o.queryFilter : undefined,
    countryFilter: typeof o.countryFilter === "string" ? o.countryFilter : undefined,
    deviceFilter: o.deviceFilter === "DESKTOP" || o.deviceFilter === "MOBILE" || o.deviceFilter === "TABLET" ? o.deviceFilter : undefined,
  };

  try {
    const result = await querySearchAnalytics(process.env, req);
    return NextResponse.json(result, { headers: noStore });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search Console query failed.";
    const status = err instanceof ProviderHttpError && err.category === "auth" ? 403 : 502;
    return NextResponse.json({ error: message }, { status, headers: noStore });
  }
}
