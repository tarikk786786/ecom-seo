import { NextResponse, type NextRequest } from "next/server";
import { auditPageUrl } from "@/lib/audits/page-audit";
import { getProduct } from "@/lib/products/repository";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(15, 60_000);
const noStore = { "cache-control": "private, no-store" };

export async function POST(request: NextRequest) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many audits. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400, headers: noStore });
  }
  const o = body && typeof body === "object" ? (body as { url?: unknown; productId?: unknown }) : {};
  let url = typeof o.url === "string" ? o.url.trim() : "";

  if (!url && typeof o.productId === "string") {
    const product = await getProduct(o.productId);
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404, headers: noStore });
    if (!product.url) return NextResponse.json({ error: "That product has no listing URL to audit." }, { status: 400, headers: noStore });
    url = product.url;
  }

  if (!url) {
    return NextResponse.json({ error: "Provide url or productId." }, { status: 400, headers: noStore });
  }

  try {
    const result = await auditPageUrl(url);
    return NextResponse.json(result, { headers: noStore });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit failed.";
    const blocked = /not allowed|credentials|Only http|Private or special|Loopback|Redirect target/i.test(message);
    return NextResponse.json({ error: message }, { status: blocked ? 400 : 502, headers: noStore });
  }
}
