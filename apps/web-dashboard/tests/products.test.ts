import { describe, expect, it } from "vitest";
import { csvRowsToInputs, findDuplicateGroups, parseCsv, productsToCsv } from "@/lib/products/csv";
import { filterProducts, paginateProducts, sortProducts } from "@/lib/products/query";
import type { ProductRecord } from "@/lib/products/types";
import { contentHashFor, sanitizeHttpUrl, toProductRecord, validateProductInput } from "@/lib/products/validate";

const base = (over: Partial<ProductRecord> = {}): ProductRecord => ({
  id: over.id ?? "1",
  ownerId: null,
  sku: over.sku ?? "SKU-1",
  title: over.title ?? "Wireless earbuds",
  description: null,
  url: over.url ?? "https://example.com/p/1",
  canonicalUrl: null,
  brand: "Acme",
  category: "Audio",
  marketplace: over.marketplace ?? "amazon",
  country: over.country ?? "IN",
  language: "en",
  currency: "INR",
  price: over.price === undefined ? 1999 : over.price,
  availability: "in_stock",
  imageUrl: null,
  gtin: null,
  mpn: null,
  primaryKeyword: "wireless earbuds",
  secondaryKeywords: ["bluetooth earbuds"],
  tags: [],
  source: "manual",
  contentHash: "abc",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: over.updatedAt ?? "2026-10-10T00:00:00.000Z",
});

describe("product validation", () => {
  it("requires a title and rejects credentialed URLs", () => {
    expect(validateProductInput({ title: "" }).ok).toBe(false);
    expect(sanitizeHttpUrl("javascript:alert(1)").ok).toBe(false);
    expect(sanitizeHttpUrl("https://user:pass@evil.example/x").ok).toBe(false);
    const ok = validateProductInput({ title: "Noise cancelling headphones", marketplace: "flipkart", url: "https://www.flipkart.com/item" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.marketplace).toBe("flipkart");
  });

  it("treats missing price as null, not zero", () => {
    const v = validateProductInput({ title: "Mug", price: "" });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.price).toBeNull();
  });

  it("builds a stable content hash", () => {
    const a = contentHashFor({ sku: "A", title: "Foo", url: null, marketplace: "amazon", country: "IN" });
    const b = contentHashFor({ sku: "A", title: "foo", url: null, marketplace: "amazon", country: "IN" });
    expect(a).toBe(b);
  });
});

describe("csv import/export", () => {
  it("parses quoted CSV and maps header aliases", () => {
    const csv = `name,SKU,platform,country,primary_keyword,price\n"Earbuds, ANC",E1,amazon,IN,wireless earbuds,\n`;
    const { inputs, errors } = csvRowsToInputs(csv);
    expect(errors).toEqual([]);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.title).toBe("Earbuds, ANC");
    expect(inputs[0]?.sku).toBe("E1");
    expect(inputs[0]?.marketplace).toBe("amazon");
    expect(inputs[0]?.price).toBeNull();
  });

  it("rejects CSV without a title column", () => {
    const { errors } = csvRowsToInputs("sku,price\nA,1\n");
    expect(errors[0]?.message).toMatch(/title/i);
  });

  it("round-trips products to CSV without inventing prices", () => {
    const p = toProductRecord({ title: "Desk lamp", price: null, marketplace: "other" });
    const csv = productsToCsv([p]);
    expect(csv).toContain("Desk lamp");
    const rows = parseCsv(csv);
    const priceIdx = rows[0]!.indexOf("price");
    expect(rows[1]![priceIdx]).toBe("");
  });

  it("detects duplicate SKU and URL groups", () => {
    const groups = findDuplicateGroups([
      base({ id: "a", sku: "X", url: "https://example.com/a" }),
      base({ id: "b", sku: "X", url: "https://example.com/b" }),
      base({ id: "c", sku: "Y", url: "https://example.com/a" }),
    ]);
    expect(groups.some((g) => g.key.startsWith("sku:") && g.productIds.length === 2)).toBe(true);
    expect(groups.some((g) => g.key.startsWith("url:") && g.productIds.length === 2)).toBe(true);
  });
});

describe("product query helpers", () => {
  it("filters, sorts and paginates", () => {
    const items = [
      base({ id: "1", title: "Alpha buds", marketplace: "amazon", updatedAt: "2026-10-01T00:00:00.000Z" }),
      base({ id: "2", title: "Beta lamp", marketplace: "flipkart", sku: "L2", url: "https://example.com/2", updatedAt: "2026-10-12T00:00:00.000Z" }),
    ];
    expect(filterProducts(items, { q: "lamp" })).toHaveLength(1);
    expect(filterProducts(items, { marketplace: "amazon" })[0]?.id).toBe("1");
    expect(sortProducts(items, "title_asc")[0]?.title).toBe("Alpha buds");
    expect(paginateProducts(items, 1, 1).items).toHaveLength(1);
    expect(paginateProducts(items, 1, 1).total).toBe(2);
  });
});
