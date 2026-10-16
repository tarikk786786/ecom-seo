import { lookup } from "node:dns/promises";
import { assertPublicHttpUrl, isPrivateOrSpecialIp } from "./ssrf";

export type AuditSeverity = "info" | "warning" | "critical";

export type AuditFinding = {
  id: string;
  severity: AuditSeverity;
  title: string;
  detail: string;
  evidence?: string;
  recommendation: string;
  confidence: "high" | "medium" | "low";
};

export type PageAuditResult = {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  httpStatus: number;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1: string[];
  imageCount: number;
  imagesMissingAlt: number;
  hasViewport: boolean;
  robotsMeta: string | null;
  jsonLdTypes: string[];
  findings: AuditFinding[];
  dataSource: "http_fetch";
  measurementMethod: "html_static_parse";
  note: string;
};

const MAX_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT = "EcomSEO-PageAudit/0.1 (+https://github.com/tarikk786786/ecom-seo)";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function metaContent(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`, "i");
  const m = html.match(re) || html.match(re2);
  return m?.[1] ? decodeEntities(m[1].trim()) : null;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m?.[1] ? decodeEntities(m[1].trim()) : null;
}

export function parseHtmlAudit(html: string, pageUrl: string): Omit<PageAuditResult, "url" | "finalUrl" | "fetchedAt" | "httpStatus" | "contentType" | "dataSource" | "measurementMethod" | "note"> {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]!.replace(/\s+/g, " ").trim()) : null;
  const metaDescription = metaContent(html, "description");
  const robotsMeta = metaContent(html, "robots");
  const viewport = metaContent(html, "viewport");

  let canonical: string | null = null;
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0]!;
    if (/\brel\s*=\s*["'][^"']*\bcanonical\b/i.test(tag)) {
      canonical = attr(tag, "href");
      break;
    }
  }

  const h1: string[] = [];
  for (const m of html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const text = decodeEntities(m[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text) h1.push(text);
  }

  let imageCount = 0;
  let imagesMissingAlt = 0;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    imageCount++;
    const tag = m[0]!;
    const alt = attr(tag, "alt");
    if (alt === null) imagesMissingAlt++;
  }

  const jsonLdTypes: string[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]!) as { "@type"?: string | string[] } | { "@type"?: string | string[] }[];
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const t = item?.["@type"];
        if (typeof t === "string") jsonLdTypes.push(t);
        else if (Array.isArray(t)) jsonLdTypes.push(...t.filter((x): x is string => typeof x === "string"));
      }
    } catch {
      // Malformed JSON-LD is recorded as a finding below via absence / parse skip.
    }
  }

  const findings: AuditFinding[] = [];
  const push = (f: AuditFinding) => findings.push(f);

  if (!title) {
    push({
      id: "missing_title",
      severity: "critical",
      title: "Missing document title",
      detail: "No <title> element was found in the HTML.",
      recommendation: "Add a unique, descriptive product title under ~60 characters where possible.",
      confidence: "high",
    });
  } else if (title.length < 15) {
    push({
      id: "short_title",
      severity: "warning",
      title: "Very short title",
      detail: `Title is ${title.length} characters.`,
      evidence: title,
      recommendation: "Expand the title with product type, brand, or differentiating attributes.",
      confidence: "medium",
    });
  } else if (title.length > 70) {
    push({
      id: "long_title",
      severity: "info",
      title: "Long title",
      detail: `Title is ${title.length} characters and may truncate in SERPs.`,
      evidence: title,
      recommendation: "Prioritize the most important keywords near the start.",
      confidence: "medium",
    });
  }

  if (!metaDescription) {
    push({
      id: "missing_meta_description",
      severity: "warning",
      title: "Missing meta description",
      detail: "No meta name=description was found.",
      recommendation: "Add a compelling 120–160 character description that matches the listing.",
      confidence: "high",
    });
  } else if (metaDescription.length < 50) {
    push({
      id: "short_meta_description",
      severity: "info",
      title: "Short meta description",
      detail: `Meta description is ${metaDescription.length} characters.`,
      evidence: metaDescription,
      recommendation: "Expand with benefits and a clear call to action without keyword stuffing.",
      confidence: "medium",
    });
  }

  if (!h1.length) {
    push({
      id: "missing_h1",
      severity: "warning",
      title: "No H1 heading",
      detail: "The page has no <h1> element in the fetched HTML.",
      recommendation: "Include one clear H1 that matches the product name.",
      confidence: "high",
    });
  } else if (h1.length > 1) {
    push({
      id: "multiple_h1",
      severity: "info",
      title: "Multiple H1 headings",
      detail: `Found ${h1.length} H1 elements.`,
      evidence: h1.slice(0, 3).join(" | "),
      recommendation: "Prefer a single primary H1 for product pages when the template allows it.",
      confidence: "medium",
    });
  }

  if (!canonical) {
    push({
      id: "missing_canonical",
      severity: "info",
      title: "No canonical link",
      detail: "No rel=canonical was detected.",
      recommendation: "Add a self-referencing canonical to reduce duplicate URL risk.",
      confidence: "medium",
    });
  }

  if (robotsMeta && /noindex/i.test(robotsMeta)) {
    push({
      id: "robots_noindex",
      severity: "critical",
      title: "Page is noindex",
      detail: `robots meta: ${robotsMeta}`,
      evidence: robotsMeta,
      recommendation: "Remove noindex if this product page should appear in search results.",
      confidence: "high",
    });
  }

  if (!viewport) {
    push({
      id: "missing_viewport",
      severity: "warning",
      title: "Missing viewport meta",
      detail: "No viewport meta tag was found (mobile usability signal).",
      recommendation: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
      confidence: "high",
    });
  }

  if (imagesMissingAlt > 0) {
    push({
      id: "images_missing_alt",
      severity: "warning",
      title: "Images missing alt text",
      detail: `${imagesMissingAlt} of ${imageCount} <img> tags have no alt attribute.`,
      recommendation: "Add descriptive alt text for product images; decorative images may use empty alt=\"\".",
      confidence: "high",
    });
  }

  const productSchema = jsonLdTypes.some((t) => /product/i.test(t));
  if (!productSchema) {
    push({
      id: "missing_product_schema",
      severity: "info",
      title: "No Product structured data detected",
      detail: jsonLdTypes.length ? `JSON-LD types found: ${jsonLdTypes.join(", ")}` : "No application/ld+json blocks parsed successfully.",
      recommendation: "Add valid Product schema (name, image, offers) when accurate.",
      confidence: "medium",
    });
  }

  void pageUrl;
  return {
    title,
    metaDescription,
    canonical,
    h1,
    imageCount,
    imagesMissingAlt,
    hasViewport: Boolean(viewport),
    robotsMeta,
    jsonLdTypes,
    findings,
  };
}

async function assertResolvedPublic(hostname: string): Promise<void> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  for (const a of addresses) {
    if (isPrivateOrSpecialIp(a.address)) {
      throw new Error(`Resolved address ${a.address} is not allowed for remote audits.`);
    }
  }
}

export async function auditPageUrl(rawUrl: string, fetchImpl: typeof fetch = fetch): Promise<PageAuditResult> {
  const checked = assertPublicHttpUrl(rawUrl);
  if (!checked.ok) throw new Error(checked.error);
  await assertResolvedPublic(checked.url.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(checked.url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
    });

    const finalUrl = res.url || checked.url.toString();
    const finalChecked = assertPublicHttpUrl(finalUrl);
    if (!finalChecked.ok) throw new Error(`Redirect target blocked: ${finalChecked.error}`);
    await assertResolvedPublic(finalChecked.url.hostname);

    const contentType = res.headers.get("content-type");
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error(`Unsupported content-type for HTML audit: ${contentType}`);
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("Response exceeds 1.5 MB size limit.");
    const html = new TextDecoder("utf-8").decode(buf);
    const parsed = parseHtmlAudit(html, finalUrl);

    return {
      url: checked.url.toString(),
      finalUrl,
      fetchedAt: new Date().toISOString(),
      httpStatus: res.status,
      contentType,
      ...parsed,
      dataSource: "http_fetch",
      measurementMethod: "html_static_parse",
      note: "Static HTML parse of the fetched document. Client-rendered content, page speed lab metrics, and personalized SERP data are not included.",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error(`Timed out after ${FETCH_TIMEOUT_MS} ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
