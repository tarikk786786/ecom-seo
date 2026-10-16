-- Product Ranking Intelligence — foundation schema
-- Apply in Supabase SQL editor (or psql) with project owner authorization.
-- Rollback: DROP TABLE IF EXISTS ranking_observations, product_keywords, keywords, products CASCADE;
-- This migration is not auto-applied by the app.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  sku text,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  description text,
  url text,
  canonical_url text,
  brand text,
  category text,
  marketplace text NOT NULL DEFAULT 'other',
  country text,
  language text,
  currency text,
  price numeric(18, 4),
  availability text NOT NULL DEFAULT 'unknown'
    CHECK (availability IN ('in_stock', 'out_of_stock', 'preorder', 'unknown')),
  image_url text,
  gtin text,
  mpn text,
  primary_keyword text,
  secondary_keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('csv_import', 'manual', 'api')),
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS products_owner_sku_marketplace_country_uidx
  ON products (owner_id, lower(sku), marketplace, coalesce(country, ''))
  WHERE sku IS NOT NULL AND sku <> '';

CREATE INDEX IF NOT EXISTS products_owner_updated_idx ON products (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS products_owner_marketplace_idx ON products (owner_id, marketplace);
CREATE INDEX IF NOT EXISTS products_content_hash_idx ON products (owner_id, content_hash);

CREATE TABLE IF NOT EXISTS keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  phrase text NOT NULL CHECK (char_length(phrase) BETWEEN 1 AND 300),
  normalized text NOT NULL,
  country text,
  language text,
  intent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS keywords_owner_normalized_locale_uidx
  ON keywords (owner_id, normalized, coalesce(country, ''), coalesce(language, ''));

CREATE TABLE IF NOT EXISTS product_keywords (
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  keyword_id uuid NOT NULL REFERENCES keywords (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'secondary'
    CHECK (role IN ('primary', 'secondary', 'long_tail')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, keyword_id, role)
);

CREATE TABLE IF NOT EXISTS ranking_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  product_id uuid REFERENCES products (id) ON DELETE SET NULL,
  keyword_id uuid REFERENCES keywords (id) ON DELETE SET NULL,
  platform text NOT NULL,
  search_engine text,
  country text,
  language text,
  device text,
  locale_context text,
  position numeric(10, 3),
  page_url text,
  observed_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  data_source text NOT NULL,
  measurement_method text NOT NULL,
  confidence text,
  error_status text,
  data_freshness text,
  CHECK (position IS NULL OR position >= 0)
);

CREATE INDEX IF NOT EXISTS ranking_obs_owner_observed_idx
  ON ranking_observations (owner_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS ranking_obs_product_keyword_idx
  ON ranking_observations (product_id, keyword_id, observed_at DESC);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_owner_all ON products;
CREATE POLICY products_owner_all ON products
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS keywords_owner_all ON keywords;
CREATE POLICY keywords_owner_all ON keywords
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS product_keywords_owner_all ON product_keywords;
CREATE POLICY product_keywords_owner_all ON product_keywords
  FOR ALL USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS ranking_observations_owner_all ON ranking_observations;
CREATE POLICY ranking_observations_owner_all ON ranking_observations
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
