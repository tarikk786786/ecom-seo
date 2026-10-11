import { getJson, ProviderHttpError } from "../http";
import { alwaysConfigured, type KeywordProvider } from "../provider";
import { STACK_SITES } from "../stack-sites";
import { normalizeKeyword, recordId } from "../text";
import { TIME_WINDOWS, type KeywordRecord } from "../types";

type Item = { question_id: number; title: string; link: string; view_count?: number; answer_count?: number; score?: number; creation_date?: number; is_answered?: boolean };
type Wrapper = { items?: Item[]; quota_remaining?: number; backoff?: number; error_id?: number; error_message?: string };

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

export function parseStackExchange(items: Item[], site: string, fetchedAt: string): KeywordRecord[] {
  return items.map((it) => {
    const title = decode(it.title);
    return {
      id: recordId("stackexchange", "question", `${site}:${it.question_id}`),
      keyword: title,
      normalized: normalizeKeyword(title),
      category: "question" as const,
      provider: "stackexchange",
      method: `Question asked on ${site}.stackexchange (API relevance search)`,
      dataType: "observed" as const,
      language: "en",
      sourceUrl: it.link,
      sourceRecordId: `${site}:${it.question_id}`,
      fetchedAt,
      observedAt: it.creation_date ? new Date(it.creation_date * 1000).toISOString() : undefined,
      metrics: [
        ...(typeof it.view_count === "number" ? [{ key: "question_views", label: "Question page views", value: it.view_count, unit: "views", kind: "engagement" as const, definition: "Lifetime views of the question page on Stack Exchange. Not search engine volume." }] : []),
        ...(typeof it.answer_count === "number" ? [{ key: "answers", label: "Answers", value: it.answer_count, unit: "answers", kind: "engagement" as const, definition: "Number of answers." }] : []),
      ],
    };
  });
}

export const stackExchange: KeywordProvider = {
  id: "stackexchange",
  name: "Stack Exchange",
  group: "Community",
  glyph: "SE",
  color: "#f59e0b",
  implemented: true,
  access: "Public Stack Exchange API v2.3. No key needed for up to 300 requests/day per IP.",
  docsUrl: "https://api.stackexchange.com/docs/advanced-search",
  provides: ["Real questions people asked", "Question views, answer counts"],
  notProvided: ["Search volume", "CPC", "Country filtering"],
  supports: { country: false, language: false, window: true },
  defaultEnabled: true,
  configuration: alwaysConfigured,

  async liveCheck(ctx) {
    const r = await getJson<Wrapper>("https://api.stackexchange.com/2.3/info?site=superuser", { fetchImpl: ctx.fetchImpl, signal: ctx.signal, timeoutMs: 6000 });
    if (!r?.items) throw new Error(r?.error_message ?? "unexpected response");
  },

  async search(req, ctx) {
    const site = STACK_SITES.some((s) => s.id === req.stackExchangeSite) ? req.stackExchangeSite! : "superuser";
    const days = TIME_WINDOWS.find((w) => w.id === req.window)?.days ?? 30;
    // Questions are long-lived; the window filters by creation date but at least one year is searched.
    const from = Math.floor((ctx.now.getTime() - Math.max(days, 365) * 86_400_000) / 1000);
    const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(req.query)}&site=${site}&pagesize=30&fromdate=${from}`;
    const res = await getJson<Wrapper>(url, { fetchImpl: ctx.fetchImpl, signal: ctx.signal });
    if (res?.error_id === 502 || res?.error_message?.includes("throttle")) throw new ProviderHttpError(res.error_message ?? "throttled", "rate_limited");
    if (res?.error_id) throw new ProviderHttpError(res.error_message ?? `error ${res.error_id}`, "http");
    const records = parseStackExchange(res?.items ?? [], site, ctx.now.toISOString());
    const quota = res?.quota_remaining !== undefined ? ` Daily API quota remaining: ${res.quota_remaining}.` : "";
    return { records, message: `Searched ${site} (questions created since ${new Date(from * 1000).toISOString().slice(0, 10)}).${quota}` };
  },
};
