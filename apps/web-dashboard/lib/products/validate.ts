import { createHash, randomUUID } from "node:crypto";
import {
  AVAILABILITIES,
  MARKETPLACES,
  type Availability,
  type Marketplace,
  type ProductInput,
  type ProductRecord,
  type ProductSource,
  type ValidationResult,
} from "./types";

const MAX_TITLE = 500;
const MAX_TEXT = 10_000;
const MAX_URL = 2_048;
const MAX_KEYWORDS = 50;

export function normalizePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeOptional(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t ? t : null;
}

function isMarketplace(v: string): v is Marketplace {
  return (MARKETPLACES as readonly string[]).includes(v);
}

function isAvailability(v: string): v is Availability {
  return (AVAILABILITIES as readonly string[]).includes(v);
}

/** Allow http(s) only; reject credentials, javascript:, and data: URLs. */
export function sanitizeHttpUrl(raw: string | null | undefined): ValidationResult<string | null> {
  const v = normalizeOptional(raw);
  if (!v) return { ok: true, value: null };
  if (v.length > MAX_URL) return { ok: false, error: "URL exceeds maximum length." };
  let parsed: URL;
  try {
    parsed = new URL(v);
  } catch {
    return { ok: false, error: "URL is not valid." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "URL must use http or https." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "URL must not include credentials." };
  }
  return { ok: true, value: parsed.toString() };
}

export function parsePrice(raw: unknown): ValidationResult<number | null> {
  if (raw == null || raw === "") return { ok: true, value: null };
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return { ok: false, error: "Price must be a non-negative number, or empty for unknown." };
    return { ok: true, value: raw };
  }
  if (typeof raw === "string") {
    const cleaned = raw.trim().replace(/,/g, "");
    if (!cleaned) return { ok: true, value: null };
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Price must be a non-negative number, or empty for unknown." };
    return { ok: true, value: n };
  }
  return { ok: false, error: "Price must be a number or empty." };
}

function parseStringList(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === "string" ? x.trim() : String(x).trim()))
      .filter(Boolean)
      .slice(0, MAX_KEYWORDS);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[|;,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_KEYWORDS);
  }
  return [];
}

export function contentHashFor(input: {
  sku: string | null;
  title: string;
  url: string | null;
  marketplace: string;
  country: string | null;
}): string {
  const key = [input.sku ?? "", normalizePhrase(input.title), input.url ?? "", input.marketplace, input.country ?? ""].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export function validateProductInput(raw: unknown, source: ProductSource = "manual"): ValidationResult<ProductInput> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Product must be an object." };
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > MAX_TITLE) return { ok: false, error: `Title must be ≤ ${MAX_TITLE} characters.` };

  const marketplaceRaw = normalizeOptional(typeof o.marketplace === "string" ? o.marketplace : null)?.toLowerCase() ?? "other";
  const marketplace = isMarketplace(marketplaceRaw) ? marketplaceRaw : "other";

  const availabilityRaw = normalizeOptional(typeof o.availability === "string" ? o.availability : null)?.toLowerCase() ?? "unknown";
  const availability = isAvailability(availabilityRaw) ? availabilityRaw : "unknown";

  const url = sanitizeHttpUrl(typeof o.url === "string" ? o.url : typeof o.Url === "string" ? o.Url : null);
  if (!url.ok) return url;
  const canonicalUrl = sanitizeHttpUrl(typeof o.canonicalUrl === "string" ? o.canonicalUrl : typeof o.canonical_url === "string" ? o.canonical_url : null);
  if (!canonicalUrl.ok) return canonicalUrl;
  const imageUrl = sanitizeHttpUrl(typeof o.imageUrl === "string" ? o.imageUrl : typeof o.image_url === "string" ? o.image_url : null);
  if (!imageUrl.ok) return imageUrl;

  const price = parsePrice(o.price);
  if (!price.ok) return price;

  const description = normalizeOptional(typeof o.description === "string" ? o.description : null);
  if (description && description.length > MAX_TEXT) return { ok: false, error: "Description is too long." };

  return {
    ok: true,
    value: {
      sku: normalizeOptional(typeof o.sku === "string" ? o.sku : typeof o.SKU === "string" ? o.SKU : null),
      title,
      description,
      url: url.value,
      canonicalUrl: canonicalUrl.value,
      brand: normalizeOptional(typeof o.brand === "string" ? o.brand : null),
      category: normalizeOptional(typeof o.category === "string" ? o.category : null),
      marketplace,
      country: normalizeOptional(typeof o.country === "string" ? o.country : null)?.toUpperCase() ?? null,
      language: normalizeOptional(typeof o.language === "string" ? o.language : null)?.toLowerCase() ?? null,
      currency: normalizeOptional(typeof o.currency === "string" ? o.currency : null)?.toUpperCase() ?? null,
      price: price.value,
      availability,
      imageUrl: imageUrl.value,
      gtin: normalizeOptional(typeof o.gtin === "string" ? o.gtin : null),
      mpn: normalizeOptional(typeof o.mpn === "string" ? o.mpn : null),
      primaryKeyword: normalizeOptional(typeof o.primaryKeyword === "string" ? o.primaryKeyword : typeof o.primary_keyword === "string" ? o.primary_keyword : null),
      secondaryKeywords: parseStringList(o.secondaryKeywords ?? o.secondary_keywords),
      tags: parseStringList(o.tags),
      source,
    },
  };
}

export function toProductRecord(input: ProductInput, existing?: ProductRecord | null, ownerId: string | null = null): ProductRecord {
  const now = new Date().toISOString();
  const marketplace = (input.marketplace && isMarketplace(input.marketplace) ? input.marketplace : "other") as Marketplace;
  const availability = (input.availability && isAvailability(input.availability) ? input.availability : "unknown") as Availability;
  const sku = input.sku ?? null;
  const title = input.title;
  const url = input.url ?? null;
  const country = input.country ?? null;
  return {
    id: existing?.id ?? randomUUID(),
    ownerId: existing?.ownerId ?? ownerId,
    sku,
    title,
    description: input.description ?? null,
    url,
    canonicalUrl: input.canonicalUrl ?? null,
    brand: input.brand ?? null,
    category: input.category ?? null,
    marketplace,
    country,
    language: input.language ?? null,
    currency: input.currency ?? null,
    price: input.price ?? null,
    availability,
    imageUrl: input.imageUrl ?? null,
    gtin: input.gtin ?? null,
    mpn: input.mpn ?? null,
    primaryKeyword: input.primaryKeyword ?? null,
    secondaryKeywords: input.secondaryKeywords ?? [],
    tags: input.tags ?? [],
    source: input.source ?? existing?.source ?? "manual",
    contentHash: contentHashFor({ sku, title, url, marketplace, country }),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function skuKey(p: Pick<ProductRecord, "sku" | "marketplace" | "country">): string | null {
  if (!p.sku) return null;
  return `${p.sku.toLowerCase()}|${p.marketplace}|${(p.country ?? "").toLowerCase()}`;
}

export function urlKey(p: Pick<ProductRecord, "url" | "canonicalUrl">): string | null {
  const u = (p.canonicalUrl || p.url || "").trim().toLowerCase();
  return u || null;
}
