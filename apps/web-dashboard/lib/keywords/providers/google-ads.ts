import { cachedToken, createThrottle, missingEnv, ProviderHttpError, requestJson, type FetchLike } from "../http";
import type { ConfigState, KeywordProvider, ProviderContext } from "../provider";
import { isQuestion, normalizeKeyword, recordId } from "../text";
import type { History, KeywordRecord, Metric } from "../types";

export const GOOGLE_ADS_API_VERSION = "v25";
const API = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_ADS_ENV = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"];

/** Country criterion IDs (Google Ads geo target constants are 2000 + ISO 3166-1 numeric). */
const ISO_NUMERIC: Record<string, number> = {
  IN: 356, US: 840, GB: 826, CA: 124, AU: 36, DE: 276, FR: 250, ES: 724, IT: 380, NL: 528, BR: 76, MX: 484,
  JP: 392, KR: 410, ID: 360, PH: 608, SG: 702, AE: 784, SA: 682, PK: 586, BD: 50, NG: 566, ZA: 710, TR: 792,
};
/** Google geo target ID (also used as DataForSEO `location_code`). */
export const googleGeoId = (country: string) => (ISO_NUMERIC[country] ? 2000 + ISO_NUMERIC[country] : undefined);
export const geoTargetConstant = (country: string) => (googleGeoId(country) ? `geoTargetConstants/${googleGeoId(country)}` : undefined);

/** Language criterion IDs from https://developers.google.com/google-ads/api/data/codes-formats#languages */
const LANGUAGE_IDS: Record<string, number> = {
  en: 1000, de: 1001, fr: 1002, es: 1003, it: 1004, ja: 1005, nl: 1010, ko: 1012, pt: 1014, zh: 1017, ar: 1019, hi: 1023,
  id: 1025, ru: 1031, tr: 1037, ur: 1041, bn: 1056, mr: 1101, ta: 1130, te: 1131,
};
export const languageConstant = (lang: string) => (LANGUAGE_IDS[lang] ? `languageConstants/${LANGUAGE_IDS[lang]}` : undefined);

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

type MonthlyVolume = { month?: string; year?: string | number; monthlySearches?: string | number };
type IdeaMetrics = {
  avgMonthlySearches?: string | number;
  competition?: string;
  competitionIndex?: string | number;
  lowTopOfPageBidMicros?: string | number;
  highTopOfPageBidMicros?: string | number;
  averageCpcMicros?: string | number;
  monthlySearchVolumes?: MonthlyVolume[];
};
export type KeywordIdea = { text?: string; keywordIdeaMetrics?: IdeaMetrics };
type IdeasResponse = { results?: KeywordIdea[]; totalSize?: string | number; nextPageToken?: string };

/** Pulls the first GoogleAdsFailure error code, e.g. "DEVELOPER_TOKEN_NOT_APPROVED". */
export function googleAdsErrorCode(body: string): string | undefined {
  const json = JSON.parse(body) as { error?: { status?: string; details?: { errors?: { errorCode?: Record<string, string> }[] }[] } };
  const code = json.error?.details?.flatMap((d) => d.errors ?? [])[0]?.errorCode;
  return (code && Object.values(code)[0]) || json.error?.status;
}

const num = (v: string | number | undefined) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function ideaHistory(volumes: MonthlyVolume[] | undefined): History | undefined {
  const points = (volumes ?? [])
    .flatMap((v) => {
      const m = MONTHS.indexOf(v.month ?? "");
      const year = num(v.year);
      const value = num(v.monthlySearches);
      return m >= 0 && year && value !== undefined ? [{ date: `${year}-${String(m + 1).padStart(2, "0")}-01`, value }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) return undefined;
  return {
    label: "Monthly searches (Google Ads)",
    unit: "searches",
    kind: "absolute",
    granularity: "monthly",
    points,
    definition: "Approximate monthly Google searches for this keyword and close variants in the targeted location and language, from Keyword Planner.",
    sourceUrl: "https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics",
  };
}

export function parseKeywordIdeas(results: KeywordIdea[], opts: { currency?: string; country: string; language: string; fetchedAt: string }): KeywordRecord[] {
  const money = (micros: number | undefined) => (micros === undefined ? undefined : micros / 1_000_000);
  const cur = opts.currency ?? "account currency";
  return results.flatMap((idea) => {
    const text = idea.text?.trim();
    if (!text) return [];
    const m = idea.keywordIdeaMetrics ?? {};
    const metrics: Metric[] = [];
    const avg = num(m.avgMonthlySearches);
    if (avg !== undefined)
      metrics.push({ key: "avg_monthly_searches", label: "Avg. monthly searches", value: avg, unit: "searches/month", kind: "absolute", period: "last 12 months", definition: "Average monthly Google searches over the last 12 months (Keyword Planner, rounded by Google)." });
    const ci = num(m.competitionIndex);
    if (ci !== undefined)
      metrics.push({ key: "competition_index", label: "Competition", value: ci, unit: "index 0–100", kind: "relative_index", display: m.competition && m.competition !== "UNSPECIFIED" && m.competition !== "UNKNOWN" ? `${m.competition} (${ci})` : undefined, definition: "Advertiser competition for ad placement (0–100), not organic ranking difficulty." });
    const low = money(num(m.lowTopOfPageBidMicros));
    if (low !== undefined)
      metrics.push({ key: "top_bid_low", label: "Top-of-page bid (low)", value: low, unit: cur, kind: "absolute", display: `${low.toFixed(2)} ${opts.currency ?? ""}`.trim(), definition: "20th percentile of top-of-page bids for this keyword, in the Google Ads account currency." });
    const high = money(num(m.highTopOfPageBidMicros));
    if (high !== undefined)
      metrics.push({ key: "top_bid_high", label: "Top-of-page bid (high)", value: high, unit: cur, kind: "absolute", display: `${high.toFixed(2)} ${opts.currency ?? ""}`.trim(), definition: "80th percentile of top-of-page bids for this keyword, in the Google Ads account currency." });
    const cpc = money(num(m.averageCpcMicros));
    if (cpc !== undefined)
      metrics.push({ key: "avg_cpc", label: "Avg. CPC", value: cpc, unit: cur, kind: "absolute", display: `${cpc.toFixed(2)} ${opts.currency ?? ""}`.trim(), definition: "Average cost per click reported by Keyword Planner, in the Google Ads account currency." });
    const category = isQuestion(text) ? "question" : "suggestion";
    return [
      {
        id: recordId("google-ads", category, normalizeKeyword(text)),
        keyword: text,
        normalized: normalizeKeyword(text),
        category,
        provider: "google-ads",
        method: "Keyword Planner idea (Google Ads API KeywordPlanIdeaService)",
        dataType: "observed",
        country: opts.country,
        language: opts.language,
        fetchedAt: opts.fetchedAt,
        metrics,
        history: ideaHistory(m.monthlySearchVolumes),
      } satisfies KeywordRecord,
    ];
  });
}

function configuration({ env }: Pick<ProviderContext, "env">): ConfigState {
  const missing = missingEnv(env, GOOGLE_ADS_ENV);
  if (missing.length) return { ok: false, state: "NOT_CONFIGURED", reason: `Adapter implemented; credentials missing: ${missing.join(", ")}. Keyword ideas need a developer token with Basic or Standard access.` };
  if (!/^\d{3}-?\d{3}-?\d{4}$/.test(env.GOOGLE_ADS_CUSTOMER_ID!.trim())) return { ok: false, state: "ERROR", reason: "GOOGLE_ADS_CUSTOMER_ID must be a 10-digit customer ID (dashes allowed)." };
  return { ok: true };
}

const digits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");

async function accessToken(env: ProviderContext["env"], o: { fetchImpl?: FetchLike; signal?: AbortSignal; now: number }) {
  return cachedToken(`google-ads:${env.GOOGLE_ADS_CLIENT_ID}`, o.now, async () => {
    const body = new URLSearchParams({ grant_type: "refresh_token", client_id: env.GOOGLE_ADS_CLIENT_ID!, client_secret: env.GOOGLE_ADS_CLIENT_SECRET!, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN! });
    const r = await requestJson<{ access_token?: string; expires_in?: number }>(TOKEN_URL, {
      method: "POST",
      body: body.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      fetchImpl: o.fetchImpl,
      signal: o.signal,
      errorDetail: (t) => (JSON.parse(t) as { error?: string }).error,
    }).catch((err) => {
      // Google answers 400 invalid_grant for revoked/expired refresh tokens.
      if (err instanceof ProviderHttpError && err.status === 400) throw new ProviderHttpError(`OAuth token refresh failed (${err.message})`, "auth", 400);
      throw err;
    });
    if (!r?.access_token) throw new ProviderHttpError("OAuth token response had no access_token", "parse");
    return { token: r.access_token, expiresInS: r.expires_in ?? 3600 };
  });
}

async function adsPost<T>(path: string, payload: unknown, ctx: ProviderContext): Promise<T | undefined> {
  const token = await accessToken(ctx.env, { fetchImpl: ctx.fetchImpl, signal: ctx.signal, now: ctx.now.getTime() });
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "developer-token": ctx.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    "content-type": "application/json",
  };
  const login = digits(ctx.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (login) headers["login-customer-id"] = login;
  return requestJson<T>(`${API}/customers/${digits(ctx.env.GOOGLE_ADS_CUSTOMER_ID)}${path}`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers,
    fetchImpl: ctx.fetchImpl,
    signal: ctx.signal,
    timeoutMs: 15_000,
    errorDetail: googleAdsErrorCode,
  });
}

const currencyCache = new Map<string, string>();

async function accountCurrency(ctx: ProviderContext): Promise<string> {
  const id = digits(ctx.env.GOOGLE_ADS_CUSTOMER_ID);
  const hit = currencyCache.get(id);
  if (hit) return hit;
  const r = await adsPost<{ results?: { customer?: { currencyCode?: string } }[] }>("/googleAds:search", { query: "SELECT customer.currency_code FROM customer LIMIT 1" }, ctx);
  const code = r?.results?.[0]?.customer?.currencyCode;
  if (!code) throw new ProviderHttpError("Google Ads returned no account currency", "parse");
  currencyCache.set(id, code);
  return code;
}

/** Keyword planning is limited to 1 request per second per customer ID. */
const planningThrottle = createThrottle(1_100);

export const googleAds: KeywordProvider = {
  id: "google-ads",
  name: "Google Search (Keyword Planner)",
  group: "Search & ads",
  glyph: "G",
  color: "#4ade80",
  implemented: true,
  access: "Google Ads API developer token with Basic or Standard access, OAuth client and refresh token for a Google Ads account. The API is free; keyword planning is limited to 1 request per second per customer.",
  docsUrl: "https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas",
  provides: ["Keyword ideas", "Average monthly searches with up to 12 months history", "Competition (LOW/MEDIUM/HIGH, 0–100)", "Top-of-page bid low/high and average CPC"],
  notProvided: ["Real-time trends", "Device split", "Organic ranking difficulty"],
  supports: { country: true, language: true, window: false },
  defaultEnabled: true,
  timeoutMs: 20_000,
  configuration,

  async liveCheck(ctx) {
    await accountCurrency(ctx);
  },

  async search(req, ctx) {
    const geo = geoTargetConstant(req.country);
    const language = languageConstant(req.language);
    if (!geo) throw new ProviderHttpError(`no Google Ads location mapping for ${req.country}`, "http");
    if (!language) throw new ProviderHttpError(`no Google Ads language mapping for ${req.language}`, "http");
    const currency = await accountCurrency(ctx).catch(() => undefined);
    const res = await planningThrottle(
      () =>
        adsPost<IdeasResponse>(":generateKeywordIdeas", {
          language,
          geoTargetConstants: [geo],
          includeAdultKeywords: false,
          keywordPlanNetwork: "GOOGLE_SEARCH",
          keywordSeed: { keywords: [req.query] },
          historicalMetricsOptions: { includeAverageCpc: true },
          pageSize: 200,
        }, ctx),
      ctx.signal,
    );
    if (res && !Array.isArray(res.results ?? [])) throw new ProviderHttpError("unexpected keyword ideas response", "parse");
    const results = res?.results ?? [];
    const records = parseKeywordIdeas(results, { currency, country: req.country, language: req.language, fetchedAt: ctx.now.toISOString() });
    const seed = records.find((r) => r.normalized === normalizeKeyword(req.query));
    const total = num(res?.totalSize);
    return {
      records,
      seedHistory: seed?.history,
      seedRecordId: seed?.id,
      message: `${records.length} keyword ideas${total && total > records.length ? ` (first page of ${total})` : ""}${currency ? `; bids in ${currency}` : ""}.`,
    };
  },
};
