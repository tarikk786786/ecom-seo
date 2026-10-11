export const USER_AGENT = "EcomSEO-KeywordResearch/0.1 (+https://github.com/tarikk786786/ecom-seo)";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly category: "timeout" | "rate_limited" | "http" | "network" | "parse" | "cancelled",
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

/** GET with timeout, caller abort, response-size cap and categorised errors. */
export async function getText(
  url: string,
  opts: { fetchImpl?: FetchLike; signal?: AbortSignal; timeoutMs?: number; headers?: Record<string, string>; maxBytes?: number } = {},
): Promise<string> {
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
      headers: { "user-agent": USER_AGENT, "api-user-agent": USER_AGENT, ...opts.headers },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    const text = await res.text();
    if (text.length > (opts.maxBytes ?? 2_000_000)) throw new ProviderHttpError("response too large", "parse");
    if (res.status === 429) throw new ProviderHttpError("rate limited by provider (HTTP 429)", "rate_limited", 429);
    if (res.status === 404) return "";
    if (!res.ok) throw new ProviderHttpError(`HTTP ${res.status}`, "http", res.status);
    return text;
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

export async function getJson<T>(url: string, opts: Parameters<typeof getText>[1] = {}): Promise<T | undefined> {
  const text = await getText(url, opts);
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderHttpError("provider returned invalid JSON", "parse");
  }
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
