export const MARKETPLACES = ["amazon", "flipkart", "shopify", "ebay", "etsy", "google", "walmart", "other"] as const;
export type Marketplace = (typeof MARKETPLACES)[number];

export const AVAILABILITIES = ["in_stock", "out_of_stock", "preorder", "unknown"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const PRODUCT_SOURCES = ["csv_import", "manual", "api"] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export const KEYWORD_ROLES = ["primary", "secondary", "long_tail"] as const;
export type KeywordRole = (typeof KEYWORD_ROLES)[number];

export type ProductRecord = {
  id: string;
  ownerId: string | null;
  sku: string | null;
  title: string;
  description: string | null;
  url: string | null;
  canonicalUrl: string | null;
  brand: string | null;
  category: string | null;
  marketplace: Marketplace;
  country: string | null;
  language: string | null;
  currency: string | null;
  /** Unknown price is null — never invent or coerce missing to 0. */
  price: number | null;
  availability: Availability;
  imageUrl: string | null;
  gtin: string | null;
  mpn: string | null;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  tags: string[];
  source: ProductSource;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductInput = {
  sku?: string | null;
  title: string;
  description?: string | null;
  url?: string | null;
  canonicalUrl?: string | null;
  brand?: string | null;
  category?: string | null;
  marketplace?: string | null;
  country?: string | null;
  language?: string | null;
  currency?: string | null;
  price?: number | null;
  availability?: string | null;
  imageUrl?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  primaryKeyword?: string | null;
  secondaryKeywords?: string[] | null;
  tags?: string[] | null;
  source?: ProductSource;
};

export type ProductListQuery = {
  q?: string;
  marketplace?: string;
  country?: string;
  brand?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  sort?: "updated_desc" | "updated_asc" | "title_asc" | "title_desc";
};

export type ProductListResult = {
  items: ProductRecord[];
  total: number;
  page: number;
  pageSize: number;
  persistence: "local" | "supabase";
  persistenceNote: string;
};

export type ImportRowError = { row: number; message: string };
export type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
  duplicateGroups: { key: string; productIds: string[] }[];
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };
