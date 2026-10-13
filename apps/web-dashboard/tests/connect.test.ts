import { describe, expect, it } from "vitest";
import { CONNECT_ENV_NAMES, CONNECT_PLATFORMS } from "@/lib/connect/catalog";
import { isLocalRequest, upsertEnv, validateEnvValue } from "@/lib/connect/env-file";
import { PROVIDERS } from "@/lib/keywords/registry";

describe("upsertEnv", () => {
  it("replaces existing values in place and keeps everything else", () => {
    const before = "# Supabase\nNEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co\nETSY_API_KEY=old\n\nOPENAI_API_KEY=sk-1\n";
    expect(upsertEnv(before, { ETSY_API_KEY: "newkey123" })).toBe("# Supabase\nNEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co\nETSY_API_KEY=newkey123\n\nOPENAI_API_KEY=sk-1\n");
  });

  it("appends new values under one header and preserves CRLF files", () => {
    const out = upsertEnv("A=1\r\n", { ETSY_API_KEY: "k", ETSY_SHARED_SECRET: "s" });
    expect(out).toBe("A=1\r\n\r\n# Added from the Connect page\r\nETSY_API_KEY=k\r\nETSY_SHARED_SECRET=s\r\n");
  });

  it("removes a variable when given an empty value and ignores commented examples", () => {
    expect(upsertEnv("# ETSY_API_KEY=example\nETSY_API_KEY=k\nB=2\n", { ETSY_API_KEY: "" })).toBe("# ETSY_API_KEY=example\nB=2\n");
  });

  it("quotes values with spaces or quotes so dotenv reads them back exactly", () => {
    expect(upsertEnv("", { X_KEY: 'a b"c' })).toBe("# Added from the Connect page\nX_KEY='a b\"c'\n");
    expect(upsertEnv("", { X_KEY: "it's" })).toBe('# Added from the Connect page\nX_KEY="it\'s"\n');
    expect(() => upsertEnv("", { X_KEY: `a'b"c` })).toThrow();
  });

  it("rejects invalid names and multi-line values", () => {
    expect(() => upsertEnv("", { "bad name": "x" })).toThrow();
    expect(validateEnvValue("abc\nEVIL=1")).toBeTruthy();
    expect(validateEnvValue("abc123")).toBeUndefined();
  });
});

describe("isLocalRequest", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("accepts same-origin requests to localhost", () => {
    expect(isLocalRequest(h({ host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isLocalRequest(h({ host: "127.0.0.1:3000", "sec-fetch-site": "none" }))).toBe(true);
    expect(isLocalRequest(h({ host: "localhost:3000", "x-forwarded-for": "::1", "x-forwarded-host": "localhost:3000" }))).toBe(true);
  });
  it("refuses hosted, proxied and cross-site requests", () => {
    expect(isLocalRequest(h({ host: "seo.example.com" }))).toBe(false);
    expect(isLocalRequest(h({ host: "localhost:3000", "x-forwarded-for": "1.2.3.4" }))).toBe(false);
    expect(isLocalRequest(h({ host: "localhost:3000", origin: "https://evil.example" }))).toBe(false);
    expect(isLocalRequest(h({ host: "localhost:3000", "sec-fetch-site": "cross-site" }))).toBe(false);
  });
});

describe("connect catalog", () => {
  it("only targets real providers and server-side variable names", () => {
    for (const p of CONNECT_PLATFORMS) expect(PROVIDERS.some((r) => r.id === p.provider)).toBe(true);
    for (const n of CONNECT_ENV_NAMES) expect(n.startsWith("NEXT_PUBLIC_")).toBe(false);
  });
});
