import { createThrottle, getText, parseJson, ProviderHttpError, type FetchLike } from "../http";
import { alwaysConfigured, type KeywordProvider } from "../provider";
import { isQuestion, normalizeKeyword, recordId, sharesToken } from "../text";
import type { History, KeywordRecord, TimeWindow } from "../types";

const API = "https://api.gdeltproject.org/api/v2/doc/doc";
/** GDELT asks for at most one request every 5 seconds per client. */
export const GDELT_MIN_INTERVAL_MS = 5_200;

/** GDELT `sourcelang:` accepts English language names. */
const SOURCE_LANG: Record<string, string> = {
  en: "english", hi: "hindi", bn: "bengali", ta: "tamil", te: "telugu", mr: "marathi", ur: "urdu", es: "spanish", fr: "french", de: "german",
  pt: "portuguese", it: "italian", nl: "dutch", ja: "japanese", ko: "korean", id: "indonesian", ar: "arabic", tr: "turkish", ru: "russian", zh: "chinese",
};

/** DOC 2.0 searches a rolling ~3 month window, so longer windows are capped. */
const TIMESPAN: Record<TimeWindow, { span: string; capped: boolean }> = {
  "30d": { span: "30d", capped: false },
  "90d": { span: "3months", capped: false },
  "12m": { span: "3months", capped: true },
  "24m": { span: "3months", capped: true },
};

type TopArticle = { url?: string; title?: string };
type TimelineResponse = { timeline?: { series?: string; data?: { date?: string; value?: number; toparts?: TopArticle[] }[] }[] };

const throttled = createThrottle(GDELT_MIN_INTERVAL_MS);

export function buildGdeltQuery(query: string, language: string): string {
  const phrase = query.replace(/"/g, "").trim();
  const quoted = phrase.includes(" ") ? `"${phrase}"` : phrase;
  const lang = SOURCE_LANG[language];
  return lang ? `${quoted} sourcelang:${lang}` : quoted;
}

const gdeltDate = (d: string) => (/^\d{8}T/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : "");

export function parseGdeltTimeline(body: string, query: string, fetchedAt: string): { history?: History; records: KeywordRecord[] } {
  if (body.trim() && !body.trim().startsWith("{")) {
    // GDELT reports query errors (e.g. "phrase too short") as plain text with HTTP 200.
    throw new ProviderHttpError(`GDELT rejected the query: ${body.trim().slice(0, 100)}`, "http");
  }
  const json = parseJson<TimelineResponse>(body);
  const series = json?.timeline?.[0]?.data ?? [];
  const points = series.flatMap((p) => {
    const date = gdeltDate(p.date ?? "");
    return date && typeof p.value === "number" ? [{ date, value: p.value }] : [];
  });
  const history: History | undefined = points.length
    ? {
        label: "News coverage intensity",
        unit: "% of monitored articles",
        kind: "relative_index",
        granularity: "daily",
        points,
        definition: "Share of all online news articles monitored by GDELT that day which match the query. Coverage, not search demand.",
        sourceUrl: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
      }
    : undefined;

  const seen = new Set<string>();
  const records: KeywordRecord[] = [];
  for (const day of series) {
    for (const a of day.toparts ?? []) {
      const title = a.title?.replace(/\s+/g, " ").trim();
      if (!title || !a.url || !sharesToken(query, title)) continue;
      const normalized = normalizeKeyword(title);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      const category = isQuestion(title) ? "question" : "related";
      records.push({
        id: recordId("news", category, a.url),
        keyword: title,
        normalized,
        category,
        provider: "news",
        method: "Headline of a top news article matching the query (GDELT)",
        dataType: "observed",
        sourceUrl: a.url,
        fetchedAt,
        observedAt: gdeltDate(day.date ?? "") || undefined,
        metrics: [],
      });
    }
  }
  return { history, records };
}

/** After a 429, back off locally instead of re-hitting GDELT on every search. */
const COOLDOWN_MS = 60_000;
let cooldownUntil = 0;

async function fetchTimeline(query: string, language: string, window: TimeWindow, opts: { fetchImpl?: FetchLike; signal?: AbortSignal }) {
  if (Date.now() < cooldownUntil) throw new ProviderHttpError(`GDELT is rate limiting; retry after ${new Date(cooldownUntil).toISOString().slice(11, 19)} UTC`, "rate_limited", 429);
  const url = `${API}?query=${encodeURIComponent(buildGdeltQuery(query, language))}&mode=timelinevolinfo&format=json&timespan=${TIMESPAN[window].span}`;
  return throttled(() => getText(url, { ...opts, timeoutMs: 15_000 }), opts.signal).catch((err) => {
    if (err instanceof ProviderHttpError && err.category === "rate_limited") cooldownUntil = Date.now() + COOLDOWN_MS;
    throw err;
  });
}

export const gdelt: KeywordProvider = {
  id: "news",
  name: "News (GDELT)",
  group: "News & web",
  glyph: "N",
  color: "#38bdf8",
  implemented: true,
  access: "GDELT DOC 2.0 API. Public, no key; limited to one request every 5 seconds.",
  docsUrl: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
  provides: ["Daily news coverage intensity (% of monitored articles)", "Headlines of top matching articles with links"],
  notProvided: ["Search volume", "CPC", "History older than about 3 months"],
  supports: { country: false, language: true, window: true },
  defaultEnabled: true,
  timeoutMs: 25_000,
  configuration: alwaysConfigured,

  async liveCheck(ctx) {
    const body = await fetchTimeline("news", "en", "30d", ctx);
    if (!parseGdeltTimeline(body, "news", ctx.now.toISOString()).history) throw new Error("unexpected response");
  },

  async search(req, ctx) {
    const body = await fetchTimeline(req.query, req.language, req.window, ctx);
    const { history, records } = parseGdeltTimeline(body, req.query, ctx.now.toISOString());
    const capped = TIMESPAN[req.window].capped ? " GDELT DOC covers about the last 3 months, so the window was capped." : "";
    return {
      records,
      seedHistory: history,
      message: (history ? `${history.points.length} days of coverage data.` : "No matching news coverage.") + capped,
    };
  },
};
