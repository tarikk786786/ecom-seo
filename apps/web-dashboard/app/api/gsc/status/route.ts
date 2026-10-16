import { NextResponse, type NextRequest } from "next/server";
import { getGscStatus } from "@/lib/gsc/client";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(20, 60_000);
const noStore = { "cache-control": "private, no-store" };

export async function GET(request: NextRequest) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many requests. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }
  const status = await getGscStatus(process.env);
  return NextResponse.json(status, { headers: noStore });
}
