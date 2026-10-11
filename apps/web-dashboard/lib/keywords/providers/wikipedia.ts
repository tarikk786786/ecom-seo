import { getJson, mapLimit } from "../http";
import { alwaysConfigured, type KeywordProvider, type ProviderContext } from "../provider";
import { normalizeKeyword, recordId } from "../text";
import type { DeviceDistribution, History, HistoryPoint, KeywordRecord, KeywordSearchRequest, Trend } from "../types";

type PageviewItem = { timestamp: string; views: number };

const MAX_ARTICLES = 20;
const DAY = 86_400_000;

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const isoDate = (ts: string) => `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
const project = (lang: string) => `${/^[a-z]{2,3}$/.test(lang) ? lang : "en"}.wikipedia.org`;
const articleUrl = (lang: string, title: string) => `https://${project(lang)}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

type WindowPlan = {
  granularity: "daily" | "monthly";
  start: Date;
  end: Date;
  /** Number of granularity units in the reported metric and in each trend half. */
  metricUnits: number;
  trendUnits: number;
  metricLabel: string;
  trendLabel: string;
};

/** Daily data lags about a day, so ranges end yesterday (UTC). Monthly ranges use complete months only. */
export function planWindow(window: KeywordSearchRequest["window"], now: Date): WindowPlan {
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DAY);
  if (window === "30d" || window === "90d") {
    const days = window === "30d" ? 30 : 90;
    return {
      granularity: "daily",
      start: new Date(yesterday.getTime() - (2 * days - 1) * DAY),
      end: yesterday,
      metricUnits: days,
      trendUnits: days,
      metricLabel: `last ${days} days to ${yesterday.toISOString().slice(0, 10)}`,
      trendLabel: `last ${days} days vs previous ${days} days`,
    };
  }
  const months = 24;
  const lastFullMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastFullMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const start = new Date(Date.UTC(lastFullMonthStart.getUTCFullYear(), lastFullMonthStart.getUTCMonth() - (months - 1), 1));
  const metricUnits = window === "12m" ? 12 : 24;
  return {
    granularity: "monthly",
    start,
    end: lastFullMonthEnd,
    metricUnits,
    trendUnits: 12,
    metricLabel: `${metricUnits} complete months to ${lastFullMonthEnd.toISOString().slice(0, 7)}`,
    trendLabel: "last 12 complete months vs previous 12 months",
  };
}

function expectedDates(plan: WindowPlan): string[] {
  const out: string[] = [];
  if (plan.granularity === "daily") {
    for (let t = plan.start.getTime(); t <= plan.end.getTime(); t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  } else {
    const d = new Date(plan.start);
    while (d <= plan.end) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }
  return out;
}

/** Sums the last n expected units; returns undefined if more than 10% of them are missing. */
function sumUnits(points: Map<string, number>, dates: string[]): { sum: number; missing: number } | undefined {
  let sum = 0;
  let missing = 0;
  for (const d of dates) {
    const v = points.get(d);
    if (v === undefined) missing++;
    else sum += v;
  }
  if (!dates.length || missing / dates.length > 0.1) return undefined;
  return { sum, missing };
}

export type ArticleStats = { views?: { sum: number; missing: number }; trend?: Trend; history: History };

export function analyzeArticle(items: PageviewItem[], plan: WindowPlan, lang: string, title: string): ArticleStats {
  const dates = expectedDates(plan);
  const byDate = new Map(items.map((i) => [isoDate(i.timestamp), i.views]));
  const metricDates = dates.slice(-plan.metricUnits);
  const recent = dates.slice(-plan.trendUnits);
  const prior = dates.slice(-2 * plan.trendUnits, -plan.trendUnits);
  const views = sumUnits(byDate, metricDates);
  const r = sumUnits(byDate, recent);
  const p = sumUnits(byDate, prior);
  const trend: Trend | undefined =
    r && p && p.sum > 0 ? { pct: Math.round(((r.sum - p.sum) / p.sum) * 1000) / 10, window: plan.trendLabel, definition: "Change in Wikipedia article views between the two periods." } : undefined;
  const shown = dates.slice(-plan.metricUnits);
  const points: HistoryPoint[] = shown.filter((d) => byDate.has(d)).map((d) => ({ date: d, value: byDate.get(d)! }));
  return {
    views,
    trend,
    history: {
      label: `Wikipedia article views: ${title}`,
      unit: "views",
      kind: "absolute",
      granularity: plan.granularity,
      points,
      missing: shown.filter((d) => !byDate.has(d)),
      definition: `Human (agent=user) views of the ${project(lang)} article "${title}", all access methods. Article views are not search volume.`,
      sourceUrl: `https://pageviews.wmcloud.org/?project=${project(lang)}&pages=${encodeURIComponent(title)}`,
    },
  };
}

async function pageviews(ctx: ProviderContext, lang: string, title: string, plan: WindowPlan, access = "all-access") {
  const art = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project(lang)}/${access}/user/${art}/${plan.granularity}/${ymd(plan.start)}00/${ymd(plan.end)}00`;
  const res = await getJson<{ items?: PageviewItem[] }>(url, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, timeoutMs: 8000 });
  return res?.items ?? [];
}

async function devices(ctx: ProviderContext, lang: string, title: string): Promise<DeviceDistribution | undefined> {
  const plan = planWindow("30d", ctx.now);
  const last30 = { ...plan, start: new Date(plan.end.getTime() - 29 * DAY) };
  const kinds = [
    { access: "desktop", device: "Desktop" },
    { access: "mobile-web", device: "Mobile web" },
    { access: "mobile-app", device: "Mobile app" },
  ];
  const sums = await Promise.all(kinds.map(async (k) => (await pageviews(ctx, lang, title, last30, k.access)).reduce((s, i) => s + i.views, 0)));
  const total = sums.reduce((a, b) => a + b, 0);
  if (!total) return undefined;
  return {
    provider: "wikipedia",
    label: `Wikipedia article views by access method: ${title}`,
    definition: "Share of human article views on desktop, mobile web and the Wikipedia apps. This describes Wikipedia readers, not search engine users.",
    period: last30.metricLabel,
    unit: "views",
    items: kinds.map((k, i) => ({ device: k.device, value: sums[i]!, share: Math.round((sums[i]! / total) * 1000) / 10 })),
    sourceUrl: `https://pageviews.wmcloud.org/?project=${project(lang)}&pages=${encodeURIComponent(title)}`,
  };
}

export const wikipedia: KeywordProvider = {
  id: "wikipedia",
  name: "Wikipedia",
  group: "Reference",
  glyph: "W",
  color: "#d4d4d8",
  implemented: true,
  access: "Public Wikimedia APIs. No credentials required.",
  docsUrl: "https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/",
  provides: ["Article-title completions", "Related articles (full-text search)", "Article views with history", "Views by access method (desktop/mobile)"],
  notProvided: ["Search engine volume", "CPC", "Competition", "Country-level data"],
  supports: { country: false, language: true, window: true },
  defaultEnabled: true,
  timeoutMs: 15_000,
  configuration: alwaysConfigured,

  async liveCheck(ctx) {
    const r = await getJson<unknown[]>(`https://en.wikipedia.org/w/api.php?action=opensearch&search=test&limit=1&format=json`, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, timeoutMs: 6000 });
    if (!Array.isArray(r)) throw new Error("unexpected opensearch response");
  },

  async search(req, ctx) {
    const lang = req.language;
    const fetchedAt = ctx.now.toISOString();
    const base = `https://${project(lang)}/w/api.php?format=json&origin=*`;
    const q = encodeURIComponent(req.query);
    const [open, full] = await Promise.all([
      getJson<[string, string[], string[], string[]]>(`${base}&action=opensearch&search=${q}&limit=10&namespace=0&redirects=resolve`, { fetchImpl: ctx.fetchImpl, signal: ctx.signal }),
      getJson<{ query?: { search?: { title: string }[] } }>(`${base}&action=query&list=search&srsearch=${q}&srlimit=15&srnamespace=0`, { fetchImpl: ctx.fetchImpl, signal: ctx.signal }),
    ]);
    const seen = new Set<string>();
    const suggestions = (open?.[1] ?? []).filter((t) => t && !seen.has(normalizeKeyword(t)) && seen.add(normalizeKeyword(t)));
    const related = (full?.query?.search ?? []).map((s) => s.title).filter((t) => !seen.has(normalizeKeyword(t)) && !/\(disambiguation\)$/i.test(t));

    const titles = [...suggestions.map((t) => ({ t, category: "suggestion" as const, method: "Wikipedia article-title completion" })), ...related.map((t) => ({ t, category: "related" as const, method: "Wikipedia full-text search (related article)" }))].slice(0, MAX_ARTICLES);
    if (!titles.length) return { records: [], message: `No ${project(lang)} articles match this query.` };

    const plan = planWindow(req.window, ctx.now);
    let failed = 0;
    const stats = await mapLimit(titles, 5, async ({ t }) => {
      try {
        return analyzeArticle(await pageviews(ctx, lang, t, plan), plan, lang, t);
      } catch (err) {
        if (ctx.signal?.aborted) throw err;
        failed++;
        return undefined;
      }
    });

    const records: KeywordRecord[] = titles.map(({ t, category, method }, i) => {
      const s = stats[i];
      return {
        id: recordId("wikipedia", category, `${lang}:${t}`),
        keyword: t,
        normalized: normalizeKeyword(t),
        category,
        provider: "wikipedia",
        method,
        dataType: "observed",
        language: lang,
        sourceUrl: articleUrl(lang, t),
        sourceRecordId: `${project(lang)}:${t}`,
        fetchedAt,
        metrics: s?.views
          ? [
              {
                key: "article_views",
                label: "Wikipedia article views",
                value: s.views.sum,
                unit: "views",
                kind: "absolute",
                period: plan.metricLabel,
                definition: "Human views of this Wikipedia article (all access methods). Not search engine volume.",
              },
            ]
          : [],
        trend: s?.trend,
        history: s?.history.points.length ? s.history : undefined,
      };
    });

    // Seed article: exact title match, else the top title completion. Full-text hits are too loose to stand in for the seed.
    const normQ = normalizeKeyword(req.query);
    const exact = titles.findIndex((x) => normalizeKeyword(x.t) === normQ);
    const seedIdx = exact >= 0 ? exact : titles[0]?.category === "suggestion" ? 0 : -1;
    const seedHistory = seedIdx >= 0 && stats[seedIdx]?.history.points.length ? stats[seedIdx]!.history : undefined;
    let device: DeviceDistribution | undefined;
    if (seedIdx >= 0) {
      try {
        device = await devices(ctx, lang, titles[seedIdx]!.t);
      } catch (err) {
        if (ctx.signal?.aborted) throw err;
      }
    }
    return {
      records,
      seedHistory,
      devices: device,
      message: failed ? `Pageviews unavailable for ${failed} of ${titles.length} articles; their metrics are left empty.` : undefined,
    };
  },
};
