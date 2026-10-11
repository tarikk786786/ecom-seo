export const USER_AGENT = "EcomSEO-KeywordResearch/0.1 (+https://github.com/tarikk786786/ecom-seo)";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type HttpErrorCategory = "timeout" | "rate_limited" | "auth" | "http" | "network" | "parse" | "cancelled";

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly category: HttpErrorCategory,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

export type RequestOptions = {
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
  maxBytes?: number;
  method?: "GET" | "POST";
  body?: string;
  /** Extra attempts for network errors and HTTP 5xx. Only use for idempotent reads. */
  retries?: number;
  /** Treat 404 as an empty body (public lookups) instead of an error. */
  notFoundAsEmpty?: boolean;
  /** Extracts a short, non-sensitive provider error code from an error body (e.g. "DEVELOPER_TOKEN_NOT_APPROVED"). */
  errorDetail?: (body: string) => string | undefined;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(new ProviderHttpError("cancelled", "cancelled"))), { once: true });
  });

async function attempt(url: string, opts: RequestOptions): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 8000;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      method: opts.method ?? "GET",
      body: opts.body,
      headers: { "user-agent": USER_AGENT, "api-user-agent": USER_AGENT, ...opts.headers },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    const text = await res.text();
    if (text.length > (opts.maxBytes ?? 2_000_000)) throw new ProviderHttpError("response too large", "parse");
    if (res.ok) return text;
    if (res.status === 404 && opts.notFoundAsEmpty !== false) return "";
    const detail = safeDetail(opts.errorDetail, text);
    const suffix = detail ? `: ${detail}` : "";
    if (res.status === 429) throw new ProviderHttpError(`rate limited by provider (HTTP 429)${suffix}`, "rate_limited", 429);
    if (res.status === 401 || res.status === 403) throw new ProviderHttpError(`credentials rejected or access not granted (HTTP ${res.status})${suffix}`, "auth", res.status);
    throw new ProviderHttpError(`HTTP ${res.status}${suffix}`, "http", res.status);
  } catch (err) {
    if (err instanceof ProviderHttpError) throw err;
    if (timedOut) throw new ProviderHttpError(`timed out after ${timeoutMs} ms`, "timeout");
    if (opts.signal?.aborted) throw new ProviderHttpError("cancelled", "cancelled");
    throw new ProviderHttpError(err instanceof Error ? err.message : String(err), "network");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

function safeDetail(fn: RequestOptions["errorDetail"], body: string): string | undefined {
  if (!fn) return undefined;
  try {
    const d = fn(body);
    return d ? d.replace(/[^\w .:/-]/g, "").slice(0, 120) : undefined;
  } catch {
    return undefined;
  }
}

/** HTTP request with timeout, caller abort, response-size cap, bounded retries and categorised errors. */
export async function requestText(url: string, opts: RequestOptions = {}): Promise<string> {
  const retries = Math.max(0, Math.min(opts.retries ?? 0, 3));
  for (let i = 0; ; i++) {
    try {
      return await attempt(url, opts);
    } catch (err) {
      const retryable = err instanceof ProviderHttpError && (err.category === "network" || (err.category === "http" && (err.status ?? 0) >= 500));
      if (!retryable || i >= retries) throw err;
      await sleep(250 * 2 ** i, opts.signal);
    }
  }
}

/** GET with the defaults used by public lookups (404 means "no data"). */
export const getText = (url: string, opts: RequestOptions = {}) => requestText(url, { ...opts, method: "GET" });

export function parseJson<T>(text: string): T | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderHttpError("provider returned invalid JSON", "parse");
  }
}

export async function getJson<T>(url: string, opts: RequestOptions = {}): Promise<T | undefined> {
  return parseJson<T>(await getText(url, opts));
}

export async function requestJson<T>(url: string, opts: RequestOptions = {}): Promise<T | undefined> {
  return parseJson<T>(await requestText(url, { notFoundAsEmpty: false, ...opts }));
}

/** Runs async work over items with bounded concurrency, preserving order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}

const SECRET_NAME = /(SECRET|TOKEN|PASSWORD|API_KEY|_KEY$|CREDENTIAL)/;

/** Removes any configured secret value from a message before it is logged or returned to the browser. */
export function redactSecrets(message: string, env: Record<string, string | undefined>): string {
  let out = message;
  for (const [name, value] of Object.entries(env)) {
    if (!value || value.length < 8 || !SECRET_NAME.test(name) || name.startsWith("NEXT_PUBLIC_")) continue;
    out = out.split(value).join("[redacted]");
  }
  return out.replace(/(bearer\s+)[\w.~+/=-]{12,}/gi, "$1[redacted]");
}

/** Serialises calls in this process so they start at least `intervalMs` apart (provider-mandated pacing). */
export function createThrottle(intervalMs: number) {
  let gate: Promise<void> = Promise.resolve();
  let last = 0;
  return function throttled<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const run = gate.then(async () => {
      const wait = last + intervalMs - Date.now();
      if (wait > 0) await sleep(wait, signal);
      if (signal?.aborted) throw new ProviderHttpError("cancelled", "cancelled");
      last = Date.now();
      return work();
    });
    gate = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

/** Short-lived OAuth access tokens cached in memory per credential (never persisted). */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function cachedToken(key: string, now: number, fetchToken: () => Promise<{ token: string; expiresInS: number }>): Promise<string> {
  const hit = tokenCache.get(key);
  if (hit && hit.expiresAt > now + 60_000) return hit.token;
  const { token, expiresInS } = await fetchToken();
  tokenCache.set(key, { token, expiresAt: now + Math.max(60, expiresInS) * 1000 });
  return token;
}

export const clearTokenCache = () => tokenCache.clear();

export function missingEnv(env: Record<string, string | undefined>, names: string[]): string[] {
  return names.filter((n) => !env[n]?.trim());
}
