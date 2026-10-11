import { getJson } from "../http";
import { alwaysConfigured, type KeywordProvider } from "../provider";
import { isQuestion, normalizeKeyword, recordId } from "../text";
import { TIME_WINDOWS, type KeywordRecord } from "../types";

type Hit = { objectID: string; title?: string; points?: number; num_comments?: number; created_at?: string; url?: string };

export function parseHackerNews(hits: Hit[], fetchedAt: string): KeywordRecord[] {
  return hits
    .filter((h) => h.title && isQuestion(h.title.replace(/^(Ask|Tell) HN:\s*/i, "")))
    .map((h) => {
      const title = h.title!.replace(/^Ask HN:\s*/i, "").trim();
      return {
        id: recordId("hackernews", "question", h.objectID),
        keyword: title,
        normalized: normalizeKeyword(title),
        category: "question" as const,
        provider: "hackernews",
        method: "Question-form story title on Hacker News",
        dataType: "observed" as const,
        sourceUrl: `https://news.ycombinator.com/item?id=${encodeURIComponent(h.objectID)}`,
        sourceRecordId: h.objectID,
        fetchedAt,
        observedAt: h.created_at,
        metrics: [
          ...(typeof h.points === "number" ? [{ key: "points", label: "HN points", value: h.points, unit: "points", kind: "engagement" as const, definition: "Upvote points on the story. Engagement, not search demand." }] : []),
          ...(typeof h.num_comments === "number" ? [{ key: "comments", label: "HN comments", value: h.num_comments, unit: "comments", kind: "engagement" as const, definition: "Comment count on the story." }] : []),
        ],
      };
    });
}

export const hackerNews: KeywordProvider = {
  id: "hackernews",
  name: "Hacker News",
  group: "Community",
  glyph: "Y",
  color: "#fb923c",
  implemented: true,
  access: "Public HN Search API by Algolia. No credentials required.",
  docsUrl: "https://hn.algolia.com/api",
  provides: ["Real question-form discussion titles", "Points and comment counts (engagement)"],
  notProvided: ["Search volume", "CPC", "Country or language filtering"],
  supports: { country: false, language: false, window: true },
  defaultEnabled: true,
  configuration: alwaysConfigured,

  async liveCheck(ctx) {
    const r = await getJson<{ hits?: unknown[] }>("https://hn.algolia.com/api/v1/search?query=test&hitsPerPage=1", { fetchImpl: ctx.fetchImpl, signal: ctx.signal, timeoutMs: 6000 });
    if (!Array.isArray(r?.hits)) throw new Error("unexpected response");
  },

  async search(req, ctx) {
    const days = TIME_WINDOWS.find((w) => w.id === req.window)?.days ?? 30;
    const since = Math.floor((ctx.now.getTime() - days * 86_400_000) / 1000);
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(req.query)}&tags=story&hitsPerPage=100&numericFilters=created_at_i>${since}`;
    const res = await getJson<{ hits?: Hit[] }>(url, { fetchImpl: ctx.fetchImpl, signal: ctx.signal });
    const hits = res?.hits ?? [];
    const records = parseHackerNews(hits, ctx.now.toISOString());
    return { records, message: hits.length ? `${records.length} of ${hits.length} matching stories are phrased as questions.` : undefined };
  },
};
