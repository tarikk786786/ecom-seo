import "server-only";
import { csvRowsToInputs, findDuplicateGroups } from "./csv";
import { LOCAL_PERSISTENCE_NOTE, filterProducts, findBySkuOrUrl, paginateProducts, sortProducts } from "./query";
import { readLocalStore, writeLocalStore } from "./store";
import type { ImportResult, ProductListQuery, ProductListResult, ProductRecord } from "./types";
import { toProductRecord, validateProductInput } from "./validate";

function persistenceMode(): "local" | "supabase" {
  return process.env.PRODUCTS_PERSISTENCE === "supabase" ? "supabase" : "local";
}

async function allProducts(): Promise<ProductRecord[]> {
  if (persistenceMode() === "supabase") {
    // Supabase path requires applied migration + signed-in owner RLS.
    // Until wired, fall back to local and surface the note in list results.
    const store = await readLocalStore();
    return store.products;
  }
  const store = await readLocalStore();
  return store.products;
}

async function saveAll(products: ProductRecord[]): Promise<void> {
  await writeLocalStore(products);
}

export async function listProducts(query: ProductListQuery = {}): Promise<ProductListResult> {
  const filtered = sortProducts(filterProducts(await allProducts(), query), query.sort);
  const page = paginateProducts(filtered, query.page, query.pageSize);
  return {
    ...page,
    persistence: "local",
    persistenceNote:
      persistenceMode() === "supabase"
        ? "PRODUCTS_PERSISTENCE=supabase is set, but the Supabase product repository is not live yet; using local store until tables are confirmed."
        : LOCAL_PERSISTENCE_NOTE,
  };
}

export async function getProduct(id: string): Promise<ProductRecord | null> {
  return (await allProducts()).find((p) => p.id === id) ?? null;
}

export async function createProduct(raw: unknown): Promise<{ ok: true; product: ProductRecord } | { ok: false; error: string }> {
  const v = validateProductInput(raw, "manual");
  if (!v.ok) return v;
  const products = await allProducts();
  const draft = toProductRecord(v.value);
  const dup = findBySkuOrUrl(products, draft);
  if (dup) return { ok: false, error: `A product with the same SKU/marketplace/country or URL already exists (${dup.id}).` };
  products.push(draft);
  await saveAll(products);
  return { ok: true, product: draft };
}

export async function updateProduct(id: string, raw: unknown): Promise<{ ok: true; product: ProductRecord } | { ok: false; error: string; status?: number }> {
  const products = await allProducts();
  const existing = products.find((p) => p.id === id);
  if (!existing) return { ok: false, error: "Product not found.", status: 404 };
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body must be an object." };
  const patch = raw as Record<string, unknown>;
  const merged = {
    sku: patch.sku !== undefined ? patch.sku : existing.sku,
    title: patch.title !== undefined ? patch.title : existing.title,
    description: patch.description !== undefined ? patch.description : existing.description,
    url: patch.url !== undefined ? patch.url : existing.url,
    canonicalUrl: patch.canonicalUrl !== undefined ? patch.canonicalUrl : existing.canonicalUrl,
    brand: patch.brand !== undefined ? patch.brand : existing.brand,
    category: patch.category !== undefined ? patch.category : existing.category,
    marketplace: patch.marketplace !== undefined ? patch.marketplace : existing.marketplace,
    country: patch.country !== undefined ? patch.country : existing.country,
    language: patch.language !== undefined ? patch.language : existing.language,
    currency: patch.currency !== undefined ? patch.currency : existing.currency,
    price: patch.price !== undefined ? patch.price : existing.price,
    availability: patch.availability !== undefined ? patch.availability : existing.availability,
    imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : existing.imageUrl,
    gtin: patch.gtin !== undefined ? patch.gtin : existing.gtin,
    mpn: patch.mpn !== undefined ? patch.mpn : existing.mpn,
    primaryKeyword: patch.primaryKeyword !== undefined ? patch.primaryKeyword : existing.primaryKeyword,
    secondaryKeywords: patch.secondaryKeywords !== undefined ? patch.secondaryKeywords : existing.secondaryKeywords,
    tags: patch.tags !== undefined ? patch.tags : existing.tags,
  };
  const v = validateProductInput(merged, existing.source);
  if (!v.ok) return v;
  const next = toProductRecord({ ...v.value, source: existing.source }, existing);
  const dup = findBySkuOrUrl(
    products.filter((p) => p.id !== id),
    next,
  );
  if (dup) return { ok: false, error: `Update would collide with existing product ${dup.id}.` };
  const idx = products.findIndex((p) => p.id === id);
  products[idx] = next;
  await saveAll(products);
  return { ok: true, product: next };
}

export async function deleteProduct(id: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const products = await allProducts();
  const next = products.filter((p) => p.id !== id);
  if (next.length === products.length) return { ok: false, error: "Product not found.", status: 404 };
  await saveAll(next);
  return { ok: true };
}

export async function importProductsCsv(text: string): Promise<ImportResult> {
  const { inputs, errors } = csvRowsToInputs(text, "csv_import");
  const products = await allProducts();
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const input of inputs) {
    const draft = toProductRecord(input);
    const existing = findBySkuOrUrl(products, draft);
    if (existing) {
      const next = toProductRecord({ ...input, source: "csv_import" }, existing);
      const idx = products.findIndex((p) => p.id === existing.id);
      products[idx] = next;
      updated++;
    } else {
      products.push(draft);
      imported++;
    }
  }

  if (imported + updated > 0) await saveAll(products);
  else skipped = errors.length;

  return {
    imported,
    updated,
    skipped: skipped || Math.max(0, errors.length),
    errors,
    duplicateGroups: findDuplicateGroups(products),
  };
}

export async function exportAllProducts(): Promise<ProductRecord[]> {
  return allProducts();
}

/** Filtered export without the UI page-size cap. */
export async function listProductsForExport(query: Omit<ProductListQuery, "page" | "pageSize"> = {}): Promise<ProductListResult> {
  const filtered = sortProducts(filterProducts(await allProducts(), query), query.sort);
  return {
    items: filtered,
    total: filtered.length,
    page: 1,
    pageSize: filtered.length || 1,
    persistence: "local",
    persistenceNote: LOCAL_PERSISTENCE_NOTE,
  };
}
