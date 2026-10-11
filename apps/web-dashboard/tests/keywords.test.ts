import { describe, expect, it } from "vitest";
import { parseAiIdeas } from "@/lib/keywords/ai";
import type { KeywordProvider } from "@/lib/keywords/provider";
import { matchTrending, parseTrendingRss } from "@/lib/keywords/providers/google-trends-rss";
import { parseStackExchange } from "@/lib/keywords/providers/stackexchange";
import { analyzeArticle, planWindow } from "@/lib/keywords/providers/wikipedia";
import { PROVIDERS } from "@/lib/keywords/registry";
import { runKeywordSearch, validateSearchRequest } from "@/lib/keywords/search";
import { classifyIntent, isQuestion, prepositionIn, sharesToken } from "@/lib/keywords/text";
import type { KeywordRecord, KeywordSearchRequest } from "@/lib/keywords/types";
import { EMPTY_FILTERS, filterRows, inTab, paginate, sortRows, toCsv, toJsonExport, toRows } from "@/lib/keywords/view";
import { createRateLimiter } from "@/lib/rate-limit";

const NOW = new Date("2026-10-11T12:00:00Z");

const rec = (over: Partial<KeywordRecord>): KeywordRecord => ({
  id: over.id ?? `t:${over.keyword}`,
  keyword: "x",
  normalized: "x",
  category: "suggestion",
  provider: "wikipedia",
  method: "test",
  dataType: "observed",
  fetchedAt: NOW.toISOString(),
  metrics: [],
  ...over,
});

describe("text utilities", () => {
  it("detects questions in English, Hinglish and Hindi", () => {
    expect(isQuestion("how to clean earbuds")).toBe(true);
    expect(isQuestion("earbuds under 2000?")).toBe(true);
    expect(isQuestion("kaise kare saree draping")).toBe(true);
    expect(isQuestion("ईयरबड्स कैसे साफ करें")).toBe(true);
    expect(isQuestion("wireless earbuds")).toBe(false);
  });

  it("finds prepositions but not substrings", () => {
    expect(prepositionIn("earbuds for running")).toBe("for");
    expect(prepositionIn("iphone vs samsung")).toBe("vs");
    expect(prepositionIn("information technology")).toBeUndefined();
  });

  it("classifies intent by rule", () => {
    expect(classifyIntent("buy earbuds online")).toBe("transactional");
    expect(classifyIntent("best earbuds 2026")).toBe("commercial");
    expect(classifyIntent("amazon login")).toBe("navigational");
    expect(classifyIntent("what is anc")).toBe("informational");
  });

  it("matches on meaningful shared tokens only", () => {
    expect(sharesToken("wireless earbuds", "Earbuds launch")).toBe(true);
    expect(sharesToken("best earbuds for gym", "best of the year")).toBe(false);
  });
});

describe("wikipedia window planning and analysis", () => {
  it("plans daily windows ending yesterday with a prior comparison period", () => {
    const p = planWindow("30d", NOW);
    expect(p.end.toISOString().slice(0, 10)).toBe("2026-10-10");
    expect(p.start.toISOString().slice(0, 10)).toBe("2026-08-12");
    expect(p.metricUnits).toBe(30);
  });

  it("plans monthly windows over complete months only", () => {
    const p = planWindow("12m", NOW);
    expect(p.end.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(p.start.toISOString().slice(0, 10)).toBe("2024-10-01");
    expect(p.metricUnits).toBe(12);
  });

  it("sums views, computes trend and leaves gaps unfilled", () => {
    const plan = planWindow("30d", NOW);
    const items = [];
    for (let t = plan.start.getTime(); t <= plan.end.getTime(); t += 86_400_000) {
      const d = new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
      const recent = t > plan.end.getTime() - 30 * 86_400_000;
      if (d === "20261005") continue;
      items.push({ timestamp: `${d}00`, views: recent ? 20 : 10 });
    }
    const s = analyzeArticle(items, plan, "en", "Earbuds");
    expect(s.views).toEqual({ sum: 29 * 20, missing: 1 });
    expect(s.history.missing).toEqual(["2026-10-05"]);
    expect(s.history.points).toHaveLength(29);
    expect(s.trend?.pct).toBeCloseTo(((580 - 300) / 300) * 100, 0);
  });

  it("drops the total when more than 10% of the period is missing", () => {
    const plan = planWindow("30d", NOW);
    const s = analyzeArticle([{ timestamp: "2026101000", views: 5 }], plan, "en", "X");
    expect(s.views).toBeUndefined();
    expect(s.trend).toBeUndefined();
  });
});

describe("provider parsers", () => {
  it("decodes Stack Exchange titles and keeps view counts as engagement", () => {
    const r = parseStackExchange([{ question_id: 9, title: "Why does my &quot;earbud&quot; disconnect &amp; reconnect?", link: "https://superuser.com/q/9", view_count: 1500, answer_count: 2 }], "superuser", NOW.toISOString());
    expect(r[0]!.keyword).toBe('Why does my "earbud" disconnect & reconnect?');
    expect(r[0]!.metrics[0]).toMatchObject({ key: "question_views", value: 1500, kind: "engagement" });
  });

  it("parses the trending RSS and keeps the approximate bucket as displayed", () => {
    const xml = `<?xml version="1.0"?><rss xmlns:ht="https://trends.google.com/trending/rss"><channel>
      <item><title>earbuds sale</title><ht:approx_traffic>2,000+</ht:approx_traffic><pubDate>Sat, 10 Oct 2026 10:00:00 -0700</pubDate>
        <ht:news_item><ht:news_item_title>News</ht:news_item_title><ht:news_item_url>https://example.org/a</ht:news_item_url></ht:news_item></item>
      <item><title>cricket</title><ht:approx_traffic>500+</ht:approx_traffic></item>
    </channel></rss>`;
    const items = parseTrendingRss(xml);
    expect(items).toHaveLength(2);
    const matched = matchTrending(items, "wireless earbuds", "IN", NOW.toISOString());
    expect(matched).toHaveLength(1);
    expect(matched[0]!.metrics[0]).toMatchObject({ value: 2000, display: "2,000+", kind: "approximate_bucket" });
    expect(matched[0]!.category).toBe("rising");
  });

  it("rejects feeds that are not RSS", () => {
    expect(() => parseTrendingRss("<html><body>blocked</body></html>")).toThrow(/format/);
  });
});

describe("registry", () => {
  it("lists only sources with a working adapter", () => {
    for (const p of PROVIDERS) {
      expect(p.implemented).toBe(true);
      expect(p.search).toBeTypeOf("function");
    }
  });

  it("has unique ids and puts marketplaces first", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 4)).toEqual(["amazon", "flipkart", "ebay", "etsy"]);
    for (const id of ["google-ads", "google-trends-rss", "youtube", "wikipedia", "news"]) expect(ids).toContain(id);
    expect(ids).not.toContain("hackernews");
  });
});

describe("search orchestration", () => {
  const req: KeywordSearchRequest = { query: "earbuds", providers: ["ok", "boom", "slow", "planned"], country: "IN", language: "en", window: "30d" };
  const base = {
    group: "Reference" as const,
    glyph: "T",
    color: "#fff",
    access: "",
    docsUrl: "",
    provides: [] as string[],
    notProvided: [] as string[],
    supports: { country: false, language: true, window: true },
    defaultEnabled: true,
  };
  const registry: KeywordProvider[] = [
    { ...base, id: "ok", name: "OK", implemented: true, configuration: () => ({ ok: true }), search: async () => ({ records: [rec({ keyword: "earbuds case", provider: "ok" })] }) },
    { ...base, id: "boom", name: "Boom", implemented: true, configuration: () => ({ ok: true }), search: async () => Promise.reject(new Error("HTTP 500")) },
    { ...base, id: "slow", name: "Slow", implemented: true, configuration: () => ({ ok: true }), search: (_r, ctx) => new Promise((_, rej) => ctx.signal?.addEventListener("abort", () => rej(new Error("aborted")))) },
    { ...base, id: "planned", name: "Planned", implemented: false, configuration: () => ({ ok: false, state: "ACCESS_REQUIRED", reason: "needs approval" }) },
  ];

  it("keeps partial results when other providers fail, time out or are not configured", async () => {
    const res = await runKeywordSearch(req, registry, { env: {}, now: NOW, timeoutMs: 50 });
    expect(res.records.map((r) => r.keyword)).toEqual(["earbuds case"]);
    const by = Object.fromEntries(res.outcomes.map((o) => [o.provider, o]));
    expect(by.ok).toMatchObject({ status: "ok", state: "CONNECTED", resultCount: 1 });
    expect(by.boom).toMatchObject({ status: "error", state: "ERROR", message: "HTTP 500" });
    expect(by.slow).toMatchObject({ status: "timeout" });
    expect(by.planned).toMatchObject({ status: "skipped", state: "ACCESS_REQUIRED", message: "needs approval" });
    expect(by.ok!.applied).toEqual({ country: "not_supported", language: "applied", window: "applied" });
  });

  it("validates requests", () => {
    const known = ["wikipedia"];
    expect(validateSearchRequest({ query: "  ", providers: known, country: "IN", language: "en", window: "30d" }, known).ok).toBe(false);
    expect(validateSearchRequest({ query: "a", providers: ["nope"], country: "IN", language: "en", window: "30d" }, known).ok).toBe(false);
    expect(validateSearchRequest({ query: "a", providers: known, country: "india", language: "en", window: "30d" }, known).ok).toBe(false);
    expect(validateSearchRequest({ query: "a", providers: known, country: "IN", language: "en", window: "7y" }, known).ok).toBe(false);
    const ok = validateSearchRequest({ query: " wireless   earbuds ", providers: known, country: "IN", language: "hi", window: "12m" }, known);
    expect(ok).toMatchObject({ ok: true, request: { query: "wireless earbuds", language: "hi" } });
  });
});

describe("table view and exports", () => {
  const records = [
    rec({ id: "a", keyword: "earbuds for gym", metrics: [{ key: "article_views", label: "Views", value: 100, unit: "views", kind: "absolute", definition: "d" }] }),
    rec({ id: "b", keyword: "how to pair earbuds", provider: "stackexchange", category: "question", metrics: [{ key: "question_views", label: "Q views", value: 9000, unit: "views", kind: "engagement", definition: "d" }] }),
    rec({ id: "c", keyword: "=cmd() earbuds", metrics: [{ key: "article_views", label: "Views", value: 300, unit: "views", kind: "absolute", definition: "d" }] }),
    rec({ id: "d", keyword: "earbuds", category: "related" }),
  ];
  const rows = toRows(records);

  it("assigns tabs by category and derived rules", () => {
    expect(rows.filter((r) => inTab(r, "questions")).map((r) => r.id)).toEqual(["b"]);
    expect(rows.filter((r) => inTab(r, "prepositions")).map((r) => r.id)).toEqual(["a"]);
    expect(rows.filter((r) => inTab(r, "related")).map((r) => r.id)).toEqual(["d"]);
  });

  it("sorts metrics within the same metric type and puts missing values last", () => {
    expect(sortRows(rows, { key: "metric", dir: "desc" }).map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("filters and paginates", () => {
    expect(filterRows(rows, { ...EMPTY_FILTERS, withMetricsOnly: true })).toHaveLength(3);
    expect(filterRows(rows, { ...EMPTY_FILTERS, providers: ["stackexchange"] })).toHaveLength(1);
    expect(paginate([1, 2, 3, 4, 5], 9, 2)).toEqual({ items: [5], page: 3, pages: 3 });
  });

  it("exports CSV with provenance and neutralises spreadsheet formulas", () => {
    const response = { query: "earbuds", request: { query: "earbuds", providers: ["wikipedia"], country: "IN", language: "en", window: "30d" as const }, fetchedAt: NOW.toISOString(), records, outcomes: [] };
    const csv = toCsv(rows, { response, tab: "suggestions", filters: EMPTY_FILTERS, exportedAt: NOW.toISOString() });
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("metric_definition");
    expect(lines[0]).toContain("data_type");
    expect(lines).toHaveLength(5);
    expect(csv).toContain("'=cmd() earbuds");
    const json = toJsonExport(rows, { response, tab: "suggestions", filters: EMPTY_FILTERS, exportedAt: NOW.toISOString() });
    expect(Object.keys(json.metricDefinitions)).toEqual(["wikipedia:article_views", "stackexchange:question_views"]);
    expect(json.records[0]).not.toHaveProperty("primary");
  });
});

describe("AI output handling", () => {
  it("drops duplicates of observed keywords and malformed entries", () => {
    const ideas = parseAiIdeas('{"ideas":[{"keyword":"earbuds case","rationale":"r"},{"keyword":"Waterproof earbuds"},{"nope":1},{"keyword":""}]}', ["earbuds case"]);
    expect(ideas).toEqual([{ keyword: "Waterproof earbuds", rationale: "" }]);
    expect(parseAiIdeas("not json", [])).toEqual([]);
  });
});

describe("rate limiter", () => {
  it("blocks after the limit within a window", () => {
    const l = createRateLimiter(2, 1000);
    expect(l("ip", 0).ok).toBe(true);
    expect(l("ip", 1).ok).toBe(true);
    expect(l("ip", 2)).toEqual({ ok: false, retryAfterS: 1 });
    expect(l("ip", 1000).ok).toBe(true);
  });
});
