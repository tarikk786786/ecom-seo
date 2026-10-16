import { NextResponse, type NextRequest } from "next/server";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { importProductsCsv } from "@/lib/products/repository";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(10, 60_000);
const noStore = { "cache-control": "private, no-store" };
const MAX_BYTES = 2_000_000;

export async function POST(request: NextRequest) {
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many imports. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: { ...noStore, "retry-after": String(limit.retryAfterS) } });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let text = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "multipart field 'file' is required." }, { status: 400, headers: noStore });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "CSV exceeds 2 MB limit." }, { status: 400, headers: noStore });
    }
    text = await file.text();
  } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "CSV exceeds 2 MB limit." }, { status: 400, headers: noStore });
    }
    text = new TextDecoder("utf-8").decode(buf);
  } else {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Send CSV as multipart file, text/csv, or JSON { csv: string }." }, { status: 400, headers: noStore });
    }
    if (!body || typeof body !== "object" || typeof (body as { csv?: unknown }).csv !== "string") {
      return NextResponse.json({ error: "JSON body must include string field csv." }, { status: 400, headers: noStore });
    }
    text = (body as { csv: string }).csv;
    if (text.length > MAX_BYTES) {
      return NextResponse.json({ error: "CSV exceeds 2 MB limit." }, { status: 400, headers: noStore });
    }
  }

  const result = await importProductsCsv(text);
  return NextResponse.json(result, { headers: noStore });
}
