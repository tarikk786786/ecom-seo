import { getJson, missingEnv, ProviderHttpError } from "../http";
import type { KeywordProvider } from "../provider";
import { isQuestion, normalizeKeyword, recordId } from "../text";
import { TIME_WINDOWS, type KeywordRecord, type Metric } from "../types";

const API = "https://www.googleapis.com/youtube/v3";

type SearchItem = { id?: { videoId?: string }; snippet?: { title?: string; publishedAt?: string; channelTitle?: string } };
type VideoStats = { id?: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } };

export function youtubeErrorReason(body: string): string | undefined {
  const j = JSON.parse(body) as { error?: { errors?: { reason?: string }[]; status?: string } };
  return j.error?.errors?.[0]?.reason ?? j.error?.status;
}

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export function parseYouTube(items: SearchItem[], stats: VideoStats[], opts: { country: string; language: string; fetchedAt: string }): KeywordRecord[] {
  const byId = new Map(stats.map((s) => [s.id, s.statistics]));
  return items.flatMap((item) => {
    const videoId = item.id?.videoId;
    const title = item.snippet?.title ? decode(item.snippet.title).trim() : "";
    if (!videoId || !title) return [];
    const s = byId.get(videoId);
    const metrics: Metric[] = [];
    const add = (key: string, label: string, raw: string | undefined, unit: string, definition: string) => {
      const value = raw === undefined ? NaN : Number(raw);
      if (Number.isFinite(value)) metrics.push({ key, label, value, unit, kind: "engagement", definition });
    };
    add("yt_views", "Video views", s?.viewCount, "views", "Lifetime views of this video. Engagement, not search volume.");
    add("yt_likes", "Video likes", s?.likeCount, "likes", "Lifetime likes on this video.");
    add("yt_comments", "Video comments", s?.commentCount, "comments", "Lifetime comments on this video.");
    const category = isQuestion(title) ? "question" : "related";
    return [
      {
        id: recordId("youtube", category, videoId),
        keyword: title,
        normalized: normalizeKeyword(title),
        category,
        provider: "youtube",
        method: "Title of a YouTube video returned by search.list",
        dataType: "observed",
        country: opts.country,
        language: opts.language,
        sourceUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        sourceRecordId: videoId,
        fetchedAt: opts.fetchedAt,
        observedAt: item.snippet?.publishedAt,
        metrics,
      } satisfies KeywordRecord,
    ];
  });
}

export const youtube: KeywordProvider = {
  id: "youtube",
  name: "YouTube",
  group: "Video",
  glyph: "YT",
  color: "#f87171",
  implemented: true,
  access: "YouTube Data API v3 key from Google Cloud. search.list has its own default quota of 100 calls per day; videos.list costs 1 unit from the 10,000-unit pool.",
  docsUrl: "https://developers.google.com/youtube/v3/docs/search/list",
  provides: ["Titles of videos matching a query", "View, like and comment counts (engagement)"],
  notProvided: ["YouTube search volume", "CPC"],
  supports: { country: true, language: true, window: true },
  defaultEnabled: true,
  configuration({ env }) {
    const missing = missingEnv(env, ["YOUTUBE_API_KEY"]);
    return missing.length ? { ok: false, state: "NOT_CONFIGURED", reason: "Adapter implemented; credentials missing: YOUTUBE_API_KEY." } : { ok: true };
  },

  // Uses videos.list (1 unit) so status checks never spend the 100/day search.list allowance.
  async liveCheck(ctx) {
    const r = await getJson<{ items?: unknown[] }>(`${API}/videos?part=id&chart=mostPopular&maxResults=1&key=${encodeURIComponent(ctx.env.YOUTUBE_API_KEY!)}`, {
      fetchImpl: ctx.fetchImpl,
      signal: ctx.signal,
      timeoutMs: 6000,
      notFoundAsEmpty: false,
      errorDetail: youtubeErrorReason,
    });
    if (!Array.isArray(r?.items)) throw new Error("unexpected response");
  },

  async search(req, ctx) {
    const key = encodeURIComponent(ctx.env.YOUTUBE_API_KEY!);
    const days = TIME_WINDOWS.find((w) => w.id === req.window)?.days ?? 30;
    const after = new Date(ctx.now.getTime() - days * 86_400_000).toISOString();
    const opts = { fetchImpl: ctx.fetchImpl, signal: ctx.signal, notFoundAsEmpty: false, errorDetail: youtubeErrorReason };
    const search = await getJson<{ items?: SearchItem[] }>(
      `${API}/search?part=snippet&type=video&maxResults=25&q=${encodeURIComponent(req.query)}&regionCode=${req.country}&relevanceLanguage=${req.language}&publishedAfter=${encodeURIComponent(after)}&key=${key}`,
      opts,
    ).catch((err) => {
      if (err instanceof ProviderHttpError && err.status === 403 && /quota/i.test(err.message)) throw new ProviderHttpError("YouTube daily search quota exhausted (resets at midnight Pacific time)", "rate_limited", 403);
      throw err;
    });
    if (search && !Array.isArray(search.items ?? [])) throw new ProviderHttpError("unexpected search response", "parse");
    const items = search?.items ?? [];
    const ids = items.map((i) => i.id?.videoId).filter((id): id is string => !!id);
    const stats = ids.length ? ((await getJson<{ items?: VideoStats[] }>(`${API}/videos?part=statistics&id=${ids.join(",")}&key=${key}`, { ...opts, retries: 1 }))?.items ?? []) : [];
    const records = parseYouTube(items, stats, { country: req.country, language: req.language, fetchedAt: ctx.now.toISOString() });
    return { records, message: records.length ? `${records.length} videos published in the selected window.` : undefined };
  },
};
