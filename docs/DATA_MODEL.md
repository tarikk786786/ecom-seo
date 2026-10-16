# Data model — products & keywords

## Persistence backends

| Backend | When used | Notes |
|---|---|---|
| Local JSON store (`data/products-store.json`) | Default Phase 1 | Server-side only; gitignored; labelled in UI |
| PostgreSQL / Supabase | After applying `database/migrations/001_ranking_foundation.sql` | RLS by `owner_id`; set `PRODUCTS_PERSISTENCE=supabase` |

## Entities

### `products`

| Column | Type | Notes |
|---|---|---|
| id | uuid / text | Stable ID |
| owner_id | uuid nullable | Supabase auth user; null in local single-tenant store |
| sku | text | Optional; unique with marketplace+country per owner |
| title | text | Required |
| description | text | |
| url | text | Listing URL |
| canonical_url | text | |
| brand, category | text | |
| marketplace | text | e.g. amazon, flipkart, shopify, google, other |
| country, language, currency | text | ISO-ish codes when known |
| price | numeric nullable | Unknown = null (never invent) |
| availability | text | in_stock / out_of_stock / preorder / unknown |
| image_url, gtin, mpn | text | |
| primary_keyword | text | |
| secondary_keywords | text[] / json | |
| tags | text[] / json | |
| source | text | csv_import / manual / api |
| content_hash | text | Dedup helper |
| created_at, updated_at | timestamptz | |

### `keywords`

| Column | Type | Notes |
|---|---|---|
| id | uuid / text | |
| owner_id | uuid nullable | |
| phrase | text | Raw |
| normalized | text | Lowercased collapsed whitespace |
| locale / country / language | text | |
| intent | text nullable | Rule-based when classified |
| created_at | timestamptz | |

### `product_keywords`

| Column | Type | Notes |
|---|---|---|
| product_id | fk | |
| keyword_id | fk | |
| role | text | primary / secondary / long_tail |
| created_at | timestamptz | |

### `ranking_observations` (schema only in Phase 1)

Ready for Phase 3 collectors. No fabricated rows in production paths.

## Retention

Local store: until file deleted. Supabase: owner deletion cascade; no automatic purge yet (document before enabling scheduled delete).
