import { missingEnv, ProviderHttpError, requestJson } from "../http";
import type { KeywordProvider } from "../provider";
import { googleGeoId } from "./google-ads";
import { isQuestion, normalizeKeyword, recordId } from "../text";
import type { History, KeywordRecord, Metric } from "../types";

const API = "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live";

type MonthlySearch = { year?: number; month?: number; search_volume?: number };

type DfsItem = {
  keyword?: string;
  search_volume?: number;
  cpc?: number;
  competition?: number;
  competition_level?: string;
  low_top_of_page_bid?: number;
  high_top_of_page_bid?: number;
  monthly_searches?: MonthlySearch[];
};

export function parseDataForSeo(body: unknown, fetchedAt: string): KeywordRecord[] {
  const json = body as { tasks?: { result?: DfsItem[] }[] } | undefined;
  const items = json?.tasks?.[0]?.result;
  if (!items || !Array.isArray(items)) return [];

  return items.flatMap((it) => {
    const text = it.keyword?.trim();
    if (!text) return [];

    const metrics: Metric[] = [];
    if (typeof it.search_volume === "number") {
      metrics.push({
        key: "avg_monthly_searches",
        label: "Avg. monthly searches",
        value: it.search_volume,
        unit: "searches/month",
        kind: "absolute",
        period: "last 12 months",
        definition: "Average monthly Google searches from DataForSEO Google Ads endpoint.",
      });
    }
    if (typeof it.cpc === "number") {
      metrics.push({
        key: "avg_cpc",
        label: "CPC",
        value: it.cpc,
        unit: "USD",
        kind: "absolute",
        display: `$${it.cpc.toFixed(2)}`,
        definition: "Average cost per click.",
      });
    }
    if (typeof it.competition === "number") {
      metrics.push({
        key: "competition_index",
        label: "Competition",
        value: Math.round(it.competition * 100),
        unit: "index 0–100",
        kind: "relative_index",
        display: it.competition_level ? `${it.competition_level} (${Math.round(it.competition * 100)})` : undefined,
        definition: "Advertiser competition index (0–100).",
      });
    }

    let history: History | undefined;
    if (Array.isArray(it.monthly_searches) && it.monthly_searches.length) {
      const points = it.monthly_searches
        .filter((m) => m.year && m.month && typeof m.search_volume === "number")
        .map((m) => ({
          date: `${m.year}-${String(m.month).padStart(2, "0")}-01`,
          value: m.search_volume!,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (points.length) {
        history = {
          label: `Monthly searches: ${text}`,
          unit: "searches",
          kind: "absolute",
          granularity: "monthly",
          points,
          definition: "12-month search volume history via DataForSEO Google Ads data.",
        };
      }
    }

    const category = isQuestion(text) ? "question" : "suggestion";
    return [
      {
        id: recordId("dataforseo", category, text),
        keyword: text,
        normalized: normalizeKeyword(text),
        category,
        provider: "dataforseo",
        method: "DataForSEO Live Search Volume API",
        dataType: "observed",
        fetchedAt,
        metrics,
        history,
      } satisfies KeywordRecord,
    ];
  });
}

function authHeader(env: Record<string, string | undefined>): string {
  const login = env.DATAFORSEO_LOGIN || "";
  const password = env.DATAFORSEO_PASSWORD || "";
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

export const dataforseo: KeywordProvider = {
  id: "dataforseo",
  name: "DataForSEO (Google Ads Data)",
  group: "Search & ads",
  glyph: "DFS",
  color: "#3b82f6",
  implemented: true,
  access: "DataForSEO Live Keyword Data API. Requires funded DataForSEO account credits.",
  docsUrl: "https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/",
  provides: ["Google Search Volume", "CPC", "Advertiser Competition", "12-month search history"],
  notProvided: ["Marketplace-specific internal searches"],
  supports: { country: true, language: true, window: false },
  defaultEnabled: false,
  configuration({ env }) {
    const missing = missingEnv(env, ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"]);
    return missing.length
      ? { ok: false, state: "NOT_CONFIGURED", reason: `Adapter implemented; credentials missing: ${missing.join(", ")}.` }
      : { ok: true };
  },

  async liveCheck(ctx) {
    const r = await requestJson<{ status_code?: number }>("https://api.dataforseo.com/v3/appendix/user_data", {
      headers: { authorization: authHeader(ctx.env), "content-type": "application/json" },
      fetchImpl: ctx.fetchImpl,
      signal: ctx.signal,
      timeoutMs: 6000,
    });
    if (!r || r.status_code !== 20000) throw new ProviderHttpError("DataForSEO authentication rejected", "auth", 401);
  },

  async search(req, ctx) {
    const locationCode = googleGeoId(req.country);
    if (!locationCode) return { records: [], message: `No DataForSEO location mapped for country ${req.country}.` };
    const body = await requestJson<unknown>(API, {
      method: "POST",
      headers: { authorization: authHeader(ctx.env), "content-type": "application/json" },
      body: JSON.stringify([
        {
          keywords: [req.query],
          location_code: locationCode,
          language_code: req.language || "en",
        },
      ]),
      fetchImpl: ctx.fetchImpl,
      signal: ctx.signal,
      retries: 1,
    });

    const records = parseDataForSeo(body, ctx.now.toISOString());
    const seedHistory = records[0]?.history;
    return {
      records,
      seedHistory,
      message: "DataForSEO Google Ads volume and CPC metrics.",
    };
  },
};
