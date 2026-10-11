import { describe, expect, it } from "vitest";
import { safeNextPath, validateCredentials } from "@/lib/auth-validation";

const form = (data: Record<string, string>) => {
  const f = new FormData();
  Object.entries(data).forEach(([k, v]) => f.set(k, v));
  return f;
};

describe("validateCredentials", () => {
  it("normalizes a valid email", () => {
    expect(validateCredentials(form({ email: "  User@Example.COM ", password: "pw" }))).toEqual({ ok: true, email: "user@example.com", password: "pw" });
  });
  it("rejects invalid emails and short sign-up passwords", () => {
    expect(validateCredentials(form({ email: "nope", password: "x" })).ok).toBe(false);
    const r = validateCredentials(form({ email: "a@b.co", password: "short" }), { minPasswordLength: 8 });
    expect(r).toMatchObject({ ok: false, error: "Password must be at least 8 characters.", email: "a@b.co" });
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/account", "/account"],
    ["/integrations?x=1", "/integrations?x=1"],
    ["https://evil.example", "/account"],
    ["//evil.example", "/account"],
    ["/\\evil.example", "/account"],
    [undefined, "/account"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
