import { XMLParser } from "fast-xml-parser";
import { createThrottle, getText, ProviderHttpError, type RequestOptions } from "../http";
import type { KeywordProvider, ProviderContext, ProviderSearchResult } from "../provider";
import { isQuestion, normalizeKeyword, recordId } from "../text";
import type { KeywordRecord, KeywordSearchRequest } from "../types";

/**
 * Keyless sources: the public search-suggestion endpoints the platforms' own search boxes call,
 * and Google News RSS. They are undocumented, so each is throttled and treated as best-effort.
 */

type Opts = Pick<RequestOptions, "fetchImpl" | "signal">;
type Suggest = { list: string[]; country?: string; language?: string; searchUrl: (kw: string) => string; label: string };

const throttles = new Map<string, ReturnType<typeof createThrottle>>();
const throttled = <T>(key: string, fn: () => Promise<T>, signal?: AbortSignal) => {
  if (!throttles.has(key)) throttles.set(key, createThrottle(1000));
  return throttles.get(key)!(fn, signal);
};

export function suggestionRecords(provider: string, s: Suggest, fetchedAt: string): KeywordRecord[] {
  const seen = new Set<string>();
  return s.list.flatMap((raw) => {
    const keyword = raw.trim();
    const normalized = normalizeKeyword(keyword);
    if (!keyword || seen.has(normalized)) return [];
    seen.add(normalized);
    const category = isQuestion(keyword) ? ("question" as const) : ("suggestion" as const);
    return [
      {
        id: recordId(provider, category, `${s.country ?? ""}:${normalized}`),
        keyword,
        normalized,
        category,
        provider,
        method: s.label,
        dataType: "observed" as const,
        country: s.country,
        language: s.language,
        sourceUrl: s.searchUrl(keyword),
        fetchedAt,
        metrics: [],
      },
    ];
  });
}

// --- Amazon -------------------------------------------------------------------------------

/** Marketplace domain and ID per country. */
export const AMAZON_MARKETS: Record<string, { domain: string; mid: string }> = {
  US: { domain: "amazon.com", mid: "ATVPDKIKX0DER" },
  IN: { domain: "amazon.in", mid: "A21TJRUUN4KGV" },
  GB: { domain: "amazon.co.uk", mid: "A1F83G8C2ARO7P" },
  DE: { domain: "amazon.de", mid: "A1PA6795UKMFR9" },
  FR: { domain: "amazon.fr", mid: "A13V1IB3VIYZZH" },
  IT: { domain: "amazon.it", mid: "APJ6JRA9NG5V4" },
  ES: { domain: "amazon.es", mid: "A1RKKUPIHCS9HS" },
  NL: { domain: "amazon.nl", mid: "A1805IZSGTT6HS" },
  CA: { domain: "amazon.ca", mid: "A2EUQ1WTGCTBG2" },
  MX: { domain: "amazon.com.mx", mid: "A1AM78C64UM0Y8" },
  BR: { domain: "amazon.com.br", mid: "A2Q3Y263D00KWC" },
  JP: { domain: "amazon.co.jp", mid: "A1VC38T7YXB528" },
  AU: { domain: "amazon.com.au", mid: "A39IBJ37TRP1C6" },
  AE: { domain: "amazon.ae", mid: "A2VIGQ35RCS4UG" },
  SA: { domain: "amazon.sa", mid: "A17E79C6D8DWNP" },
  SG: { domain: "amazon.sg", mid: "A19VAU5U5O7RUS" },
  TR: { domain: "amazon.com.tr", mid: "A33AVAJ2PDY3EV" },
};

export function parseAmazonSuggest(body: string): string[] {
  try {
    const j = JSON.parse(body) as { suggestions?: { value?: string; type?: string }[] };
    return (j.suggestions ?? []).filter((s) => s.type !== "WIDGET" && typeof s.value === "string").map((s) => s.value!);
  } catch {
    throw new ProviderHttpError("Amazon suggestions format changed", "parse");
  }
}

export async function amazonSuggest(query: string, country: string, opts: Opts): Promise<Suggest> {
  const m = AMAZON_MARKETS[country];
  if (!m) throw new ProviderHttpError(`No Amazon marketplace for ${country}`, "http", 404);
  const url = `https://completion.${m.domain}/api/2017/suggestions?limit=11&prefix=${encodeURIComponent(query)}&suggestion-type=KEYWORD&page-type=Gateway&site-variant=desktop&client-info=amazon-search-ui&mid=${m.mid}&alias=aps`;
  const body = await throttled(`amazon:${m.domain}`, () => getText(url, { ...opts, timeoutMs: 8000, retries: 1 }), opts.signal);
  return { list: parseAmazonSuggest(body), country, label: `${m.domain} search suggestions (public autocomplete)`, searchUrl: (kw) => `https://www.${m.domain}/s?k=${encodeURIComponent(kw)}` };
}

// --- eBay ---------------------------------------------------------------------------------

export const EBAY_SITES: Record<string, { site: number; domain: string }> = {
  US: { site: 0, domain: "ebay.com" },
  CA: { site: 2, domain: "ebay.ca" },
  GB: { site: 3, domain: "ebay.co.uk" },
  AU: { site: 15, domain: "ebay.com.au" },
  FR: { site: 71, domain: "ebay.fr" },
  DE: { site: 77, domain: "ebay.de" },
  IT: { site: 101, domain: "ebay.it" },
  NL: { site: 146, domain: "ebay.nl" },
  ES: { site: 186, domain: "ebay.es" },
};

export function parseEbaySuggest(body: string): string[] {
  const m = body.match(/\((\{[\s\S]*\})\)\s*;?\s*$/);
  try {
    const j = JSON.parse(m ? m[1]! : body) as { res?: { sug?: string[] } };
    return j.res?.sug ?? [];
  } catch {
    throw new ProviderHttpError("eBay suggestions format changed", "parse");
  }
}

export async function ebaySuggest(query: string, country: string, opts: Opts): Promise<Suggest> {
  const s = EBAY_SITES[country];
  if (!s) throw new ProviderHttpError(`eBay has no site for ${country}`, "http", 404);
  const body = await throttled("ebay", () => getText(`https://autosug.ebay.com/autosug?kwd=${encodeURIComponent(query)}&sId=${s.site}&_rs=1`, { ...opts, timeoutMs: 8000, retries: 1 }), opts.signal);
  return { list: parseEbaySuggest(body), country, label: `${s.domain} search suggestions (public autocomplete)`, searchUrl: (kw) => `https://www.${s.domain}/sch/i.html?_nkw=${encodeURIComponent(kw)}` };
}

// --- Google and YouTube -------------------------------------------------------------------

export function parseGoogleSuggest(body: string): string[] {
  try {
    const j = JSON.parse(body) as [string, string[]];
    return Array.isArray(j?.[1]) ? j[1].filter((s) => typeof s === "string") : [];
  } catch {
    throw new ProviderHttpError("Google suggestions format changed", "parse");
  }
}

export async function googleSuggest(query: string, req: Pick<KeywordSearchRequest, "country" | "language">, youtube: boolean, opts: Opts): Promise<Suggest> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ie=utf-8&oe=utf-8${youtube ? "&ds=yt" : ""}&hl=${encodeURIComponent(req.language)}&gl=${encodeURIComponent(req.country)}&q=${encodeURIComponent(query)}`;
  const body = await throttled(youtube ? "youtube" : "google", () => getText(url, { ...opts, timeoutMs: 8000, retries: 1 }), opts.signal);
  return {
    list: parseGoogleSuggest(body),
    country: req.country,
    language: req.language,
    label: youtube ? `YouTube search suggestions (public autocomplete, ${req.country})` : `Google search suggestions (public autocomplete, ${req.country})`,
    searchUrl: youtube ? (kw) => `https://www.youtube.com/results?search_query=${encodeURIComponent(kw)}` : (kw) => `https://www.google.com/search?q=${encodeURIComponent(kw)}&gl=${req.country}`,
  };
}

// --- Google News RSS ----------------------------------------------------------------------

type RssItem = { title?: string; link?: string; pubDate?: string };
const rss = new XMLParser({ ignoreAttributes: true, processEntities: true, isArray: (n) => n === "item" });

export function parseGoogleNews(xml: string, country: string, fetchedAt: string): KeywordRecord[] {
  let items: RssItem[] | undefined;
  try {
    items = (rss.parse(xml) as { rss?: { channel?: { item?: RssItem[] } } }).rss?.channel?.item;
  } catch {
    throw new ProviderHttpError("Google News feed could not be parsed", "parse");
  }
  if (!Array.isArray(items)) throw new ProviderHttpError("Google News feed format changed", "parse");
  return items
    .filter((i) => typeof i.title === "string" && i.title.trim() && typeof i.link === "string")
    .slice(0, 30)
    .map((i) => {
      const title = String(i.title).trim();
      return {
        id: recordId("news", "related", i.link!),
        keyword: title,
        normalized: normalizeKeyword(title),
        category: "related" as const,
        provider: "news",
        method: `Google News RSS search (${country})`,
        dataType: "observed" as const,
        country,
        sourceUrl: i.link,
        fetchedAt,
        observedAt: i.pubDate ? new Date(i.pubDate).toISOString() : undefined,
        metrics: [],
      };
    });
}

export async function googleNews(query: string, req: Pick<KeywordSearchRequest, "country" | "language">, ctx: ProviderContext): Promise<ProviderSearchResult> {
  const hl = `${req.language}-${req.country}`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${encodeURIComponent(hl)}&gl=${req.country}&ceid=${req.country}:${req.language}`;
  const xml = await throttled("gnews", () => getText(url, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, timeoutMs: 10_000, retries: 1 }), ctx.signal);
  const records = parseGoogleNews(xml, req.country, ctx.now.toISOString());
  return { records, message: `${records.length} headlines from Google News.` };
}

// --- Wrappers -----------------------------------------------------------------------------

type Fallback = {
  provides: string[];
  supports: KeywordProvider["supports"];
  search(req: KeywordSearchRequest, ctx: ProviderContext): Promise<ProviderSearchResult>;
  liveCheck(ctx: ProviderContext): Promise<void>;
};

/** Uses the official API when its credentials are set, otherwise the keyless public source. */
export function withPublicFallback(primary: KeywordProvider, fb: Fallback, missingNote: string): KeywordProvider {
  const official = (env: ProviderContext["env"]) => primary.configuration({ env }).ok;
  return {
    ...primary,
    access: `${primary.access} Without credentials, ${missingNote}`,
    provides: [...fb.provides, ...primary.provides.map((p) => `${p} (with API credentials)`)],
    supports: { country: primary.supports.country && fb.supports.country, language: primary.supports.language && fb.supports.language, window: primary.supports.window && fb.supports.window },
    defaultEnabled: true,
    configuration: () => ({ ok: true }),
    async liveCheck(ctx) {
      if (official(ctx.env)) return primary.liveCheck?.(ctx);
      return fb.liveCheck(ctx);
    },
    async search(req, ctx) {
      if (official(ctx.env) && primary.search) return primary.search(req, ctx);
      const res = await fb.search(req, ctx);
      const missing = primary.configuration({ env: ctx.env });
      const hint = missing.ok ? "" : ` ${missing.reason.replace(/^Adapter implemented; credentials missing:/, "Add")} for full API data.`;
      return { ...res, message: `${res.message ?? ""}${hint}`.trim() };
    },
  };
}

const suggestFallback = (provider: string, fetch: (req: KeywordSearchRequest, opts: Opts) => Promise<Suggest>, check: (opts: Opts) => Promise<Suggest>, supports: KeywordProvider["supports"], provides: string[]): Fallback => ({
  provides,
  supports,
  async search(req, ctx) {
    const s = await fetch(req, { fetchImpl: ctx.fetchImpl, signal: ctx.signal });
    const records = suggestionRecords(provider, s, ctx.now.toISOString());
    return { records, message: `${records.length} suggestions from ${s.label}.` };
  },
  async liveCheck(ctx) {
    const s = await check({ fetchImpl: ctx.fetchImpl, signal: ctx.signal });
    if (!s.list.length) throw new ProviderHttpError("Suggestion endpoint returned nothing", "parse");
  },
});

export const amazonFallback = suggestFallback("amazon", (r, o) => amazonSuggest(r.query, r.country, o), (o) => amazonSuggest("phone", "US", o), { country: true, language: false, window: false }, [
  "What shoppers type into Amazon search (autocomplete, no key)",
]);

export const ebayFallback = suggestFallback("ebay", (r, o) => ebaySuggest(r.query, r.country, o), (o) => ebaySuggest("phone", "US", o), { country: true, language: false, window: false }, [
  "What shoppers type into eBay search (autocomplete, no key)",
]);

export const googleFallback = suggestFallback("google-ads", (r, o) => googleSuggest(r.query, r, false, o), (o) => googleSuggest("phone", { country: "US", language: "en" }, false, o), { country: true, language: true, window: false }, [
  "Google search autocomplete suggestions (no key)",
]);

export const youtubeFallback = suggestFallback("youtube", (r, o) => googleSuggest(r.query, r, true, o), (o) => googleSuggest("phone", { country: "US", language: "en" }, true, o), { country: true, language: true, window: false }, [
  "YouTube search autocomplete suggestions (no key)",
]);

/** GDELT first; Google News RSS when GDELT is unreachable or rate limited. */
export function withNewsFallback(primary: KeywordProvider): KeywordProvider {
  return {
    ...primary,
    name: "News",
    access: `${primary.access} Falls back to the public Google News RSS search when GDELT is unavailable.`,
    provides: [...primary.provides, "Google News headlines when GDELT is unavailable"],
    async liveCheck(ctx) {
      try {
        await primary.liveCheck?.(ctx);
      } catch {
        const r = await googleNews("news", { country: "US", language: "en" }, ctx);
        if (!r.records.length) throw new ProviderHttpError("Google News returned no items", "parse");
      }
    },
    async search(req, ctx) {
      try {
        return await primary.search!(req, ctx);
      } catch (err) {
        if (ctx.signal?.aborted) throw err;
        const r = await googleNews(req.query, req, ctx);
        return { ...r, message: `GDELT unavailable; ${r.message}` };
      }
    },
  };
}
