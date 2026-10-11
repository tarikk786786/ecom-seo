import { NextResponse, type NextRequest } from "next/server";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { PROVIDERS } from "@/lib/keywords/registry";
import { runKeywordSearch, validateSearchRequest } from "@/lib/keywords/search";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(20, 60_000);
const noStore = { "cache-control": "private, no-store" };

export async function POST(request: NextRequest) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many searches. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400, headers: noStore });
  }

  const v = validateSearchRequest(body, PROVIDERS.map((p) => p.id));
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400, headers: noStore });

  const result = await runKeywordSearch(v.request, PROVIDERS, { env: process.env, signal: request.signal });
  return NextResponse.json(result, { headers: noStore });
}
