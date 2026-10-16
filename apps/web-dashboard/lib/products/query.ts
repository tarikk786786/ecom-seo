import type { ProductListQuery, ProductRecord } from "./types";
import { skuKey, urlKey } from "./validate";

export function filterProducts(products: ProductRecord[], query: ProductListQuery): ProductRecord[] {
  const q = query.q?.trim().toLowerCase();
  let list = products;
  if (q) {
    list = list.filter((p) => {
      const hay = [p.title, p.sku, p.brand, p.category, p.primaryKeyword, p.description, ...(p.secondaryKeywords ?? []), ...(p.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  if (query.marketplace) list = list.filter((p) => p.marketplace === query.marketplace);
  if (query.country) list = list.filter((p) => (p.country ?? "").toUpperCase() === query.country!.toUpperCase());
  if (query.brand) list = list.filter((p) => (p.brand ?? "").toLowerCase() === query.brand!.toLowerCase());
  if (query.category) list = list.filter((p) => (p.category ?? "").toLowerCase() === query.category!.toLowerCase());
  return list;
}

export function sortProducts(products: ProductRecord[], sort: ProductListQuery["sort"] = "updated_desc"): ProductRecord[] {
  const list = [...products];
  switch (sort) {
    case "updated_asc":
      return list.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    case "title_asc":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "title_desc":
      return list.sort((a, b) => b.title.localeCompare(a.title));
    case "updated_desc":
    default:
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export function paginateProducts<T>(items: T[], page = 1, pageSize = 25): { items: T[]; total: number; page: number; pageSize: number } {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 25));
  const start = (safePage - 1) * safeSize;
  return { items: items.slice(start, start + safeSize), total: items.length, page: safePage, pageSize: safeSize };
}

export function findBySkuOrUrl(products: ProductRecord[], candidate: ProductRecord): ProductRecord | undefined {
  const sk = skuKey(candidate);
  if (sk) {
    const hit = products.find((p) => skuKey(p) === sk);
    if (hit) return hit;
  }
  const uk = urlKey(candidate);
  if (uk) return products.find((p) => urlKey(p) === uk);
  return undefined;
}

export const LOCAL_PERSISTENCE_NOTE =
  "Products are stored in the local server file data/products-store.json. Apply database/migrations/001_ranking_foundation.sql and set PRODUCTS_PERSISTENCE=supabase when ready for Postgres.";
