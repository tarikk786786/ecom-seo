import { describe, expect, it } from "vitest";
import { buildAnalyticsBody, defaultDateRange, encodeSiteUrl, parseAnalyticsRows, readGscConfig } from "@/lib/gsc/client";

describe("GSC config", () => {
  it("reports missing env vars without inventing a connection", () => {
    const cfg = readGscConfig({});
    expect(cfg.ok).toBe(false);
    if (!cfg.ok) {
      expect(cfg.state).toBe("NOT_CONFIGURED");
      expect(cfg.missing).toContain("GSC_REFRESH_TOKEN");
    }
  });

  it("rejects malformed site URLs", () => {
    const cfg = readGscConfig({
      GSC_CLIENT_ID: "id",
      GSC_CLIENT_SECRET: "secret",
      GSC_REFRESH_TOKEN: "refresh",
      GSC_SITE_URL: "example.com",
    });
    expect(cfg.ok).toBe(false);
    if (!cfg.ok) expect(cfg.state).toBe("ACCESS_REQUIRED");
  });

  it("accepts URL-prefix and domain properties", () => {
    const a = readGscConfig({
      GSC_CLIENT_ID: "id",
      GSC_CLIENT_SECRET: "secret",
      GSC_REFRESH_TOKEN: "refresh",
      GSC_SITE_URL: "https://www.example.com/",
    });
    expect(a.ok).toBe(true);
    const b = readGscConfig({
      GSC_CLIENT_ID: "id",
      GSC_CLIENT_SECRET: "secret",
      GSC_REFRESH_TOKEN: "refresh",
      GSC_SITE_URL: "sc-domain:example.com",
    });
    expect(b.ok).toBe(true);
  });
});

describe("GSC query helpers", () => {
  it("encodes site URLs for the path", () => {
    expect(encodeSiteUrl("https://www.example.com/")).toBe(encodeURIComponent("https://www.example.com/"));
  });

  it("builds analytics body with optional filters", () => {
    const body = buildAnalyticsBody({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      dimensions: ["query", "page"],
      pageFilter: "/product/",
      rowLimit: 10,
    });
    expect(body.startDate).toBe("2026-01-01");
    expect(body.dimensions).toEqual(["query", "page"]);
    expect(body.dimensionFilterGroups).toEqual([
      { groupType: "and", filters: [{ dimension: "page", operator: "contains", expression: "/product/" }] },
    ]);
  });

  it("parses numeric analytics rows and skips incomplete ones", () => {
    const rows = parseAnalyticsRows([
      { keys: ["wireless earbuds"], clicks: 12, impressions: 100, ctr: 0.12, position: 8.4 },
      { keys: ["bad"], clicks: Number.NaN, impressions: 1, ctr: 0.1, position: 1 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.keys[0]).toBe("wireless earbuds");
    expect(rows[0]?.position).toBe(8.4);
  });

  it("defaults to a closed 28-day window ending 3 days ago (GSC lag)", () => {
    const range = defaultDateRange(new Date("2026-10-16T12:00:00Z"));
    expect(range.endDate).toBe("2026-10-13");
    expect(range.startDate).toBe("2026-09-16");
  });
});
