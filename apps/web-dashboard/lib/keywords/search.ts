import { ProviderHttpError, redactSecrets, type FetchLike, type HttpErrorCategory } from "./http";
import type { KeywordProvider } from "./provider";
import { normalizeKeyword } from "./text";
import { TIME_WINDOWS, type FilterApplication, type KeywordSearchRequest, type KeywordSearchResponse, type ProviderOutcome, type ProviderState, type TimeWindow } from "./types";

export const MAX_QUERY_LENGTH = 120;
const DEFAULT_TIMEOUT_MS = 12_000;

export type ValidationResult = { ok: true; request: KeywordSearchRequest } | { ok: false; error: string };

export function validateSearchRequest(body: unknown, known: string[]): ValidationResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be a JSON object." };
  const b = body as Record<string, unknown>;
  const query = typeof b.query === "string" ? b.query.replace(/\s+/g, " ").trim() : "";
  if (!normalizeKeyword(query)) return { ok: false, error: "Enter a keyword to search." };
  if (query.length > MAX_QUERY_LENGTH) return { ok: false, error: `Keywords are limited to ${MAX_QUERY_LENGTH} characters.` };
  const providers = Array.isArray(b.providers) ? [...new Set(b.providers.filter((p): p is string => typeof p === "string"))] : [];
  if (!providers.length) return { ok: false, error: "Select at least one platform." };
  const unknown = providers.filter((p) => !known.includes(p));
  if (unknown.length) return { ok: false, error: `Unknown platform: ${unknown.join(", ")}` };
  const country = typeof b.country === "string" && /^[A-Z]{2}$/.test(b.country) ? b.country : "";
  if (!country) return { ok: false, error: "Country must be a two-letter code." };
  const language = typeof b.language === "string" && /^[a-z]{2,3}$/.test(b.language) ? b.language : "";
  if (!language) return { ok: false, error: "Language must be an ISO 639 code." };
  const window = TIME_WINDOWS.some((w) => w.id === b.window) ? (b.window as TimeWindow) : undefined;
  if (!window) return { ok: false, error: "Unsupported time window." };
  const stackExchangeSite = typeof b.stackExchangeSite === "string" && /^[a-z]{2,40}$/.test(b.stackExchangeSite) ? b.stackExchangeSite : undefined;
  return { ok: true, request: { query, providers, country, language, window, stackExchangeSite } };
}

const applied = (supported: boolean): FilterApplication => (supported ? "applied" : "not_supported");

export function errorState(cat: HttpErrorCategory): ProviderState {
  if (cat === "rate_limited") return "RATE_LIMITED";
  if (cat === "timeout") return "DEGRADED";
  if (cat === "auth") return "ACCESS_REQUIRED";
  return "ERROR";
}

function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  parent?.addEventListener("abort", onAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Reject before aborting so the race reports the timeout, not the provider's abort error.
      reject(new ProviderHttpError(`timed out after ${Math.round(ms / 1000)} s`, "timeout"));
      controller.abort();
    }, ms);
  });
  return Promise.race([work(controller.signal), timeout]).finally(() => {
    clearTimeout(timer);
    parent?.removeEventListener("abort", onAbort);
  });
}

/**
 * Runs every requested provider concurrently. A failing or slow provider never discards
 * results from the others; each gets its own outcome entry.
 */
export async function runKeywordSearch(
  req: KeywordSearchRequest,
  registry: KeywordProvider[],
  opts: { env: Record<string, string | undefined>; fetchImpl?: FetchLike; signal?: AbortSignal; now?: Date; timeoutMs?: number },
): Promise<KeywordSearchResponse> {
  const now = opts.now ?? new Date();
  const response: KeywordSearchResponse = { query: req.query, request: req, fetchedAt: now.toISOString(), records: [], outcomes: [] };

  const settled = await Promise.all(
    req.providers.map(async (id): Promise<{ outcome: ProviderOutcome; result?: Awaited<ReturnType<NonNullable<KeywordProvider["search"]>>> }> => {
      const p = registry.find((x) => x.id === id)!;
      const base = {
        provider: p.id,
        name: p.name,
        applied: { country: applied(p.supports.country), language: applied(p.supports.language), window: applied(p.supports.window) },
      };
      const config = p.configuration({ env: opts.env });
      if (!config.ok || !p.implemented || !p.search) {
        return {
          outcome: { ...base, status: "skipped", state: config.ok ? "NOT_CONFIGURED" : config.state, message: config.ok ? "Adapter not implemented yet." : config.reason, resultCount: 0 },
        };
      }
      const started = Date.now();
      try {
        const result = await withTimeout(
          (signal) => p.search!(req, { env: opts.env, fetchImpl: opts.fetchImpl, signal, now }),
          opts.timeoutMs ?? p.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          opts.signal,
        );
        const count = result.records.length;
        return {
          result,
          outcome: { ...base, status: count ? "ok" : "empty", state: "CONNECTED", message: result.message ?? (count ? undefined : "The provider responded but returned no matching keywords."), durationMs: Date.now() - started, resultCount: count, fetchedAt: new Date().toISOString() },
        };
      } catch (err) {
        const cat = err instanceof ProviderHttpError ? err.category : "network";
        const message = redactSecrets(err instanceof Error ? err.message : String(err), opts.env);
        return {
          outcome: {
            ...base,
            status: cat === "timeout" ? "timeout" : cat === "rate_limited" ? "rate_limited" : "error",
            state: errorState(cat),
            message,
            durationMs: Date.now() - started,
            resultCount: 0,
          },
        };
      }
    }),
  );

  for (const { outcome, result } of settled) {
    response.outcomes.push(outcome);
    if (!result) continue;
    response.records.push(...result.records);
    // Seed chart: observed search counts, then other absolute counts (pageviews), then indices (news coverage).
    const rank = (h: { kind: string; unit: string }) => (h.kind === "absolute" ? (h.unit === "searches" ? 3 : 2) : 1);
    if (result.seedHistory) {
      if (!response.seedHistory || rank(result.seedHistory) > rank(response.seedHistory)) {
        response.seedHistory = { ...result.seedHistory, provider: outcome.provider };
      }
    }
    if (result.devices && !response.devices) response.devices = result.devices;
  }

  const seen = new Set<string>();
  response.records = response.records.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  return response;
}
