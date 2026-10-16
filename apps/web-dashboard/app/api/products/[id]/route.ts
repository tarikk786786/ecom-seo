import { NextResponse, type NextRequest } from "next/server";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { deleteProduct, getProduct, updateProduct } from "@/lib/products/repository";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(60, 60_000);
const noStore = { "cache-control": "private, no-store" };

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many requests. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }
  const { id } = await ctx.params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404, headers: noStore });
  return NextResponse.json({ product }, { headers: noStore });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many requests. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400, headers: noStore });
  }
  const result = await updateProduct(id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 400, headers: noStore });
  return NextResponse.json({ product: result.product }, { headers: noStore });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many requests. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }
  const { id } = await ctx.params;
  const result = await deleteProduct(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
