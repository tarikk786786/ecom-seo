import { describe, expect, it } from "vitest";
import { diagnoseSupabase } from "@/lib/supabase-diagnostics";

// All responses here are mocks. They test classification logic only and say nothing about the live project.
const URL_OK = "https://proj.supabase.co";
const KEY = "sb_publishable_test";

type Route = { status: number; body?: unknown; headers?: Record<string, string> } | Error;

function mockFetch(routes: Record<string, Route>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = async (input: string, init?: RequestInit) => {
    calls.push({ url: input, headers: (init?.headers ?? {}) as Record<string, string> });
    const path = input.replace(URL_OK, "").split("?")[0]!;
    const r = routes[path];
    if (!r) throw new Error(`unexpected request ${input}`);
    if (r instanceof Error) throw r;
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status, headers: r.headers });
  };
  return { impl, calls };
}

const healthy = {
  "/auth/v1/health": { status: 200, body: { name: "GoTrue" } },
  "/auth/v1/settings": { status: 200, body: { external: { email: true }, disable_signup: false } },
};

describe("diagnoseSupabase", () => {
  it("makes no network calls without a URL", async () => {
    const { impl, calls } = mockFetch({});
    const d = await diagnoseSupabase({}, impl);
    expect(calls).toHaveLength(0);
    expect(d.configuration.state).toBe("missing_config");
    expect(d.endpoint.state).toBe("missing_config");
  });

  it("still checks reachability when only the key is missing, without sending a key", async () => {
    const { impl, calls } = mockFetch({ "/auth/v1/health": { status: 401, body: { message: "No API key found in request" } } });
    const d = await diagnoseSupabase({ url: URL_OK, key: "replace_with_your_publishable_key" }, impl);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers.apikey).toBeUndefined();
    expect(d.endpoint.state).toBe("reachable");
    expect(d.auth.state).toBe("missing_config");
    expect(d.dataApi.state).toBe("missing_config");
  });

  it("reports a network failure as a connection error and skips dependent checks", async () => {
    const { impl } = mockFetch({ "/auth/v1/health": new TypeError("fetch failed") });
    const d = await diagnoseSupabase({ url: URL_OK, key: KEY }, impl);
    expect(d.configuration.state).toBe("configured");
    expect(d.endpoint.state).toBe("connection_error");
    expect(d.endpoint.summary).toContain("fetch failed");
    expect(d.auth.state).toBe("connection_error");
    expect(d.todosTable.state).toBe("connection_error");
  });

  it("flags a rejected key as authentication required", async () => {
    const { impl } = mockFetch({
      "/auth/v1/health": { status: 401, body: { message: "Invalid API key" } },
      "/rest/v1/": { status: 401, body: { message: "Invalid API key" } },
      "/rest/v1/todos": { status: 401, body: { message: "Invalid API key" } },
    });
    const d = await diagnoseSupabase({ url: URL_OK, key: KEY }, impl);
    expect(d.endpoint.state).toBe("reachable");
    expect(d.auth.state).toBe("auth_required");
    expect(d.dataApi.state).toBe("reachable_unverified");
  });

  it("does not claim database access when the todos table is missing", async () => {
    const { impl } = mockFetch({
      ...healthy,
      "/rest/v1/": { status: 403, body: { message: "forbidden" } },
      "/rest/v1/todos": { status: 404, body: { code: "PGRST205", message: "Could not find the table 'public.todos' in the schema cache" } },
    });
    const d = await diagnoseSupabase({ url: URL_OK, key: KEY }, impl);
    expect(d.auth.state).toBe("connected");
    expect(d.auth.emailSignInEnabled).toBe(true);
    expect(d.dataApi.state).toBe("reachable_unverified");
    expect(d.todosTable.state).toBe("not_found");
  });

  it("verifies database access only after a real table query succeeds", async () => {
    const { impl, calls } = mockFetch({
      ...healthy,
      "/rest/v1/": { status: 200, body: { paths: { "/": {}, "/todos": {}, "/rpc/fn": {} }, definitions: { todos: { properties: { id: {}, title: {} } } } } },
      "/rest/v1/todos": { status: 200, body: [], headers: { "content-range": "*/0" } },
    });
    const d = await diagnoseSupabase({ url: URL_OK, key: KEY }, impl);
    expect(d.dataApi.state).toBe("connected");
    expect(d.dataApi.exposedTables).toEqual(["todos"]);
    expect(d.todosTable).toMatchObject({ state: "connected", visibleRows: 0, columns: ["id", "title"] });
    expect(calls.every((c) => !("authorization" in c.headers))).toBe(true);
  });

  it("distinguishes a permission error on an existing table", async () => {
    const { impl } = mockFetch({
      ...healthy,
      "/rest/v1/": { status: 403, body: {} },
      "/rest/v1/todos": { status: 401, body: { code: "42501", message: "permission denied for table todos" } },
    });
    const d = await diagnoseSupabase({ url: URL_OK, key: KEY }, impl);
    expect(d.todosTable.state).toBe("auth_required");
    expect(d.dataApi.state).toBe("reachable_unverified");
  });

  it("never sends a privileged key", async () => {
    const { impl, calls } = mockFetch({ "/auth/v1/health": { status: 401 } });
    const d = await diagnoseSupabase({ url: URL_OK, key: "sb_secret_dangerous" }, impl);
    expect(d.configuration.issues[0]?.problem).toBe("privileged_key");
    expect(calls.every((c) => c.headers.apikey === undefined)).toBe(true);
  });
});
