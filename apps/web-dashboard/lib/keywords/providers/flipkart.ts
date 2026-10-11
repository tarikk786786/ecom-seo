import { getJson, missingEnv, ProviderHttpError } from "../http";
import type { KeywordProvider } from "../provider";
import { isQuestion, normalizeKeyword, recordId } from "../text";
import type { KeywordRecord, Metric } from "../types";

const API = "https://affiliate-api.flipkart.net/affiliate/1.0/search.json";

type Price = { amount?: number; currency?: string };
type FlipkartProduct = { productBaseInfoV1?: { productId?: string; title?: string; productUrl?: string; flipkartSpecialPrice?: Price; flipkartSellingPrice?: Price } };

export function parseFlipkart(body: unknown, fetchedAt: string): KeywordRecord[] {
  const products = (body as { products?: unknown } | undefined)?.products;
  if (products === undefined) return [];
  if (!Array.isArray(products)) throw new ProviderHttpError("Flipkart products is not an array", "parse");
  return (products as FlipkartProduct[]).flatMap((p) => {
    const info = p.productBaseInfoV1;
    const title = info?.title?.trim();
    if (!info?.productId || !title) return [];
    const price = info.flipkartSpecialPrice ?? info.flipkartSellingPrice;
    const metrics: Metric[] =
      typeof price?.amount === "number"
        ? [{ key: "price", label: "Price", value: price.amount, unit: price.currency ?? "INR", kind: "absolute", display: `${price.amount} ${price.currency ?? "INR"}`, definition: "Flipkart price at fetch time. A product attribute, not demand." }]
        : [];
    const category = isQuestion(title) ? "question" : "related";
    return [
      {
        id: recordId("flipkart", category, info.productId),
        keyword: title,
        normalized: normalizeKeyword(title),
        category,
        provider: "flipkart",
        method: "Product title in Flipkart Affiliate API search results",
        dataType: "observed",
        country: "IN",
        sourceUrl: info.productUrl,
        sourceRecordId: info.productId,
        fetchedAt,
        metrics,
      } satisfies KeywordRecord,
    ];
  });
}

const headers = (env: Record<string, string | undefined>) => ({ "Fk-Affiliate-Id": env.FLIPKART_AFFILIATE_ID!, "Fk-Affiliate-Token": env.FLIPKART_AFFILIATE_TOKEN! });

export const flipkart: KeywordProvider = {
  id: "flipkart",
  name: "Flipkart",
  group: "Marketplaces",
  glyph: "F",
  color: "#facc15",
  implemented: true,
  access: "Flipkart Affiliate API (affiliate ID and token). Flipkart's public docs were last updated in 2016, so current API access for new affiliates is unconfirmed. Seller APIs cover only your own listings.",
  docsUrl: "https://affiliate.flipkart.com/api-docs/",
  provides: ["Product titles from Flipkart affiliate search (max 10 per query)", "Prices at fetch time"],
  notProvided: ["Flipkart search volume", "Sales data"],
  supports: { country: false, language: false, window: false },
  defaultEnabled: true,
  configuration({ env }) {
    const missing = missingEnv(env, ["FLIPKART_AFFILIATE_ID", "FLIPKART_AFFILIATE_TOKEN"]);
    return missing.length ? { ok: false, state: "NOT_CONFIGURED", reason: `Adapter implemented; credentials missing: ${missing.join(", ")}. API access for new affiliates is unconfirmed.` } : { ok: true };
  },

  async liveCheck(ctx) {
    const r = await getJson<unknown>(`${API}?query=phone&resultCount=1`, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, headers: headers(ctx.env), notFoundAsEmpty: false });
    if (!r || typeof r !== "object") throw new Error("unexpected response");
  },

  async search(req, ctx) {
    const body = await getJson<unknown>(`${API}?query=${encodeURIComponent(req.query)}&resultCount=10`, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, headers: headers(ctx.env), notFoundAsEmpty: false, retries: 1 });
    return { records: parseFlipkart(body, ctx.now.toISOString()), message: "Flipkart India catalog; country and language filters do not apply." };
  },
};
