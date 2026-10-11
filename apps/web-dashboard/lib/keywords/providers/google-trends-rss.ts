import { XMLParser } from "fast-xml-parser";
import { getText, ProviderHttpError } from "../http";
import { alwaysConfigured, type KeywordProvider } from "../provider";
import { normalizeKeyword, recordId, sharesToken } from "../text";
import type { KeywordRecord } from "../types";

type RawNews = { "ht:news_item_title"?: string; "ht:news_item_url"?: string };
type RawItem = { title?: string; "ht:approx_traffic"?: string; pubDate?: string; "ht:news_item"?: RawNews | RawNews[] };

export type TrendingItem = { title: string; approxTraffic?: string; approxValue?: number; pubDate?: string; newsUrl?: string; newsTitle?: string };

const parser = new XMLParser({ ignoreAttributes: true, processEntities: true, isArray: (name) => name === "item" });

export function parseTrendingRss(xml: string): TrendingItem[] {
  let doc: { rss?: { channel?: { item?: RawItem[] } } };
  try {
    doc = parser.parse(xml);
  } catch {
    throw new ProviderHttpError("Google Trends feed could not be parsed", "parse");
  }
  const items = doc.rss?.channel?.item;
  if (!Array.isArray(items)) throw new ProviderHttpError("Google Trends feed format changed (no items)", "parse");
  return items
    .filter((i) => typeof i.title === "string" && i.title.trim())
    .map((i) => {
      const news = Array.isArray(i["ht:news_item"]) ? i["ht:news_item"][0] : i["ht:news_item"];
      const traffic = typeof i["ht:approx_traffic"] === "string" ? i["ht:approx_traffic"] : undefined;
      const digits = traffic?.replace(/[^\d]/g, "");
      return {
        title: String(i.title).trim(),
        approxTraffic: traffic,
        approxValue: digits ? Number(digits) : undefined,
        pubDate: i.pubDate,
        newsUrl: news?.["ht:news_item_url"],
        newsTitle: news?.["ht:news_item_title"],
      };
    });
}

export function matchTrending(items: TrendingItem[], query: string, country: string, fetchedAt: string): KeywordRecord[] {
  return items
    .filter((i) => sharesToken(query, i.title))
    .map((i) => ({
      id: recordId("google-trends-rss", "rising", `${country}:${i.title}`),
      keyword: i.title,
      normalized: normalizeKeyword(i.title),
      category: "rising" as const,
      provider: "google-trends-rss",
      method: `Google Trends daily trending search (${country})`,
      dataType: "observed" as const,
      country,
      sourceUrl: `https://trends.google.com/trending?geo=${country}`,
      sourceRecordId: `${country}:${i.title}`,
      fetchedAt,
      observedAt: i.pubDate ? new Date(i.pubDate).toISOString() : undefined,
      metrics:
        i.approxValue !== undefined
          ? [
              {
                key: "approx_traffic",
                label: "Approx. searches (trending day)",
                value: i.approxValue,
                display: i.approxTraffic,
                unit: "searches",
                kind: "approximate_bucket" as const,
                period: "current trending period (about 24 hours)",
                definition: "Google's rounded lower-bound bucket for searches while trending, e.g. \"200+\". Not a monthly search volume.",
              },
            ]
          : [],
    }));
}

export const googleTrendsRss: KeywordProvider = {
  id: "google-trends-rss",
  name: "Google Trends (trending now)",
  group: "Trends",
  glyph: "GT",
  color: "#60a5fa",
  implemented: true,
  access: "Public Google Trends daily trending RSS feed. The official Trends API is limited-access and not used.",
  docsUrl: "https://trends.google.com/trending",
  provides: ["Searches trending today in the selected country that match your query", "Approximate traffic bucket"],
  notProvided: ["Historical interest for arbitrary keywords", "Monthly search volume", "CPC"],
  supports: { country: true, language: false, window: false },
  defaultEnabled: true,
  configuration: alwaysConfigured,

  async liveCheck(ctx) {
    parseTrendingRss(await getText("https://trends.google.com/trending/rss?geo=US", { fetchImpl: ctx.fetchImpl, signal: ctx.signal, timeoutMs: 6000 }));
  },

  async search(req, ctx) {
    const geo = /^[A-Z]{2}$/.test(req.country) ? req.country : "US";
    const xml = await getText(`https://trends.google.com/trending/rss?geo=${geo}`, { fetchImpl: ctx.fetchImpl, signal: ctx.signal });
    if (!xml) throw new ProviderHttpError(`No trending feed is published for ${geo}`, "http", 404);
    const items = parseTrendingRss(xml);
    const records = matchTrending(items, req.query, geo, ctx.now.toISOString());
    return { records, message: records.length ? undefined : `None of the ${items.length} searches trending in ${geo} right now match this query.` };
  },
};
