import { beforeEach, describe, expect, it } from "vitest";
import { cachedToken, clearTokenCache, createThrottle, ProviderHttpError, redactSecrets, requestJson, requestText, type FetchLike } from "@/lib/keywords/http";
import type { KeywordProvider } from "@/lib/keywords/provider";
import { amazonCreators, parseAmazonItems } from "@/lib/keywords/providers/amazon-creators";
import { dataforseo } from "@/lib/keywords/providers/dataforseo";
import { ebay, parseEbay } from "@/lib/keywords/providers/ebay";
import { etsy, parseEtsy } from "@/lib/keywords/providers/etsy";
import { flipkart, parseFlipkart } from "@/lib/keywords/providers/flipkart";
import { buildGdeltQuery, parseGdeltTimeline } from "@/lib/keywords/providers/gdelt";
import { geoTargetConstant, googleAds, googleAdsErrorCode, languageConstant, parseKeywordIdeas } from "@/lib/keywords/providers/google-ads";
import { parseEbaySuggest, parseGoogleSuggest } from "@/lib/keywords/providers/public-suggest";
import { youtube } from "@/lib/keywords/providers/youtube";
import { PROVIDERS } from "@/lib/keywords/registry";
import { runKeywordSearch } from "@/lib/keywords/search";
import type { KeywordSearchRequest } from "@/lib/keywords/types";

const NOW = new Date("2026-10-11T12:00:00Z");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Call = { url: string; init?: RequestInit };
function mockFetch(routes: [RegExp, (url: string, init?: RequestInit) => Response | Promise<Response>][]) {
  const calls: Call[] = [];
  const f: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const route = routes.find(([re]) => re.test(url));
    if (!route) throw new Error(`unexpected request ${url}`);
    return route[1](url, init);
  };
  return Object.assign(f, { calls });
}

/** Never resolves until aborted, like a hung upstream. */
const hanging: FetchLike = (_url, init) => new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));

const req = (over: Partial<KeywordSearchRequest> = {}): KeywordSearchRequest => ({ query: "air fryer", providers: [], country: "IN", language: "en", window: "12m", ...over });

async function run(p: KeywordProvider, env: Record<string, string>, fetchImpl: FetchLike, over: Partial<KeywordSearchRequest> = {}, timeoutMs?: number) {
  const res = await runKeywordSearch(req({ providers: [p.id], ...over }), [p], { env, fetchImpl, now: NOW, timeoutMs });
  return { res, outcome: res.outcomes[0]! };
}

beforeEach(() => clearTokenCache());

describe("http hardening", () => {
  it("retries 5xx then succeeds", async () => {
    let n = 0;
    const f: FetchLike = async () => (++n < 2 ? new Response("down", { status: 503 }) : new Response("ok"));
    expect(await requestText("https://x.test", { fetchImpl: f, retries: 2 })).toBe("ok");
    expect(n).toBe(2);
  });

  it("does not retry auth or rate-limit errors", async () => {
    let n = 0;
    const f: FetchLike = async () => (n++, new Response("{}", { status: 401 }));
    await expect(requestText("https://x.test", { fetchImpl: f, retries: 3 })).rejects.toMatchObject({ category: "auth", status: 401 });
    expect(n).toBe(1);
    const r: FetchLike = async () => new Response("slow down", { status: 429 });
    await expect(requestText("https://x.test", { fetchImpl: r })).rejects.toMatchObject({ category: "rate_limited" });
  });

  it("times out hung requests", async () => {
    await expect(requestText("https://x.test", { fetchImpl: hanging, timeoutMs: 30 })).rejects.toMatchObject({ category: "timeout" });
  });

  it("describes network failures in plain language", async () => {
    const f: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(requestText("https://api.example.test/x", { fetchImpl: f })).rejects.toThrow("could not reach api.example.test (network error)");
  });

  it("rejects malformed JSON as a parse error", async () => {
    const f: FetchLike = async () => new Response("<html>");
    await expect(requestJson("https://x.test", { fetchImpl: f })).rejects.toMatchObject({ category: "parse" });
  });

  it("sanitises provider error details", async () => {
    const f: FetchLike = async () => new Response('{"code":"BAD<script>"}', { status: 400 });
    await expect(requestText("https://x.test", { fetchImpl: f, errorDetail: (t) => JSON.parse(t).code })).rejects.toThrow("HTTP 400: BADscript");
  });

  it("redacts configured secrets and bearer tokens", () => {
    const env = { EBAY_CLIENT_SECRET: "supersecretvalue123", NEXT_PUBLIC_SUPABASE_URL: "https://public.example" };
    const out = redactSecrets("failed with supersecretvalue123 and Bearer abcdefghijklmnopqrstuv at https://public.example", env);
    expect(out).not.toContain("supersecretvalue123");
    expect(out).not.toContain("abcdefghijklmnopqrstuv");
    expect(out).toContain("https://public.example");
  });

  it("caches tokens until shortly before expiry", async () => {
    let n = 0;
    const get = () => cachedToken("k", NOW.getTime(), async () => ({ token: `t${++n}`, expiresInS: 3600 }));
    expect(await get()).toBe("t1");
    expect(await get()).toBe("t1");
    expect(await cachedToken("k", NOW.getTime() + 3_590_000, async () => ({ token: "t2", expiresInS: 3600 }))).toBe("t2");
  });

  it("throttles calls to the configured interval", async () => {
    const throttle = createThrottle(60);
    const starts: number[] = [];
    await Promise.all([1, 2, 3].map(() => throttle(async () => starts.push(Date.now()))));
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(55);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(55);
  });
});

describe("credential handling", () => {
  const credentialed = [googleAds, youtube, amazonCreators, flipkart, etsy, ebay];

  it("reports implemented adapters without credentials as NOT_CONFIGURED and names the missing variables", () => {
    for (const p of credentialed) {
      expect(p.implemented).toBe(true);
      const c = p.configuration({ env: {} });
      expect(c.ok).toBe(false);
      if (!c.ok) {
        expect(c.state).toBe("NOT_CONFIGURED");
        expect(c.reason).toMatch(/credentials missing: [A-Z_]+/);
      }
    }
  });

  it("skips unconfigured providers without any network request", async () => {
    const f = mockFetch([]);
    const { outcome } = await run(googleAds, {}, f);
    expect(outcome.status).toBe("skipped");
    expect(f.calls).toHaveLength(0);
  });

  it("validates the Google Ads customer ID format", () => {
    const env = { GOOGLE_ADS_DEVELOPER_TOKEN: "d", GOOGLE_ADS_CLIENT_ID: "c", GOOGLE_ADS_CLIENT_SECRET: "s", GOOGLE_ADS_REFRESH_TOKEN: "r", GOOGLE_ADS_CUSTOMER_ID: "12-34" };
    expect(googleAds.configuration({ env })).toMatchObject({ ok: false, state: "ERROR" });
  });
});

describe("keyless public sources", () => {
  const byId = (id: string) => PROVIDERS.find((p) => p.id === id)!;

  it("uses Amazon's marketplace suggestions when Creators API credentials are missing", async () => {
    const f = mockFetch([[/completion\.amazon\.co\.uk/, () => json({ suggestions: [{ value: "air fryer", type: "KEYWORD" }, { value: "air fryer liners", type: "KEYWORD" }, { value: "x", type: "WIDGET" }] })]]);
    const { res, outcome } = await run(byId("amazon"), {}, f, { country: "GB" });
    expect(outcome.status).toBe("ok");
    expect(res.records.map((r) => r.keyword)).toEqual(["air fryer", "air fryer liners"]);
    expect(res.records[0]!.sourceUrl).toBe("https://www.amazon.co.uk/s?k=air%20fryer");
    expect(res.records[0]!.metrics).toEqual([]);
    expect(outcome.message).toMatch(/AMAZON_CREATORS_CREDENTIAL_ID/);
  });

  it("calls the official API instead once credentials are set", async () => {
    const f = mockFetch([[/completion\.amazon/, () => json({ suggestions: [] })]]);
    const env = { AMAZON_CREATORS_CREDENTIAL_ID: "i", AMAZON_CREATORS_CREDENTIAL_SECRET: "s", AMAZON_PARTNER_TAG: "t-21" };
    await run(byId("amazon"), env, f).catch(() => undefined);
    expect(f.calls.some((c) => /completion\.amazon/.test(c.url))).toBe(false);
  });

  it("parses eBay's JSONP suggestions and refuses countries without an eBay site", async () => {
    expect(parseEbaySuggest('/**/vjo.AutoFill._do({"prefix":"a","res":{"sug":["air fryer oven","air fryer"]}})')).toEqual(["air fryer oven", "air fryer"]);
    const f = mockFetch([]);
    const { outcome } = await run(byId("ebay"), {}, f, { country: "IN" });
    expect(outcome.status).toBe("error");
    expect(f.calls).toHaveLength(0);
  });

  it("passes country and language to Google and YouTube suggestions", async () => {
    const f = mockFetch([[/suggestqueries/, () => json(["air fryer", ["air fryer price", "how to use air fryer"]])]]);
    const { res } = await run(byId("youtube"), {}, f, { country: "IN", language: "hi" });
    expect(f.calls[0]!.url).toMatch(/ds=yt&hl=hi&gl=IN/);
    expect(res.records.map((r) => r.category)).toEqual(["suggestion", "question"]);
    expect(parseGoogleSuggest('["q",["a","b"]]')).toEqual(["a", "b"]);
  });

  it("falls back to Google News when GDELT fails", async () => {
    const xml = `<rss><channel><item><title>Air fryer sales jump</title><link>https://news.example/a</link><pubDate>Mon, 12 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
    const f = mockFetch([
      [/gdeltproject/, () => new Response("busy", { status: 429 })],
      [/news\.google\.com/, () => new Response(xml)],
    ]);
    const { res, outcome } = await run(byId("news"), {}, f);
    expect(outcome.status).toBe("ok");
    expect(res.records[0]).toMatchObject({ keyword: "Air fryer sales jump", sourceUrl: "https://news.example/a", category: "related" });
    expect(outcome.message).toMatch(/GDELT unavailable/);
  });
});

describe("DataForSEO", () => {
  const env = { DATAFORSEO_LOGIN: "login", DATAFORSEO_PASSWORD: "pw" };

  it("sends the selected country's location code", async () => {
    const f = mockFetch([[/dataforseo/, () => json({ tasks: [{ result: [{ keyword: "air fryer", search_volume: 1000 }] }] })]]);
    const { outcome } = await run(dataforseo, env, f, { country: "GB" });
    expect(outcome.status).toBe("ok");
    expect(JSON.parse(String(f.calls[0]!.init!.body))[0].location_code).toBe(2826);
  });

  it("returns nothing instead of another country's figures for unmapped countries", async () => {
    const f = mockFetch([]);
    const { res } = await run(dataforseo, env, f, { country: "ZZ" });
    expect(f.calls).toHaveLength(0);
    expect(res.records).toHaveLength(0);
  });
});

describe("Google Ads keyword planner", () => {
  const env = {
    GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token-123456",
    GOOGLE_ADS_CLIENT_ID: "client.apps.googleusercontent.com",
    GOOGLE_ADS_CLIENT_SECRET: "client-secret-123456",
    GOOGLE_ADS_REFRESH_TOKEN: "refresh-token-123456",
    GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: "999-888-7777",
  };
  const idea = (text: string, avg: string) => ({
    text,
    keywordIdeaMetrics: {
      avgMonthlySearches: avg,
      competition: "HIGH",
      competitionIndex: "87",
      lowTopOfPageBidMicros: "4500000",
      highTopOfPageBidMicros: "21000000",
      averageCpcMicros: "9800000",
      monthlySearchVolumes: [
        { month: "OCTOBER", year: "2025", monthlySearches: "40500" },
        { month: "SEPTEMBER", year: "2025", monthlySearches: "33100" },
      ],
    },
  });

  it("maps countries and languages to Google criterion IDs", () => {
    expect(geoTargetConstant("IN")).toBe("geoTargetConstants/2356");
    expect(geoTargetConstant("US")).toBe("geoTargetConstants/2840");
    expect(geoTargetConstant("ZZ")).toBeUndefined();
    expect(languageConstant("en")).toBe("languageConstants/1000");
    expect(languageConstant("hi")).toBe("languageConstants/1023");
  });

  it("parses ideas: int64 strings, micros to currency, sorted monthly history", () => {
    const [r] = parseKeywordIdeas([idea("air fryer", "40500")], { currency: "INR", country: "IN", language: "en", fetchedAt: NOW.toISOString() });
    const m = Object.fromEntries(r!.metrics.map((x) => [x.key, x]));
    expect(m.avg_monthly_searches!.value).toBe(40500);
    expect(m.avg_monthly_searches!.kind).toBe("absolute");
    expect(m.competition_index!.display).toBe("HIGH (87)");
    expect(m.top_bid_low!.value).toBe(4.5);
    expect(m.top_bid_high!.display).toBe("21.00 INR");
    expect(m.avg_cpc!.value).toBeCloseTo(9.8);
    expect(r!.history!.points.map((p) => p.date)).toEqual(["2025-09-01", "2025-10-01"]);
  });

  it("omits metrics Google did not return instead of inventing them", () => {
    const [r] = parseKeywordIdeas([{ text: "rare phrase", keywordIdeaMetrics: {} }], { country: "IN", language: "en", fetchedAt: NOW.toISOString() });
    expect(r!.metrics).toEqual([]);
    expect(r!.history).toBeUndefined();
  });

  it("extracts GoogleAdsFailure error codes", () => {
    const body = JSON.stringify({ error: { code: 403, status: "PERMISSION_DENIED", details: [{ errors: [{ errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" } }] }] } });
    expect(googleAdsErrorCode(body)).toBe("DEVELOPER_TOKEN_NOT_APPROVED");
  });

  it("runs the full OAuth + currency + ideas flow with correct headers and body", async () => {
    const f = mockFetch([
      [/oauth2\.googleapis\.com\/token/, () => json({ access_token: "ya29.access-token-value", expires_in: 3599 })],
      [/googleAds:search$/, () => json({ results: [{ customer: { currencyCode: "INR" } }] })],
      [/:generateKeywordIdeas$/, () => json({ results: [idea("air fryer", "40500"), idea("how to clean air fryer", "2900")], totalSize: "450" })],
    ]);
    const { res, outcome } = await run(googleAds, env, f);
    expect(outcome.status).toBe("ok");
    expect(outcome.message).toContain("first page of 450");
    expect(res.records.find((r) => r.keyword === "how to clean air fryer")!.category).toBe("question");
    expect(res.seedHistory?.unit).toBe("searches");
    expect(res.records.find((r) => r.id === res.seeds?.["google-ads"])?.keyword).toBe("air fryer");
    const call = f.calls.find((c) => c.url.endsWith(":generateKeywordIdeas"))!;
    expect(call.url).toBe("https://googleads.googleapis.com/v25/customers/1234567890:generateKeywordIdeas");
    const h = call.init!.headers as Record<string, string>;
    expect(h["developer-token"]).toBe(env.GOOGLE_ADS_DEVELOPER_TOKEN);
    expect(h["login-customer-id"]).toBe("9998887777");
    expect(h.authorization).toBe("Bearer ya29.access-token-value");
    const body = JSON.parse(String(call.init!.body));
    expect(body).toMatchObject({ language: "languageConstants/1000", geoTargetConstants: ["geoTargetConstants/2356"], keywordPlanNetwork: "GOOGLE_SEARCH", keywordSeed: { keywords: ["air fryer"] } });
  });

  it("returns empty when Google has no ideas", async () => {
    const f = mockFetch([
      [/oauth2/, () => json({ access_token: "tok-aaaaaaaaaaaaaaaa", expires_in: 3599 })],
      [/googleAds:search$/, () => json({ results: [{ customer: { currencyCode: "USD" } }] })],
      [/:generateKeywordIdeas$/, () => json({})],
    ]);
    expect((await run(googleAds, env, f)).outcome.status).toBe("empty");
  });

  it("maps an unapproved developer token to ACCESS_REQUIRED without leaking secrets", async () => {
    const failure = { error: { code: 403, status: "PERMISSION_DENIED", details: [{ errors: [{ errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" } }] }] } };
    const f = mockFetch([
      [/oauth2/, () => json({ access_token: "tok-bbbbbbbbbbbbbbbb", expires_in: 3599 })],
      [/googleads/, () => json(failure, 403)],
    ]);
    const { outcome } = await run(googleAds, env, f);
    expect(outcome.status).toBe("error");
    expect(outcome.state).toBe("ACCESS_REQUIRED");
    expect(outcome.message).toContain("DEVELOPER_TOKEN_NOT_APPROVED");
    expect(outcome.message).not.toContain(env.GOOGLE_ADS_DEVELOPER_TOKEN);
  });

  it("maps a revoked refresh token to ACCESS_REQUIRED", async () => {
    const f = mockFetch([[/oauth2/, () => json({ error: "invalid_grant" }, 400)]]);
    const { outcome } = await run(googleAds, env, f);
    expect(outcome.state).toBe("ACCESS_REQUIRED");
    expect(outcome.message).toContain("invalid_grant");
  });

  it("maps RESOURCE_EXHAUSTED (429) to RATE_LIMITED", async () => {
    const f = mockFetch([
      [/oauth2/, () => json({ access_token: "tok-cccccccccccccccc", expires_in: 3599 })],
      [/googleAds:search$/, () => json({ results: [{ customer: { currencyCode: "USD" } }] })],
      [/:generateKeywordIdeas$/, () => json({ error: { code: 429, status: "RESOURCE_EXHAUSTED" } }, 429)],
    ]);
    expect((await run(googleAds, env, f)).outcome.state).toBe("RATE_LIMITED");
  });

  it("rejects a malformed ideas payload", async () => {
    const f = mockFetch([
      [/oauth2/, () => json({ access_token: "tok-dddddddddddddddd", expires_in: 3599 })],
      [/googleAds:search$/, () => json({ results: [{ customer: { currencyCode: "USD" } }] })],
      [/:generateKeywordIdeas$/, () => json({ results: "nope" })],
    ]);
    expect((await run(googleAds, env, f)).outcome.status).toBe("error");
  });
});

describe("GDELT news", () => {
  it("quotes phrases and adds the source language", () => {
    expect(buildGdeltQuery("air fryer", "en")).toBe('"air fryer" sourcelang:english');
    expect(buildGdeltQuery("earbuds", "xx")).toBe("earbuds");
  });

  it("parses the coverage timeline and matching headlines", () => {
    const body = JSON.stringify({
      timeline: [
        {
          series: "Volume Intensity",
          data: [
            { date: "20261009T000000Z", value: 0.0066, toparts: [{ url: "https://news.test/a", title: "Best air fryer deals" }, { url: "https://news.test/b", title: "Election results" }] },
            { date: "20261010T000000Z", value: 0.0081, toparts: [{ url: "https://news.test/c", title: "Is an air fryer worth it?" }] },
          ],
        },
      ],
    });
    const { history, records } = parseGdeltTimeline(body, "air fryer", NOW.toISOString());
    expect(history!.points).toEqual([{ date: "2026-10-09", value: 0.0066 }, { date: "2026-10-10", value: 0.0081 }]);
    expect(history!.kind).toBe("relative_index");
    expect(records.map((r) => r.keyword)).toEqual(["Best air fryer deals", "Is an air fryer worth it?"]);
    expect(records[1]!.category).toBe("question");
  });

  it("treats an empty timeline as no data and plain-text errors as failures", () => {
    expect(parseGdeltTimeline("{}", "x", NOW.toISOString())).toEqual({ history: undefined, records: [] });
    expect(() => parseGdeltTimeline("Your search contained a phrase that was too short.", "x", NOW.toISOString())).toThrow(ProviderHttpError);
  });
});

describe("YouTube", () => {
  const env = { YOUTUBE_API_KEY: "AIzaTestKey123456789" };

  it("joins search results with statistics", async () => {
    const f = mockFetch([
      [/\/search\?/, () => json({ items: [{ id: { videoId: "v1" }, snippet: { title: "How to use an air fryer &amp; clean it?", publishedAt: "2026-09-01T00:00:00Z" } }] })],
      [/\/videos\?part=statistics/, () => json({ items: [{ id: "v1", statistics: { viewCount: "120000", likeCount: "3400" } }] })],
    ]);
    const { res, outcome } = await run(youtube, env, f);
    expect(outcome.status).toBe("ok");
    const r = res.records[0]!;
    expect(r.keyword).toBe("How to use an air fryer & clean it?");
    expect(r.category).toBe("question");
    expect(r.metrics.map((m) => m.key)).toEqual(["yt_views", "yt_likes"]);
    expect(f.calls[0]!.url).toContain("regionCode=IN");
  });

  it("maps quotaExceeded to RATE_LIMITED", async () => {
    const f = mockFetch([[/\/search\?/, () => json({ error: { errors: [{ reason: "quotaExceeded" }] } }, 403)]]);
    const { outcome } = await run(youtube, env, f);
    expect(outcome.state).toBe("RATE_LIMITED");
    expect(outcome.message).not.toContain(env.YOUTUBE_API_KEY);
  });

  it("checks connectivity without spending search.list quota", async () => {
    const f = mockFetch([[/\/videos\?part=id/, () => json({ items: [{ id: "x" }] })]]);
    await youtube.liveCheck!({ env, fetchImpl: f, now: NOW });
    expect(f.calls.every((c) => !c.url.includes("/search?"))).toBe(true);
  });

  it("times out a hung upstream", async () => {
    const { outcome } = await run(youtube, env, hanging, {}, 40);
    expect(outcome.status).toBe("timeout");
  });
});

describe("Amazon Creators API", () => {
  const env = { AMAZON_CREATORS_CREDENTIAL_ID: "amzn-cred-id-123", AMAZON_CREATORS_CREDENTIAL_SECRET: "amzn-secret-123456", AMAZON_PARTNER_TAG: "mytag-21" };

  it("parses search items and prefers the buy-box listing", () => {
    const body = { searchResult: { items: [{ asin: "B0TEST", detailPageURL: "https://www.amazon.in/dp/B0TEST", itemInfo: { title: { displayValue: "Air Fryer 4L" } }, offersV2: { listings: [{ price: { money: { amount: 5999, currency: "INR" } } }, { isBuyBoxWinner: true, price: { money: { amount: 4999, currency: "INR" } } }] } }] } };
    const [r] = parseAmazonItems(body, { marketplace: "www.amazon.in", country: "IN", fetchedAt: NOW.toISOString() });
    expect(r!.metrics[0]!.value).toBe(4999);
    expect(parseAmazonItems({}, { marketplace: "www.amazon.in", country: "IN", fetchedAt: "" })).toEqual([]);
    expect(() => parseAmazonItems({ searchResult: { items: {} } }, { marketplace: "", country: "IN", fetchedAt: "" })).toThrow(ProviderHttpError);
  });

  it("uses the EU (3.2) token endpoint, bearer token and marketplace header", async () => {
    const f = mockFetch([
      [/api\.amazon\.co\.uk\/auth\/o2\/token/, () => json({ access_token: "Atc|amazon-token-value", expires_in: 3600 })],
      [/creatorsapi\.amazon\/catalog\/v1\/searchItems/, () => json({ searchResult: { items: [] } })],
    ]);
    const { outcome } = await run(amazonCreators, env, f);
    expect(outcome.status).toBe("empty");
    const call = f.calls[1]!;
    expect((call.init!.headers as Record<string, string>)["x-marketplace"]).toBe("www.amazon.in");
    expect(JSON.parse(String(call.init!.body))).toMatchObject({ keywords: "air fryer", partnerTag: "mytag-21" });
    expect(JSON.parse(String(f.calls[0]!.init!.body)).scope).toBe("creatorsapi::default");
  });

  it("maps rejected credentials to ACCESS_REQUIRED", async () => {
    const f = mockFetch([[/token/, () => json({ error: "invalid_client" }, 401)]]);
    expect((await run(amazonCreators, env, f)).outcome.state).toBe("ACCESS_REQUIRED");
  });
});

describe("Flipkart Affiliate", () => {
  const env = { FLIPKART_AFFILIATE_ID: "affid", FLIPKART_AFFILIATE_TOKEN: "afftoken123456" };

  it("parses products and sends affiliate headers", async () => {
    const f = mockFetch([[/affiliate-api\.flipkart\.net/, () => json({ products: [{ productBaseInfoV1: { productId: "P1", title: "Air Fryer", productUrl: "https://dl.flipkart.com/x", flipkartSpecialPrice: { amount: 3999, currency: "INR" } } }] })]]);
    const { res } = await run(flipkart, env, f);
    expect(res.records[0]!.metrics[0]!.value).toBe(3999);
    expect((f.calls[0]!.init!.headers as Record<string, string>)["Fk-Affiliate-Id"]).toBe("affid");
    expect(f.calls[0]!.url).toContain("resultCount=10");
  });

  it("handles empty and malformed responses", () => {
    expect(parseFlipkart({ products: [] }, "")).toEqual([]);
    expect(() => parseFlipkart({ products: 5 }, "")).toThrow(ProviderHttpError);
  });
});

describe("eBay Browse", () => {
  const env = { EBAY_CLIENT_ID: "ebay-client-id", EBAY_CLIENT_SECRET: "ebay-client-secret-1" };

  it("uses an application token and the country marketplace", async () => {
    const f = mockFetch([
      [/identity\/v1\/oauth2\/token/, () => json({ access_token: "v^1.1#ebay-token", expires_in: 7200 })],
      [/item_summary\/search/, () => json({ total: 1234, itemSummaries: [{ itemId: "v1|1|0", title: "Air fryer basket", itemWebUrl: "https://www.ebay.co.uk/itm/1", price: { value: "12.50", currency: "GBP" } }] })],
    ]);
    const { res, outcome } = await run(ebay, env, f, { country: "GB" });
    expect(outcome.message).toContain("1,234 matching listings on EBAY_GB");
    expect(res.records[0]!.metrics[0]!.value).toBe(12.5);
    expect((f.calls[1]!.init!.headers as Record<string, string>)["X-EBAY-C-MARKETPLACE-ID"]).toBe("EBAY_GB");
    expect(String(f.calls[0]!.init!.body)).toContain("scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope");
  });

  it("reports unsupported countries without calling eBay", async () => {
    const f = mockFetch([]);
    const { outcome } = await run(ebay, env, f, { country: "IN" });
    expect(outcome.status).toBe("empty");
    expect(outcome.message).toContain("no marketplace for IN");
    expect(f.calls).toHaveLength(0);
  });

  it("parses empty and malformed payloads", () => {
    expect(parseEbay({ total: 0 }, { country: "US", fetchedAt: "" })).toEqual({ records: [], total: 0 });
    expect(() => parseEbay({ itemSummaries: {} }, { country: "US", fetchedAt: "" })).toThrow(ProviderHttpError);
  });
});

describe("Etsy", () => {
  const env = { ETSY_API_KEY: "keystring123", ETSY_SHARED_SECRET: "sharedsecret123" };

  it("sends keystring:secret and parses listings", async () => {
    const f = mockFetch([[/api\.etsy\.com\/v3\/application\/listings\/active/, () => json({ count: 812, results: [{ listing_id: 1, title: "Air fryer liners &amp; cover", url: "https://www.etsy.com/listing/1", num_favorers: 45, price: { amount: 1299, divisor: 100, currency_code: "USD" } }] })]]);
    const { res, outcome } = await run(etsy, env, f, { country: "US" });
    expect(outcome.message).toContain("812 active listings");
    expect(res.records[0]!.keyword).toBe("Air fryer liners & cover");
    expect(res.records[0]!.metrics.find((m) => m.key === "price")!.value).toBe(12.99);
    expect((f.calls[0]!.init!.headers as Record<string, string>)["x-api-key"]).toBe("keystring123:sharedsecret123");
  });

  it("maps 403 inactive key to ACCESS_REQUIRED and 429 to RATE_LIMITED", async () => {
    const denied = mockFetch([[/etsy/, () => json({ error: "API key not found or not active" }, 403)]]);
    expect((await run(etsy, env, denied)).outcome.state).toBe("ACCESS_REQUIRED");
    const limited = mockFetch([[/etsy/, () => json({ error: "rate limit" }, 429)]]);
    expect((await run(etsy, env, limited)).outcome.state).toBe("RATE_LIMITED");
  });

  it("parses malformed payloads as errors", () => {
    expect(() => parseEtsy({ results: "x" }, "")).toThrow(ProviderHttpError);
  });
});

describe("seed chart priority", () => {
  it("prefers observed search counts over proxy series", async () => {
    const proxy: KeywordProvider = {
      ...googleAds,
      id: "proxy",
      configuration: () => ({ ok: true }),
      search: async () => ({ records: [], seedHistory: { label: "views", unit: "views", kind: "absolute", granularity: "daily", points: [{ date: "2026-10-01", value: 1 }], definition: "" } }),
    };
    const searches: KeywordProvider = {
      ...googleAds,
      id: "searches",
      configuration: () => ({ ok: true }),
      search: async () => ({ records: [], seedHistory: { label: "s", unit: "searches", kind: "absolute", granularity: "monthly", points: [{ date: "2026-09-01", value: 2 }], definition: "" } }),
    };
    const res = await runKeywordSearch(req({ providers: ["proxy", "searches"] }), [proxy, searches], { env: {}, now: NOW });
    expect(res.seedHistory?.provider).toBe("searches");
  });

  it("prefers absolute counts over a coverage index regardless of order", async () => {
    const coverage: KeywordProvider = {
      ...googleAds,
      id: "coverage",
      configuration: () => ({ ok: true }),
      search: async () => ({ records: [], seedHistory: { label: "c", unit: "%", kind: "relative_index", granularity: "daily", points: [{ date: "2026-10-01", value: 0.1 }], definition: "" } }),
    };
    const views: KeywordProvider = {
      ...googleAds,
      id: "views",
      configuration: () => ({ ok: true }),
      search: async () => ({ records: [], seedHistory: { label: "v", unit: "views", kind: "absolute", granularity: "daily", points: [{ date: "2026-10-01", value: 9 }], definition: "" } }),
    };
    const res = await runKeywordSearch(req({ providers: ["coverage", "views"] }), [coverage, views], { env: {}, now: NOW });
    expect(res.seedHistory?.provider).toBe("views");
  });
});
