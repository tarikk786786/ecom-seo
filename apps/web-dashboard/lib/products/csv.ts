import { validateProductInput } from "./validate";
import type { ImportResult, ProductInput, ProductRecord, ProductSource } from "./types";

const HEADER_ALIASES: Record<string, keyof ProductInput | "secondary_keywords" | "primary_keyword" | "canonical_url" | "image_url"> = {
  title: "title",
  name: "title",
  product_title: "title",
  sku: "sku",
  id: "sku",
  product_id: "sku",
  description: "description",
  url: "url",
  link: "url",
  product_url: "url",
  canonical_url: "canonical_url",
  canonicalurl: "canonical_url",
  brand: "brand",
  category: "category",
  marketplace: "marketplace",
  platform: "marketplace",
  country: "country",
  language: "language",
  currency: "currency",
  price: "price",
  availability: "availability",
  stock: "availability",
  image_url: "image_url",
  image: "image_url",
  imageurl: "image_url",
  gtin: "gtin",
  mpn: "mpn",
  primary_keyword: "primary_keyword",
  primarykeyword: "primary_keyword",
  keyword: "primary_keyword",
  secondary_keywords: "secondary_keywords",
  secondarykeywords: "secondary_keywords",
  keywords: "secondary_keywords",
  tags: "tags",
};

/** Minimal RFC4180-ish CSV parse (quoted fields, commas, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");
  while (i < s.length) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n" || (c === "\r" && s[i + 1] === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      i += c === "\r" ? 2 : 1;
      continue;
    }
    if (c === "\r") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function csvRowsToInputs(text: string, source: ProductSource = "csv_import"): { inputs: ProductInput[]; errors: ImportResult["errors"] } {
  const table = parseCsv(text);
  if (table.length === 0) return { inputs: [], errors: [{ row: 0, message: "CSV is empty." }] };
  const header = table[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const mapped = header.map((h) => HEADER_ALIASES[h]);
  if (!mapped.includes("title")) {
    return { inputs: [], errors: [{ row: 1, message: "CSV must include a title (or name) column." }] };
  }

  const inputs: ProductInput[] = [];
  const errors: ImportResult["errors"] = [];

  for (let r = 1; r < table.length; r++) {
    const cells = table[r]!;
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < mapped.length; c++) {
      const key = mapped[c];
      if (!key) continue;
      const cell = cells[c]?.trim() ?? "";
      if (key === "secondary_keywords" || key === "tags") {
        obj[key === "secondary_keywords" ? "secondaryKeywords" : "tags"] = cell;
      } else if (key === "primary_keyword") {
        obj.primaryKeyword = cell;
      } else if (key === "canonical_url") {
        obj.canonicalUrl = cell;
      } else if (key === "image_url") {
        obj.imageUrl = cell;
      } else if (key === "price") {
        obj.price = cell;
      } else {
        obj[key] = cell;
      }
    }
    const v = validateProductInput(obj, source);
    if (!v.ok) {
      errors.push({ row: r + 1, message: v.error });
      continue;
    }
    inputs.push(v.value);
  }

  return { inputs, errors };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Prefix cells that Excel might treat as formulas. */
function formulaSafe(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function productsToCsv(products: ProductRecord[]): string {
  const headers = [
    "sku",
    "title",
    "description",
    "url",
    "canonical_url",
    "brand",
    "category",
    "marketplace",
    "country",
    "language",
    "currency",
    "price",
    "availability",
    "image_url",
    "gtin",
    "mpn",
    "primary_keyword",
    "secondary_keywords",
    "tags",
    "source",
    "updated_at",
  ];
  const lines = [headers.join(",")];
  for (const p of products) {
    const cells = [
      p.sku ?? "",
      p.title,
      p.description ?? "",
      p.url ?? "",
      p.canonicalUrl ?? "",
      p.brand ?? "",
      p.category ?? "",
      p.marketplace,
      p.country ?? "",
      p.language ?? "",
      p.currency ?? "",
      p.price == null ? "" : String(p.price),
      p.availability,
      p.imageUrl ?? "",
      p.gtin ?? "",
      p.mpn ?? "",
      p.primaryKeyword ?? "",
      p.secondaryKeywords.join("; "),
      p.tags.join("; "),
      p.source,
      p.updatedAt,
    ].map((c) => csvEscape(formulaSafe(c)));
    lines.push(cells.join(","));
  }
  return lines.join("\n") + "\n";
}

export function findDuplicateGroups(products: ProductRecord[]): ImportResult["duplicateGroups"] {
  const bySku = new Map<string, string[]>();
  const byUrl = new Map<string, string[]>();
  for (const p of products) {
    if (p.sku) {
      const k = `sku:${p.sku.toLowerCase()}|${p.marketplace}|${(p.country ?? "").toLowerCase()}`;
      const list = bySku.get(k) ?? [];
      list.push(p.id);
      bySku.set(k, list);
    }
    const u = (p.canonicalUrl || p.url || "").trim().toLowerCase();
    if (u) {
      const list = byUrl.get(`url:${u}`) ?? [];
      list.push(p.id);
      byUrl.set(`url:${u}`, list);
    }
  }
  const groups: ImportResult["duplicateGroups"] = [];
  for (const [key, productIds] of [...bySku, ...byUrl]) {
    if (productIds.length > 1) groups.push({ key, productIds });
  }
  return groups;
}
