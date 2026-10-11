import { NextResponse, type NextRequest } from "next/server";
import { aiConfigured, buildAiPrompt, parseAiIdeas } from "@/lib/keywords/ai";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(5, 60_000);
const noStore = { "cache-control": "private, no-store" };

export async function GET() {
  return NextResponse.json({ configured: aiConfigured(process.env) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!aiConfigured(process.env)) {
    return NextResponse.json({ error: "AI expansion is not configured. Set OPENAI_API_KEY on the server." }, { status: 503, headers: noStore });
  }
  const limit = limiter(clientKey(request.headers));
  if (!limit.ok) return NextResponse.json({ error: `Too many AI requests. Try again in ${limit.retryAfterS} s.` }, { status: 429, headers: noStore });

  const body = (await request.json().catch(() => null)) as { query?: unknown; observed?: unknown; country?: unknown; language?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 120) : "";
  if (!query) return NextResponse.json({ error: "Missing query." }, { status: 400, headers: noStore });
  const observed = Array.isArray(body?.observed) ? body.observed.filter((x): x is string => typeof x === "string").slice(0, 60).map((s) => s.slice(0, 100)) : [];
  const country = typeof body?.country === "string" && /^[A-Z]{2}$/.test(body.country) ? body.country : "US";
  const language = typeof body?.language === "string" && /^[a-z]{2,3}$/.test(body.language) ? body.language : "en";

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a keyword research assistant. You never invent metrics." },
          { role: "user", content: buildAiPrompt(query, observed, country, language) },
        ],
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    });
    if (!res.ok) return NextResponse.json({ error: `AI provider returned HTTP ${res.status}.` }, { status: 502, headers: noStore });
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const ideas = parseAiIdeas(data.choices?.[0]?.message?.content ?? "", [query, ...observed]);
    return NextResponse.json({ model, generatedAt: new Date().toISOString(), ideas }, { headers: noStore });
  } catch (err) {
    return NextResponse.json({ error: `AI request failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 502, headers: noStore });
  }
}
