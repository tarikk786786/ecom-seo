import { describe, expect, it } from "vitest";
import { parseHtmlAudit } from "@/lib/audits/page-audit";
import { assertPublicHttpUrl, isPrivateOrSpecialIp } from "@/lib/audits/ssrf";

describe("SSRF guards", () => {
  it("allows public https URLs", () => {
    const r = assertPublicHttpUrl("https://www.example.com/product/1");
    expect(r.ok).toBe(true);
  });

  it("blocks credentials, non-http schemes, localhost and private IPs", () => {
    expect(assertPublicHttpUrl("javascript:alert(1)").ok).toBe(false);
    expect(assertPublicHttpUrl("https://user:pass@example.com/").ok).toBe(false);
    expect(assertPublicHttpUrl("http://localhost/admin").ok).toBe(false);
    expect(assertPublicHttpUrl("http://127.0.0.1/").ok).toBe(false);
    expect(assertPublicHttpUrl("http://192.168.1.10/").ok).toBe(false);
    expect(assertPublicHttpUrl("http://169.254.169.254/latest/meta-data/").ok).toBe(false);
    expect(isPrivateOrSpecialIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrSpecialIp("8.8.8.8")).toBe(false);
  });
});

describe("HTML page audit parser", () => {
  it("extracts SEO fields and emits evidence-based findings", () => {
    const html = `<!doctype html><html><head>
      <title>Wireless ANC Earbuds — Acme</title>
      <meta name="description" content="Short">
      <meta name="robots" content="index,follow">
      <link rel="canonical" href="https://www.example.com/p/1">
    </head><body>
      <h1>Wireless ANC Earbuds</h1>
      <img src="/a.jpg"><img src="/b.jpg" alt="Side view">
      <script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
    </body></html>`;
    const parsed = parseHtmlAudit(html, "https://www.example.com/p/1");
    expect(parsed.title).toMatch(/Wireless ANC/);
    expect(parsed.canonical).toBe("https://www.example.com/p/1");
    expect(parsed.h1).toEqual(["Wireless ANC Earbuds"]);
    expect(parsed.imagesMissingAlt).toBe(1);
    expect(parsed.findings.some((f) => f.id === "missing_viewport")).toBe(true);
    expect(parsed.findings.some((f) => f.id === "images_missing_alt")).toBe(true);
    expect(parsed.findings.some((f) => f.id === "missing_product_schema")).toBe(true);
    expect(parsed.findings.some((f) => f.id === "short_meta_description")).toBe(true);
  });

  it("flags noindex as critical", () => {
    const html = `<html><head><title>Hidden product listing page</title><meta name="robots" content="noindex"></head><body><h1>Hidden</h1></body></html>`;
    const parsed = parseHtmlAudit(html, "https://www.example.com/hidden");
    expect(parsed.findings.some((f) => f.id === "robots_noindex" && f.severity === "critical")).toBe(true);
  });
});
