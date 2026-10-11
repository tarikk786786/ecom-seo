import { cachedToken, getJson, missingEnv, ProviderHttpError, requestJson } from "../http";
import type { KeywordProvider, ProviderContext } from "../provider";
import { isQuestion, normalizeKeyword, recordId } from "../text";
import type { KeywordRecord, Metric } from "../types";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const API = "https://api.ebay.com/buy/browse/v1/item_summary/search";

/** eBay marketplaces for the dashboard's countries (eBay has no India or Japan marketplace). */
export const EBAY_MARKETPLACES: Record<string, string> = {
  US: "EBAY_US", GB: "EBAY_GB", CA: "EBAY_CA", AU: "EBAY_AU", DE: "EBAY_DE", FR: "EBAY_FR", ES: "EBAY_ES", IT: "EBAY_IT", NL: "EBAY_NL", SG: "EBAY_SG",
};

type ItemSummary = { itemId?: string; title?: string; itemWebUrl?: string; price?: { value?: string; currency?: string } };

export function parseEbay(body: unknown, opts: { country: string; fetchedAt: string }): { records: KeywordRecord[]; total?: number } {
  const b = body as { itemSummaries?: unknown; total?: number } | undefined;
  if (b?.itemSummaries === undefined) return { records: [], total: b?.total };
  if (!Array.isArray(b.itemSummaries)) throw new ProviderHttpError("eBay itemSummaries is not an array", "parse");
  const records = (b.itemSummaries as ItemSummary[]).flatMap((it) => {
    const title = it.title?.trim();
    if (!it.itemId || !title) return [];
    const value = Number(it.price?.value);
    const metrics: Metric[] = Number.isFinite(value) ? [{ key: "price", label: "Price", value, unit: it.price?.currency ?? "", kind: "absolute", display: `${value.toFixed(2)} ${it.price?.currency ?? ""}`.trim(), definition: "Listing price at fetch time. A product attribute, not demand." }] : [];
    const category = isQuestion(title) ? "question" : "related";
    return [
      {
        id: recordId("ebay", category, it.itemId),
        keyword: title,
        normalized: normalizeKeyword(title),
        category,
        provider: "ebay",
        method: "Listing title in eBay Browse API search results",
        dataType: "observed",
        country: opts.country,
        sourceUrl: it.itemWebUrl,
        sourceRecordId: it.itemId,
        fetchedAt: opts.fetchedAt,
        metrics,
      } satisfies KeywordRecord,
    ];
  });
  return { records, total: typeof b.total === "number" ? b.total : undefined };
}

async function appToken(ctx: ProviderContext): Promise<string> {
  return cachedToken(`ebay:${ctx.env.EBAY_CLIENT_ID}`, ctx.now.getTime(), async () => {
    const basic = Buffer.from(`${ctx.env.EBAY_CLIENT_ID}:${ctx.env.EBAY_CLIENT_SECRET}`).toString("base64");
    const r = await requestJson<{ access_token?: string; expires_in?: number }>(TOKEN_URL, {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }).toString(),
      fetchImpl: ctx.fetchImpl,
      signal: ctx.signal,
      errorDetail: (t) => (JSON.parse(t) as { error?: string }).error,
    }).catch((err) => {
      if (err instanceof ProviderHttpError && err.status === 400) throw new ProviderHttpError(`eBay token request rejected (${err.message})`, "auth", 400);
      throw err;
    });
    if (!r?.access_token) throw new ProviderHttpError("eBay token response had no access_token", "parse");
    return { token: r.access_token, expiresInS: r.expires_in ?? 7200 };
  });
}

const errorId = (t: string) => {
  const j = JSON.parse(t) as { errors?: { errorId?: number; message?: string }[] };
  const e = j.errors?.[0];
  return e ? `${e.errorId ?? ""} ${e.message ?? ""}`.trim() : undefined;
};

export const ebay: KeywordProvider = {
  id: "ebay",
  name: "eBay",
  group: "Marketplaces",
  glyph: "e",
  color: "#a78bfa",
  implemented: true,
  access: "eBay developer app keyset (client ID and secret) using an application token with the public api_scope.",
  docsUrl: "https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search",
  provides: ["Listing titles matching a query", "Total matching listings", "Prices at fetch time"],
  notProvided: ["eBay search volume", "Sold-item data"],
  supports: { country: true, language: false, window: false },
  defaultEnabled: true,
  configuration({ env }) {
    const missing = missingEnv(env, ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"]);
    return missing.length ? { ok: false, state: "NOT_CONFIGURED", reason: `Adapter implemented; credentials missing: ${missing.join(", ")}.` } : { ok: true };
  },

  async liveCheck(ctx) {
    const r = await getJson<{ total?: number }>(`${API}?q=book&limit=1`, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, headers: { authorization: `Bearer ${await appToken(ctx)}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }, notFoundAsEmpty: false, errorDetail: errorId });
    if (typeof r?.total !== "number") throw new Error("unexpected response");
  },

  async search(req, ctx) {
    const mp = EBAY_MARKETPLACES[req.country];
    if (!mp) return { records: [], message: `eBay has no marketplace for ${req.country}; supported: ${Object.keys(EBAY_MARKETPLACES).join(", ")}.` };
    const body = await getJson<unknown>(`${API}?q=${encodeURIComponent(req.query)}&limit=50`, {
      fetchImpl: ctx.fetchImpl,
      signal: ctx.signal,
      headers: { authorization: `Bearer ${await appToken(ctx)}`, "X-EBAY-C-MARKETPLACE-ID": mp },
      notFoundAsEmpty: false,
      retries: 1,
      errorDetail: errorId,
    });
    const { records, total } = parseEbay(body, { country: req.country, fetchedAt: ctx.now.toISOString() });
    return { records, message: total !== undefined ? `${total.toLocaleString("en")} matching listings on ${mp}.` : undefined };
  },
};
