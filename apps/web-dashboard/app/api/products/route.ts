import { NextResponse, type NextRequest } from "next/server";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { createProduct, listProducts } from "@/lib/products/repository";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(60, 60_000);
const noStore = { "cache-control": "private, no-store" };

export async function GET(request: NextRequest) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many requests. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }
  const sp = request.nextUrl.searchParams;
  const result = await listProducts({
    q: sp.get("q") ?? undefined,
    marketplace: sp.get("marketplace") ?? undefined,
    country: sp.get("country") ?? undefined,
    brand: sp.get("brand") ?? undefined,
    category: sp.get("category") ?? undefined,
    page: Number(sp.get("page") ?? 1),
    pageSize: Number(sp.get("pageSize") ?? 25),
    sort: (sp.get("sort") as "updated_desc" | "updated_asc" | "title_asc" | "title_desc" | null) ?? "updated_desc",
  });
  return NextResponse.json(result, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many requests. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400, headers: noStore });
  }
  const result = await createProduct(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400, headers: noStore });
  return NextResponse.json({ product: result.product }, { status: 201, headers: noStore });
}
