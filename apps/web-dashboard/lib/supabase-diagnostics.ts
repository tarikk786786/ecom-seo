import { checkSupabaseEnv, projectRef, type EnvIssue } from "./env";

/** Display vocabulary shared by every integration card. */
export type ConnectionState =
  | "configured"
  | "checking"
  | "connected"
  | "reachable"
  | "auth_required"
  | "missing_config"
  | "connection_error"
  | "not_integrated"
  | "reachable_unverified"
  | "not_found";

export type CheckResult = {
  state: ConnectionState;
  summary: string;
  detail?: string;
  httpStatus?: number;
  latencyMs?: number;
};

export type SupabaseDiagnostics = {
  checkedAt: string;
  projectRef?: string;
  url?: string;
  keyKind?: "publishable" | "legacy_anon";
  configuration: CheckResult & { issues: EnvIssue[] };
  endpoint: CheckResult;
  auth: CheckResult & { emailSignInEnabled?: boolean; signupDisabled?: boolean };
  dataApi: CheckResult & { exposedTables?: string[] };
  todosTable: CheckResult & { columns?: string[]; visibleRows?: number };
};

export type SessionCheck = { state: "signed_in" | "signed_out" | "unavailable"; email?: string; detail?: string };

export type HealthResponse = SupabaseDiagnostics & { session: SessionCheck };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 6000;

async function timedFetch(fetchImpl: FetchLike, url: string, headers: Record<string, string>) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers, signal: controller.signal, cache: "no-store", redirect: "error" });
    const text = await res.text();
    return { ok: true as const, status: res.status, text, headers: res.headers, latencyMs: Date.now() - started };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false as const, error: aborted ? `timed out after ${TIMEOUT_MS} ms` : err instanceof Error ? err.message : String(err), latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text: string): Record<string, unknown> | undefined {
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Runs read-only diagnostics against the configured Supabase project.
 * Every layer is reported separately; nothing is inferred from a different layer's success.
 */
export async function diagnoseSupabase(raw: { url?: string; key?: string }, fetchImpl: FetchLike = fetch): Promise<SupabaseDiagnostics> {
  const checkedAt = new Date().toISOString();
  const env = checkSupabaseEnv(raw);
  const url = env.ok ? env.env.url : env.url;
  const key = env.ok ? env.env.publishableKey : undefined;
  const skipped = (summary: string): CheckResult => ({ state: "missing_config", summary });

  const configuration: SupabaseDiagnostics["configuration"] = env.ok
    ? { state: "configured", summary: `URL and ${env.keyKind === "publishable" ? "publishable" : "legacy anon"} key present. Configuration alone does not prove connectivity.`, issues: [] }
    : { state: "missing_config", summary: env.issues.map((i) => i.message).join(" "), issues: env.issues };

  const base: Omit<SupabaseDiagnostics, "endpoint" | "auth" | "dataApi" | "todosTable"> = { checkedAt, projectRef: projectRef(url), url, keyKind: env.ok ? env.keyKind : undefined, configuration };

  if (!url) {
    const s = skipped("Skipped: project URL is not configured.");
    return { ...base, endpoint: s, auth: s, dataApi: s, todosTable: s };
  }

  // 1. Endpoint reachability. Any HTTP response from the Auth health route proves the host is reachable.
  const health = await timedFetch(fetchImpl, `${url}/auth/v1/health`, key ? { apikey: key } : {});
  const endpoint: CheckResult = health.ok
    ? { state: "reachable", summary: `Supabase endpoint responded (HTTP ${health.status}). Reachability only; authentication is checked separately.`, httpStatus: health.status, latencyMs: health.latencyMs }
    : { state: "connection_error", summary: `Could not reach ${url}: ${health.error}`, latencyMs: health.latencyMs };

  if (!health.ok) {
    const s: CheckResult = { state: "connection_error", summary: "Skipped: endpoint unreachable." };
    return { ...base, endpoint, auth: s, dataApi: s, todosTable: s };
  }
  if (!key) {
    const s = skipped("Skipped: publishable key is not configured, so authenticated API checks cannot run.");
    return { ...base, endpoint, auth: s, dataApi: s, todosTable: s };
  }

  // 2. Auth service: health with the key, then public settings (which sign-in methods are enabled).
  let auth: SupabaseDiagnostics["auth"];
  if (health.status === 200) {
    const settings = await timedFetch(fetchImpl, `${url}/auth/v1/settings`, { apikey: key });
    const body = settings.ok && settings.status === 200 ? parseJson(settings.text) : undefined;
    const external = body?.external as Record<string, unknown> | undefined;
    auth = {
      state: "connected",
      summary: "Auth service healthy and accepted the publishable key.",
      httpStatus: 200,
      latencyMs: health.latencyMs,
      emailSignInEnabled: typeof external?.email === "boolean" ? external.email : undefined,
      signupDisabled: typeof body?.disable_signup === "boolean" ? body.disable_signup : undefined,
    };
  } else if (health.status === 401 || health.status === 403) {
    auth = { state: "auth_required", summary: "Auth service rejected the API key. Check that the publishable key belongs to this project and is not revoked.", httpStatus: health.status, detail: health.text.slice(0, 300) };
  } else {
    auth = { state: "connection_error", summary: `Auth health returned HTTP ${health.status}.`, httpStatus: health.status, detail: health.text.slice(0, 300) };
  }

  // 3. Data API (PostgREST). The OpenAPI root lists exposed tables when the key is allowed to read it.
  const restHeaders = { apikey: key, accept: "application/openapi+json" };
  const root = await timedFetch(fetchImpl, `${url}/rest/v1/`, restHeaders);
  let dataApi: SupabaseDiagnostics["dataApi"];
  let todosColumns: string[] | undefined;
  if (!root.ok) {
    dataApi = { state: "connection_error", summary: `Data API request failed: ${root.error}`, latencyMs: root.latencyMs };
  } else if (root.status === 200) {
    const spec = parseJson(root.text);
    const paths = Object.keys((spec?.paths as Record<string, unknown> | undefined) ?? {}).filter((p) => p !== "/" && !p.startsWith("/rpc/"));
    const definitions = (spec?.definitions as Record<string, { properties?: Record<string, unknown> }> | undefined) ?? {};
    todosColumns = definitions.todos?.properties ? Object.keys(definitions.todos.properties) : undefined;
    dataApi = {
      state: "reachable_unverified",
      summary: `Data API responded and exposes ${paths.length} table/view path(s) to this key. Schema listing is not a row query.`,
      httpStatus: 200,
      latencyMs: root.latencyMs,
      exposedTables: paths.map((p) => p.slice(1)),
    };
  } else if (root.status === 401 || root.status === 403) {
    dataApi = { state: "reachable_unverified", summary: `Data API responded (HTTP ${root.status}); schema listing is not permitted for the publishable key. Table access is checked separately.`, httpStatus: root.status, latencyMs: root.latencyMs };
  } else {
    dataApi = { state: "connection_error", summary: `Data API returned HTTP ${root.status}.`, httpStatus: root.status, latencyMs: root.latencyMs, detail: root.text.slice(0, 300) };
  }

  // 4. Example table. A real SELECT executes in Postgres under the anon role and RLS.
  const todos = await timedFetch(fetchImpl, `${url}/rest/v1/todos?select=*&limit=0`, { apikey: key, prefer: "count=exact" });
  let todosTable: SupabaseDiagnostics["todosTable"];
  if (!todos.ok) {
    todosTable = { state: "connection_error", summary: `Query failed: ${todos.error}` };
  } else {
    const err = parseJson(todos.text);
    const code = typeof err?.code === "string" ? err.code : undefined;
    if (todos.status === 200 || todos.status === 206) {
      const range = todos.headers.get("content-range");
      const total = range?.split("/")[1];
      const visibleRows = total && total !== "*" ? Number(total) : undefined;
      todosTable = {
        state: "connected",
        summary: `Query executed in the database. ${visibleRows ?? "Unknown number of"} row(s) visible to the anonymous role under RLS.`,
        httpStatus: todos.status,
        latencyMs: todos.latencyMs,
        columns: todosColumns,
        visibleRows,
      };
      dataApi = { ...dataApi, state: "connected", summary: `${dataApi.summary} A table query executed successfully, so database access through the Data API is verified.` };
    } else if (code === "PGRST205" || code === "42P01") {
      todosTable = { state: "not_found", summary: "No public.todos table is exposed to the Data API. Nothing is shown; create it with the proposed migration if needed.", httpStatus: todos.status, detail: String(err?.message ?? "") };
    } else if (code === "42501" || todos.status === 401 || todos.status === 403) {
      todosTable = { state: "auth_required", summary: "The table exists but the anonymous role has no SELECT permission (sign in or add a grant/RLS policy).", httpStatus: todos.status, detail: String(err?.message ?? "") };
    } else {
      todosTable = { state: "connection_error", summary: `Unexpected HTTP ${todos.status} from the Data API.`, httpStatus: todos.status, detail: todos.text.slice(0, 300) };
    }
  }

  return { ...base, endpoint, auth, dataApi, todosTable };
}
