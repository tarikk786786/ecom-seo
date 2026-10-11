import { getJson, missingEnv, ProviderHttpError } from "../http";
import type { KeywordProvider } from "../provider";
import { isQuestion, normalizeKeyword, recordId } from "../text";
import type { KeywordRecord, Metric } from "../types";

const API = "https://api.etsy.com/v3/application/listings/active";

type Listing = { listing_id?: number; title?: string; url?: string; num_favorers?: number; views?: number; price?: { amount?: number; divisor?: number; currency_code?: string } };

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

export function parseEtsy(body: unknown, fetchedAt: string): { records: KeywordRecord[]; count?: number } {
  const b = body as { results?: unknown; count?: number } | undefined;
  if (b?.results === undefined) return { records: [], count: b?.count };
  if (!Array.isArray(b.results)) throw new ProviderHttpError("Etsy results is not an array", "parse");
  const records = (b.results as Listing[]).flatMap((l) => {
    const title = l.title ? decode(l.title).trim() : "";
    if (!l.listing_id || !title) return [];
    const metrics: Metric[] = [];
    if (typeof l.num_favorers === "number") metrics.push({ key: "favorites", label: "Etsy favorites", value: l.num_favorers, unit: "favorites", kind: "engagement", definition: "Users who favorited this listing. Engagement, not search volume." });
    if (typeof l.views === "number") metrics.push({ key: "listing_views", label: "Listing views", value: l.views, unit: "views", kind: "engagement", definition: "Views of this listing reported by Etsy." });
    const p = l.price;
    if (typeof p?.amount === "number" && p.divisor) metrics.push({ key: "price", label: "Price", value: p.amount / p.divisor, unit: p.currency_code ?? "", kind: "absolute", display: `${(p.amount / p.divisor).toFixed(2)} ${p.currency_code ?? ""}`.trim(), definition: "Listing price at fetch time. A product attribute, not demand." });
    const category = isQuestion(title) ? "question" : "related";
    return [
      {
        id: recordId("etsy", category, String(l.listing_id)),
        keyword: title,
        normalized: normalizeKeyword(title),
        category,
        provider: "etsy",
        method: "Active listing title in Etsy Open API v3 search (findAllListingsActive)",
        dataType: "observed",
        sourceUrl: l.url,
        sourceRecordId: String(l.listing_id),
        fetchedAt,
        metrics,
      } satisfies KeywordRecord,
    ];
  });
  return { records, count: typeof b.count === "number" ? b.count : undefined };
}

const apiKey = (env: Record<string, string | undefined>) => `${env.ETSY_API_KEY}:${env.ETSY_SHARED_SECRET}`;
const etsyError = (t: string) => (JSON.parse(t) as { error?: string }).error;

export const etsy: KeywordProvider = {
  id: "etsy",
  name: "Etsy",
  group: "Marketplaces",
  glyph: "E",
  color: "#fb923c",
  implemented: true,
  access: "Etsy Open API v3 app (keystring and shared secret, sent as x-api-key). Default limits 10,000 requests/day and 10/second.",
  docsUrl: "https://developers.etsy.com/documentation/reference#operation/findAllListingsActive",
  provides: ["Active listing titles matching a query", "Total matching listings", "Favorites and prices"],
  notProvided: ["Etsy search volume", "Sales data"],
  supports: { country: true, language: false, window: false },
  defaultEnabled: true,
  configuration({ env }) {
    const missing = missingEnv(env, ["ETSY_API_KEY", "ETSY_SHARED_SECRET"]);
    return missing.length ? { ok: false, state: "NOT_CONFIGURED", reason: `Adapter implemented; credentials missing: ${missing.join(", ")}.` } : { ok: true };
  },

  async liveCheck(ctx) {
    const r = await getJson<{ count?: number }>(`${API}?limit=1&keywords=mug`, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, headers: { "x-api-key": apiKey(ctx.env) }, notFoundAsEmpty: false, errorDetail: etsyError });
    if (typeof r?.count !== "number") throw new Error("unexpected response");
  },

  async search(req, ctx) {
    const url = `${API}?limit=50&keywords=${encodeURIComponent(req.query)}&sort_on=score&buyer_country=${req.country}`;
    const body = await getJson<unknown>(url, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, headers: { "x-api-key": apiKey(ctx.env) }, notFoundAsEmpty: false, retries: 1, errorDetail: etsyError });
    const { records, count } = parseEtsy(body, ctx.now.toISOString());
    return { records, message: count !== undefined ? `${count.toLocaleString("en")} active listings shipping to ${req.country}.` : undefined };
  },
};
