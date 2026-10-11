import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copySessionState, updateSession } from "@/utils/supabase/proxy";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  vi.unstubAllGlobals();
});

describe("updateSession", () => {
  it("passes requests through when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const res = await updateSession(new NextRequest("http://localhost:3000/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.cookies.getAll()).toHaveLength(0);
  });

  it("does not call Supabase or set cookies for an anonymous visitor", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await updateSession(new NextRequest("http://localhost:3000/integrations"));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.cookies.getAll()).toHaveLength(0);
  });
});

describe("copySessionState", () => {
  it("copies refreshed cookies and no-cache headers to a replacement response", () => {
    const from = NextResponse.next();
    from.cookies.set("sb-proj-auth-token", "v", { httpOnly: true, path: "/" });
    from.headers.set("cache-control", "private, no-cache, no-store, must-revalidate, max-age=0");
    from.headers.set("pragma", "no-cache");
    const to = copySessionState(from, NextResponse.redirect("http://localhost:3000/login"));
    expect(to.cookies.get("sb-proj-auth-token")?.value).toBe("v");
    expect(to.headers.get("cache-control")).toContain("no-store");
    expect(to.headers.get("pragma")).toBe("no-cache");
  });
});
