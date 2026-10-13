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

class Unavailable extends Error {}

const AMAZON_ALT_HOST = "amazon.co.uk";

export async function amazonSuggest(query: string, country: string, opts: Opts): Promise<Suggest> {
  const m = AMAZON_MARKETS[country];
  if (!m) throw new Unavailable(`Amazon has no marketplace for ${country}.`);
  const url = (host: string) =>
    `https://completion.${host}/api/2017/suggestions?limit=11&prefix=${encodeURIComponent(query)}&suggestion-type=KEYWORD&page-type=Gateway&site-variant=desktop&client-info=amazon-search-ui&mid=${m.mid}&alias=aps`;
  const get = (host: string) => throttled(`amazon:${host}`, () => getText(url(host), { ...opts, timeoutMs: 8000, retries: 1 }), opts.signal);
  // Suggestions are keyed by marketplace ID, so another Amazon completion host returns the same
  // marketplace's data when the local one is down (completion.amazon.in answers 502).
  const body = await get(m.domain).catch((err) => {
    if (!(err instanceof ProviderHttpError) || (err.category !== "http" && err.category !== "network" && err.category !== "timeout")) throw err;
    return get(m.domain === AMAZON_ALT_HOST ? "amazon.com" : AMAZON_ALT_HOST).catch((alt) => {
      if (alt instanceof ProviderHttpError && alt.category === "http") throw new ProviderHttpError(`${m.domain} search suggestions are not responding right now (HTTP ${alt.status}). Add Creators API keys for reliable ${m.domain} data.`, "http", alt.status);
      throw alt;
    });
  });
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
  // Countries without a local eBay site (e.g. India) buy on ebay.com, eBay's international site.
  const local = EBAY_SITES[country];
  const s = local ?? EBAY_SITES.US!;
  const body = await throttled("ebay", () => getText(`https://autosug.ebay.com/autosug?kwd=${encodeURIComponent(query)}&sId=${s.site}&_rs=1`, { ...opts, timeoutMs: 8000, retries: 1 }), opts.signal);
  return {
    list: parseEbaySuggest(body),
    country: local ? country : "US",
    label: local ? `${s.domain} search suggestions (public autocomplete)` : `ebay.com search suggestions (public autocomplete; eBay has no ${country} site, so these come from the international site)`,
    searchUrl: (kw) => `https://www.${s.domain}/sch/i.html?_nkw=${encodeURIComponent(kw)}`,
  };
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

// --- Reddit search RSS --------------------------------------------------------------------

type AtomEntry = { title?: string; link?: { "@_href"?: string } | { "@_href"?: string }[]; published?: string; updated?: string; category?: { "@_label"?: string } };
const atom = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: true, isArray: (n) => n === "entry" });
const REDDIT_TTL_MS = 10 * 60_000;
const redditCache = new Map<string, { at: number; xml: string }>();

export function parseRedditRss(xml: string, fetchedAt: string): KeywordRecord[] {
  let entries: AtomEntry[] | undefined;
  try {
    entries = (atom.parse(xml) as { feed?: { entry?: AtomEntry[] } }).feed?.entry;
  } catch {
    throw new ProviderHttpError("Reddit feed could not be parsed", "parse");
  }
  if (!entries) return [];
  return entries.flatMap((e) => {
    const title = typeof e.title === "string" ? e.title.trim() : "";
    const link = (Array.isArray(e.link) ? e.link[0] : e.link)?.["@_href"];
    if (!title || !link?.includes("/comments/")) return [];
    const category = isQuestion(title) ? ("question" as const) : ("related" as const);
    const sub = e.category?.["@_label"];
    return [
      {
        id: recordId("reddit", category, link),
        keyword: title,
        normalized: normalizeKeyword(title),
        category,
        provider: "reddit",
        method: `Reddit search RSS (public)${sub ? ` · ${sub}` : ""}`,
        dataType: "observed" as const,
        sourceUrl: link,
        fetchedAt,
        observedAt: e.published ?? e.updated,
        metrics: [],
      },
    ];
  });
}

const REDDIT_T: Record<string, string> = { "30d": "month", "90d": "year", "12m": "year", "24m": "all" };

async function redditRss(query: string, window: string, ctx: Pick<ProviderContext, "fetchImpl" | "signal" | "now">): Promise<string> {
  const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(query)}&sort=relevance&t=${REDDIT_T[window] ?? "year"}&limit=25`;
  const hit = redditCache.get(url);
  if (hit && ctx.now.getTime() - hit.at < REDDIT_TTL_MS) return hit.xml;
  if (!throttles.has("reddit")) throttles.set("reddit", createThrottle(2000));
  const xml = await throttles.get("reddit")!(() => getText(url, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, timeoutMs: 10_000 }), ctx.signal);
  redditCache.set(url, { at: ctx.now.getTime(), xml });
  return xml;
}

export const redditFallback: Fallback = {
  provides: ["Reddit post titles matching your query, with links (public search feed, no key)"],
  supports: { country: false, language: false, window: true },
  async search(req, ctx) {
    const records = parseRedditRss(await redditRss(req.query, req.window, ctx), ctx.now.toISOString());
    return { records, message: `${records.length} posts from Reddit search.` };
  },
  async liveCheck(ctx) {
    await redditRss("product review", "30d", ctx);
  },
};

// --- Flipkart search page -----------------------------------------------------------------

type FlipkartCard = {
  id?: string;
  baseUrl?: string;
  titles?: { title?: string; superTitle?: string };
  rating?: { average?: number; count?: number };
  pricing?: { finalPrice?: { value?: number; currency?: string } };
  analyticsData?: { vertical?: string };
};

const FLIPKART_TTL_MS = 10 * 60_000;
const flipkartCache = new Map<string, { at: number; html: string }>();

/** Extracts the JSON object assigned to window.__INITIAL_STATE__ without evaluating any script. */
export function extractInitialState(html: string): unknown {
  const at = html.indexOf("window.__INITIAL_STATE__");
  const start = at === -1 ? -1 : html.indexOf("{", at);
  if (start === -1) return undefined;
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (c === '"') {
      for (i++; i < html.length && html[i] !== '"'; i++) if (html[i] === "\\") i++;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function parseFlipkartSearch(html: string, fetchedAt: string): KeywordRecord[] {
  const state = extractInitialState(html) as { pageDataV4?: unknown } | undefined;
  if (!state?.pageDataV4) throw new ProviderHttpError("Flipkart search page format changed", "parse");
  const cards: FlipkartCard[] = [];
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const v = (o as { productInfo?: { value?: FlipkartCard } }).productInfo?.value;
    if (v) return void cards.push(v);
    for (const k of Object.keys(o)) walk((o as Record<string, unknown>)[k]);
  };
  walk(state.pageDataV4);
  const seen = new Set<string>();
  return cards.flatMap((p) => {
    const title = p.titles?.title?.replace(/\s+/g, " ").trim();
    if (!p.id || !title || seen.has(p.id)) return [];
    seen.add(p.id);
    const category = isQuestion(title) ? ("question" as const) : ("related" as const);
    const metrics: KeywordRecord["metrics"] = [];
    if (typeof p.rating?.count === "number" && p.rating.count > 0) {
      metrics.push({ key: "ratings", label: "Flipkart ratings", value: p.rating.count, unit: "ratings", kind: "engagement", definition: "Number of customer ratings on this product. A signal of past sales interest, not search volume." });
    }
    if (typeof p.rating?.average === "number" && p.rating.average > 0) {
      metrics.push({ key: "rating", label: "Average rating", value: p.rating.average, unit: "stars", kind: "engagement", display: `${p.rating.average} / 5`, definition: "Average customer rating on Flipkart." });
    }
    const price = p.pricing?.finalPrice;
    if (typeof price?.value === "number") {
      metrics.push({ key: "price", label: "Price", value: price.value, unit: price.currency ?? "INR", kind: "absolute", display: `₹${price.value.toLocaleString("en-IN")}`, definition: "Flipkart price at fetch time. A product attribute, not demand." });
    }
    return [
      {
        id: recordId("flipkart", category, p.id),
        keyword: title,
        normalized: normalizeKeyword(title),
        category,
        provider: "flipkart",
        method: "Product title from Flipkart's public search results page",
        dataType: "observed" as const,
        country: "IN",
        sourceUrl: p.baseUrl ? `https://www.flipkart.com${p.baseUrl.startsWith("/") ? "" : "/"}${p.baseUrl}` : undefined,
        sourceRecordId: p.id,
        fetchedAt,
        metrics,
      },
    ];
  });
}

async function flipkartPage(query: string, ctx: Pick<ProviderContext, "fetchImpl" | "signal" | "now">): Promise<string> {
  const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
  const hit = flipkartCache.get(url);
  if (hit && ctx.now.getTime() - hit.at < FLIPKART_TTL_MS) return hit.html;
  if (!throttles.has("flipkart")) throttles.set("flipkart", createThrottle(2000));
  const html = await throttles.get("flipkart")!(() => getText(url, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, timeoutMs: 12_000, maxBytes: 4_000_000 }), ctx.signal);
  flipkartCache.set(url, { at: ctx.now.getTime(), html });
  return html;
}

export const flipkartFallback: Fallback = {
  provides: ["Product titles shoppers see on Flipkart search, with ratings counts and prices (public search page, no key)"],
  supports: { country: false, language: false, window: false },
  async search(req, ctx) {
    const records = parseFlipkartSearch(await flipkartPage(req.query, ctx), ctx.now.toISOString());
    const note = req.country === "IN" ? "" : " Flipkart only sells in India, so these are Indian results.";
    return { records, message: `${records.length} products from Flipkart search.${note}` };
  },
  async liveCheck(ctx) {
    const records = parseFlipkartSearch(await flipkartPage("mobile", ctx), ctx.now.toISOString());
    if (!records.length) throw new ProviderHttpError("Flipkart search page returned no products", "parse");
  },
};

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
    supports: fb.supports,
    defaultEnabled: true,
    configuration: () => ({ ok: true }),
    async liveCheck(ctx) {
      if (official(ctx.env)) return primary.liveCheck?.(ctx);
      return fb.liveCheck(ctx);
    },
    async search(req, ctx) {
      if (official(ctx.env) && primary.search) {
        try {
          return await primary.search(req, ctx);
        } catch (err) {
          // Rejected keys shouldn't take the platform offline; the public source still works.
          if (!(err instanceof ProviderHttpError) || err.category !== "auth" || ctx.signal?.aborted) throw err;
          const res = await fb.search(req, ctx);
          return { ...res, message: `${res.message ?? ""} Your ${primary.name} API keys were rejected, so free public data was used.`.trim() };
        }
      }
      return fb.search(req, ctx);
    },
  };
}

const suggestFallback = (provider: string, fetch: (req: KeywordSearchRequest, opts: Opts) => Promise<Suggest>, check: (opts: Opts) => Promise<Suggest>, supports: KeywordProvider["supports"], provides: string[]): Fallback => ({
  provides,
  supports,
  async search(req, ctx) {
    let s: Suggest;
    try {
      s = await fetch(req, { fetchImpl: ctx.fetchImpl, signal: ctx.signal });
    } catch (err) {
      if (err instanceof Unavailable) return { records: [], message: err.message };
      throw err;
    }
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

const GDELT_BACKOFF_MS = 5 * 60_000;

/** GDELT first; Google News RSS when GDELT is unreachable or rate limited (GDELT is then skipped for a while). */
export function withNewsFallback(primary: KeywordProvider): KeywordProvider {
  let skipUntil = 0;
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
      if (ctx.now.getTime() >= skipUntil) {
        try {
          return await primary.search!(req, ctx);
        } catch (err) {
          if (ctx.signal?.aborted) throw err;
          skipUntil = ctx.now.getTime() + GDELT_BACKOFF_MS;
        }
      }
      const r = await googleNews(req.query, req, ctx);
      return { ...r, message: `${r.message} GDELT is unavailable right now.` };
    },
  };
}
