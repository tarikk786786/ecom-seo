import { cachedToken, missingEnv, ProviderHttpError, requestJson, type FetchLike } from "@/lib/keywords/http";
import type { GscAnalyticsRow, GscConfigState, GscQueryRequest, GscQueryResult, GscSiteEntry, GscStatus } from "./types";

export const GSC_ENV = ["GSC_CLIENT_ID", "GSC_CLIENT_SECRET", "GSC_REFRESH_TOKEN", "GSC_SITE_URL"] as const;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SITES_URL = "https://www.googleapis.com/webmasters/v3/sites";
const SCOPE_HINT = "https://www.googleapis.com/auth/webmasters.readonly";

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string };
type SitesResponse = { siteEntry?: { siteUrl?: string; permissionLevel?: string }[] };
type AnalyticsResponse = {
  rows?: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[];
  responseAggregationType?: string;
};

export function readGscConfig(env: Record<string, string | undefined>): GscConfigState {
  const missing = missingEnv(env, [...GSC_ENV]);
  if (missing.length) {
    return {
      ok: false,
      state: "NOT_CONFIGURED",
      missing,
      reason: `Add ${missing.join(", ")} to the repository-root .env.local. OAuth refresh token must include scope ${SCOPE_HINT}. Own verified properties only.`,
    };
  }
  const siteUrl = env.GSC_SITE_URL!.trim();
  if (!/^https?:\/\//i.test(siteUrl) && !/^sc-domain:/i.test(siteUrl)) {
    return {
      ok: false,
      state: "ACCESS_REQUIRED",
      missing: [],
      reason: "GSC_SITE_URL must be a URL-prefix property (https://…) or a domain property (sc-domain:example.com).",
    };
  }
  return { ok: true, siteUrl };
}

async function accessToken(env: Record<string, string | undefined>, fetchImpl?: FetchLike, now = Date.now()): Promise<string> {
  const clientId = env.GSC_CLIENT_ID!.trim();
  const clientSecret = env.GSC_CLIENT_SECRET!.trim();
  const refreshToken = env.GSC_REFRESH_TOKEN!.trim();
  return cachedToken(`gsc:${clientId}`, now, async () => {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const json = await requestJson<TokenResponse>(TOKEN_URL, {
      fetchImpl,
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      timeoutMs: 12_000,
      notFoundAsEmpty: false,
    });
    if (!json?.access_token) {
      throw new ProviderHttpError(json?.error_description || json?.error || "GSC token exchange failed", "auth");
    }
    return { token: json.access_token, expiresInS: Number(json.expires_in) || 3600 };
  });
}

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export function encodeSiteUrl(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}

export function buildAnalyticsBody(req: GscQueryRequest): Record<string, unknown> {
  const dimensions = req.dimensions?.length ? req.dimensions : (["query"] as const);
  const filters: { dimension: string; operator: string; expression: string }[] = [];
  if (req.pageFilter) filters.push({ dimension: "page", operator: "contains", expression: req.pageFilter });
  if (req.queryFilter) filters.push({ dimension: "query", operator: "contains", expression: req.queryFilter });
  if (req.countryFilter) filters.push({ dimension: "country", operator: "equals", expression: req.countryFilter.toLowerCase() });
  if (req.deviceFilter) filters.push({ dimension: "device", operator: "equals", expression: req.deviceFilter });

  const body: Record<string, unknown> = {
    startDate: req.startDate,
    endDate: req.endDate,
    dimensions: [...dimensions],
    rowLimit: Math.min(Math.max(req.rowLimit ?? 25, 1), 25000),
    startRow: Math.max(req.startRow ?? 0, 0),
  };
  if (filters.length) {
    body.dimensionFilterGroups = [{ groupType: "and", filters }];
  }
  return body;
}

export function parseAnalyticsRows(rows: AnalyticsResponse["rows"]): GscAnalyticsRow[] {
  return (rows ?? []).flatMap((r) => {
    const clicks = Number(r.clicks);
    const impressions = Number(r.impressions);
    const ctr = Number(r.ctr);
    const position = Number(r.position);
    if (![clicks, impressions, ctr, position].every(Number.isFinite)) return [];
    return [
      {
        keys: Array.isArray(r.keys) ? r.keys.map(String) : [],
        clicks,
        impressions,
        ctr,
        position,
      },
    ];
  });
}

export function defaultDateRange(now = new Date()): { startDate: string; endDate: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}

export async function listSites(env: Record<string, string | undefined>, fetchImpl?: FetchLike): Promise<GscSiteEntry[]> {
  const token = await accessToken(env, fetchImpl);
  const json = await requestJson<SitesResponse>(SITES_URL, {
    fetchImpl,
    headers: authHeaders(token),
    timeoutMs: 12_000,
    notFoundAsEmpty: false,
  });
  return (json?.siteEntry ?? [])
    .filter((s): s is { siteUrl: string; permissionLevel?: string } => Boolean(s.siteUrl))
    .map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }));
}

export async function querySearchAnalytics(
  env: Record<string, string | undefined>,
  req: GscQueryRequest,
  fetchImpl?: FetchLike,
): Promise<GscQueryResult> {
  const cfg = readGscConfig(env);
  if (!cfg.ok) throw new ProviderHttpError(cfg.reason, "auth");
  const token = await accessToken(env, fetchImpl);
  const body = buildAnalyticsBody(req);
  const url = `${SITES_URL}/${encodeSiteUrl(cfg.siteUrl)}/searchAnalytics/query`;
  const json = await requestJson<AnalyticsResponse>(url, {
    fetchImpl,
    method: "POST",
    headers: { ...authHeaders(token), "content-type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 20_000,
    notFoundAsEmpty: false,
  });
  const dimensions = (body.dimensions as string[]) ?? ["query"];
  return {
    siteUrl: cfg.siteUrl,
    startDate: req.startDate,
    endDate: req.endDate,
    dimensions,
    rows: parseAnalyticsRows(json?.rows),
    fetchedAt: new Date().toISOString(),
    dataSource: "google_search_console",
    measurementMethod: "searchanalytics.query",
    note: "Average position and CTR are Search Console aggregates for your verified property—not personalized SERP ranks for every user.",
  };
}

export async function getGscStatus(env: Record<string, string | undefined>, fetchImpl?: FetchLike): Promise<GscStatus> {
  const checkedAt = new Date().toISOString();
  const cfg = readGscConfig(env);
  if (!cfg.ok) {
    return {
      configured: false,
      state: cfg.state,
      missing: cfg.missing,
      siteUrl: null,
      detail: cfg.reason,
      checkedAt,
    };
  }
  const started = Date.now();
  try {
    const sites = await listSites(env, fetchImpl);
    const match = sites.some((s) => s.siteUrl === cfg.siteUrl);
    return {
      configured: true,
      state: match ? "CONNECTED" : "ACCESS_REQUIRED",
      missing: [],
      siteUrl: cfg.siteUrl,
      detail: match
        ? `Live sites.list succeeded; configured property ${cfg.siteUrl} is in the account.`
        : `Token works, but ${cfg.siteUrl} was not returned by sites.list. Check the property URL spelling or verification.`,
      checkedAt,
      latencyMs: Date.now() - started,
      sites,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const auth = err instanceof ProviderHttpError && err.category === "auth";
    return {
      configured: true,
      state: auth ? "ACCESS_REQUIRED" : "ERROR",
      missing: [],
      siteUrl: cfg.siteUrl,
      detail: msg,
      checkedAt,
      latencyMs: Date.now() - started,
    };
  }
}
