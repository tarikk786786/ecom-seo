import { cachedToken, missingEnv, ProviderHttpError, requestJson } from "../http";
import type { KeywordProvider, ProviderContext } from "../provider";
import { isQuestion, normalizeKeyword, recordId } from "../text";
import type { KeywordRecord, Metric } from "../types";

const API = "https://creatorsapi.amazon/catalog/v1";

/** Login with Amazon token endpoint per Creators API credential version (3.1 NA, 3.2 EU incl. India, 3.3 FE). */
export const AMAZON_TOKEN_ENDPOINTS: Record<string, string> = {
  "3.1": "https://api.amazon.com/auth/o2/token",
  "3.2": "https://api.amazon.co.uk/auth/o2/token",
  "3.3": "https://api.amazon.co.jp/auth/o2/token",
};

const RESOURCES = ["itemInfo.title", "itemInfo.byLineInfo", "offersV2.listings.price"];

type AmazonItem = {
  asin?: string;
  detailPageURL?: string;
  itemInfo?: { title?: { displayValue?: string }; byLineInfo?: { brand?: { displayValue?: string } } };
  offersV2?: { listings?: { price?: { money?: { amount?: number; currency?: string } }; isBuyBoxWinner?: boolean }[] };
};

export function parseAmazonItems(body: unknown, opts: { marketplace: string; country: string; fetchedAt: string }): KeywordRecord[] {
  const items = (body as { searchResult?: { items?: unknown } } | undefined)?.searchResult?.items;
  if (items === undefined) return [];
  if (!Array.isArray(items)) throw new ProviderHttpError("Amazon searchResult.items is not an array", "parse");
  return (items as AmazonItem[]).flatMap((it) => {
    const title = it.itemInfo?.title?.displayValue?.trim();
    if (!it.asin || !title) return [];
    const listing = it.offersV2?.listings?.find((l) => l.isBuyBoxWinner) ?? it.offersV2?.listings?.[0];
    const money = listing?.price?.money;
    const metrics: Metric[] =
      typeof money?.amount === "number"
        ? [{ key: "price", label: "Price", value: money.amount, unit: money.currency ?? "", kind: "absolute", display: `${money.amount.toFixed(2)} ${money.currency ?? ""}`.trim(), definition: "Offer price shown by Amazon at fetch time. A product attribute, not demand." }]
        : [];
    const category = isQuestion(title) ? "question" : "related";
    return [
      {
        id: recordId("amazon", category, it.asin),
        keyword: title,
        normalized: normalizeKeyword(title),
        category,
        provider: "amazon",
        method: `Product title in Amazon search results (${opts.marketplace}, Creators API)`,
        dataType: "observed",
        country: opts.country,
        sourceUrl: it.detailPageURL,
        sourceRecordId: it.asin,
        fetchedAt: opts.fetchedAt,
        metrics,
      } satisfies KeywordRecord,
    ];
  });
}

const REQUIRED = ["AMAZON_CREATORS_CREDENTIAL_ID", "AMAZON_CREATORS_CREDENTIAL_SECRET", "AMAZON_PARTNER_TAG"];
const version = (env: ProviderContext["env"]) => env.AMAZON_CREATORS_CREDENTIAL_VERSION?.trim() || "3.2";
const marketplace = (env: ProviderContext["env"]) => env.AMAZON_MARKETPLACE?.trim() || "www.amazon.in";

async function token(ctx: ProviderContext): Promise<string> {
  const v = version(ctx.env);
  return cachedToken(`amazon:${ctx.env.AMAZON_CREATORS_CREDENTIAL_ID}:${v}`, ctx.now.getTime(), async () => {
    const r = await requestJson<{ access_token?: string; expires_in?: number }>(AMAZON_TOKEN_ENDPOINTS[v]!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: ctx.env.AMAZON_CREATORS_CREDENTIAL_ID, client_secret: ctx.env.AMAZON_CREATORS_CREDENTIAL_SECRET, scope: "creatorsapi::default" }),
      fetchImpl: ctx.fetchImpl,
      signal: ctx.signal,
      errorDetail: (t) => (JSON.parse(t) as { error?: string }).error,
    }).catch((err) => {
      if (err instanceof ProviderHttpError && err.status === 400) throw new ProviderHttpError(`Amazon token request rejected (${err.message})`, "auth", 400);
      throw err;
    });
    if (!r?.access_token) throw new ProviderHttpError("Amazon token response had no access_token", "parse");
    return { token: r.access_token, expiresInS: r.expires_in ?? 3600 };
  });
}

async function searchItems(keywords: string, itemCount: number, ctx: ProviderContext) {
  const mp = marketplace(ctx.env);
  return requestJson<unknown>(`${API}/searchItems`, {
    method: "POST",
    headers: { authorization: `Bearer ${await token(ctx)}`, "content-type": "application/json", "x-marketplace": mp },
    body: JSON.stringify({ keywords, itemCount, partnerTag: ctx.env.AMAZON_PARTNER_TAG, marketplace: mp, resources: RESOURCES }),
    fetchImpl: ctx.fetchImpl,
    signal: ctx.signal,
    timeoutMs: 10_000,
    errorDetail: (t) => {
      const j = JSON.parse(t) as { errors?: { code?: string }[]; code?: string };
      return j.errors?.[0]?.code ?? j.code;
    },
  });
}

export const amazonCreators: KeywordProvider = {
  id: "amazon",
  name: "Amazon",
  group: "Marketplaces",
  glyph: "a",
  color: "#fbbf24",
  implemented: true,
  access: "Amazon Creators API (replaced PA-API 5 in May 2026). Needs an Associates account with recent qualifying sales, Creators API credentials and a partner tag for the marketplace.",
  docsUrl: "https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction",
  provides: ["Product titles from Amazon search results", "Offer prices at fetch time"],
  notProvided: ["Amazon search volume", "Sales or marketplace-wide demand data"],
  supports: { country: false, language: false, window: false },
  defaultEnabled: true,
  configuration({ env }) {
    const missing = missingEnv(env, REQUIRED);
    if (missing.length) return { ok: false, state: "NOT_CONFIGURED", reason: `Adapter implemented; credentials missing: ${missing.join(", ")}.` };
    if (!AMAZON_TOKEN_ENDPOINTS[version(env)]) return { ok: false, state: "ERROR", reason: "AMAZON_CREATORS_CREDENTIAL_VERSION must be 3.1, 3.2 or 3.3." };
    return { ok: true };
  },

  async liveCheck(ctx) {
    const r = await searchItems("notebook", 1, ctx);
    if (!r || typeof r !== "object") throw new Error("unexpected response");
  },

  async search(req, ctx) {
    const body = await searchItems(req.query, 10, ctx);
    const mp = marketplace(ctx.env);
    const records = parseAmazonItems(body, { marketplace: mp, country: req.country, fetchedAt: ctx.now.toISOString() });
    return { records, message: `Results from ${mp} (configured marketplace; the country filter does not change it).` };
  },
};
