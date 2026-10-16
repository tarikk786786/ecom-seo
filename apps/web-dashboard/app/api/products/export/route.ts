import { NextResponse, type NextRequest } from "next/server";
import { productsToCsv } from "@/lib/products/csv";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { listProductsForExport } from "@/lib/products/repository";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(20, 60_000);
const noStore = { "cache-control": "private, no-store" };

export async function GET(request: NextRequest) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many exports. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }

  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const sp = request.nextUrl.searchParams;
  const filtered = await listProductsForExport({
    q: sp.get("q") ?? undefined,
    marketplace: sp.get("marketplace") ?? undefined,
    country: sp.get("country") ?? undefined,
    brand: sp.get("brand") ?? undefined,
    category: sp.get("category") ?? undefined,
  });
  const products = filtered.items;

  if (format === "json") {
    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        count: products.length,
        persistence: filtered.persistence,
        products,
      },
      { headers: noStore },
    );
  }

  const csv = productsToCsv(products);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      ...noStore,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
