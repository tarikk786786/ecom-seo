import { describe, expect, it } from "vitest";
import { checkSupabaseEnv, projectRef, requireSupabaseEnv, SupabaseConfigError } from "@/lib/env";

const URL_OK = "https://fxwelcidbobizssrewip.supabase.co";
const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.sig`;

describe("checkSupabaseEnv", () => {
  it("accepts a URL and publishable key", () => {
    const r = checkSupabaseEnv({ url: `${URL_OK}/`, key: "sb_publishable_abc123" });
    expect(r).toEqual({ ok: true, env: { url: URL_OK, publishableKey: "sb_publishable_abc123" }, keyKind: "publishable" });
  });

  it("accepts a legacy anon JWT", () => {
    const r = checkSupabaseEnv({ url: URL_OK, key: jwt({ role: "anon" }) });
    expect(r.ok && r.keyKind).toBe("legacy_anon");
  });

  it("reports both variables missing", () => {
    const r = checkSupabaseEnv({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => `${i.variable}:${i.problem}`)).toEqual(["NEXT_PUBLIC_SUPABASE_URL:missing", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:missing"]);
  });

  it("treats the .env.example placeholder as not configured but keeps the URL for reachability checks", () => {
    const r = checkSupabaseEnv({ url: URL_OK, key: "replace_with_your_publishable_key" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues[0]?.problem).toBe("placeholder");
      expect(r.url).toBe(URL_OK);
    }
  });

  it.each(["sb_secret_abc", jwt({ role: "service_role" })])("refuses privileged keys (%s)", (key) => {
    const r = checkSupabaseEnv({ url: URL_OK, key });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.problem).toBe("privileged_key");
  });

  it.each(["http://example.supabase.co", "https://x.supabase.co/rest/v1", "not a url", "ftp://x.supabase.co"])("rejects invalid URL %s", (url) => {
    const r = checkSupabaseEnv({ url, key: "sb_publishable_x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.problem).toBe("invalid");
  });

  it("allows http for local Supabase", () => {
    expect(checkSupabaseEnv({ url: "http://127.0.0.1:54321", key: "sb_publishable_x" }).ok).toBe(true);
  });

  it("rejects unknown key formats", () => {
    const r = checkSupabaseEnv({ url: URL_OK, key: "random-string" });
    expect(!r.ok && r.issues[0]?.problem).toBe("invalid");
  });
});

describe("requireSupabaseEnv", () => {
  it("throws a descriptive SupabaseConfigError when unset", () => {
    const saved = { ...process.env };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    try {
      expect(() => requireSupabaseEnv()).toThrow(SupabaseConfigError);
      expect(() => requireSupabaseEnv()).toThrow(/\.env\.local/);
    } finally {
      process.env = saved;
    }
  });
});

describe("projectRef", () => {
  it("extracts the hosted project ref", () => {
    expect(projectRef(URL_OK)).toBe("fxwelcidbobizssrewip");
    expect(projectRef("http://127.0.0.1:54321")).toBeUndefined();
  });
});
