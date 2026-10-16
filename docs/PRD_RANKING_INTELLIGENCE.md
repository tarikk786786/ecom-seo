# PRD — Product Ranking Intelligence System

**Status:** Active overlay on existing Trend Intelligence / keyword research app  
**Parent:** `docs/MASTER_PRD.md` (retained)  
**Repository assessment:** `docs/REPOSITORY_ASSESSMENT.md`

## Problem

E-commerce sellers and SEO operators lack a single, honest system to manage product listings, map keywords, track measurable visibility signals, and prioritise listing improvements across search engines and marketplaces—without fabricated rankings or paid-API lock-in for core workflows.

## Goals

- Improve product visibility and listing quality through evidence-based recommendations.
- Ingest first-party and authorized data (CSV, Search Console when connected, store APIs when authorized).
- Track ranking *observations* with source, method, timestamp, and confidence—never invent positions.
- Keep the existing keyword research workspace fully functional.

## Non-goals

- Guaranteed first-page or #1 rankings.
- Unauthorized scraping, CAPTCHA bypass, or competitors’ private analytics.
- Mandatory paid SEO APIs for MVP core paths.
- Rewriting the existing keyword research stack.

## Target users

| Role | Needs |
|---|---|
| Solo seller / brand SEO | CSV product import, keyword mapping, listing gaps |
| Agency operator | Multi-marketplace portfolio, exports, clear provenance |
| Developer / self-hoster | Env-based config, migrations, no secrets in Git |

## MVP priorities

### P0 (Phase 1 — this release)

- Normalized product and keyword entities + versioned SQL migration.
- CSV import / export with validation and deduplication.
- Product list UI: search, filter, pagination, create/update/delete.
- Product–keyword mapping (primary + secondary).
- Honest empty/setup states; no fabricated metrics.

### P1 (later phases)

- Google Search Console performance import.
- Product-page technical audits (Lighthouse / schema where compatible).
- Rank observation storage + history charts from authorized sources.
- Shopify / Amazon / Flipkart connectors when credentials exist.

### P2

- Competitor page analysis (permitted public data only).
- Opportunity score engine.
- Scheduled jobs, email/webhook alerts, CI, production deploy hardening.

## Acceptance criteria (Phase 1)

1. Existing keyword research routes and providers still build and run.
2. User can import a CSV of products and see them listed with provenance `csv_import`.
3. User can search/filter/paginate products and export CSV/JSON.
4. Duplicate SKU+marketplace+country or identical URL groups are detected.
5. Migration SQL is present and documented; local store works without applied remote schema.
6. Tests cover CSV parse, validation, dedupe, and repository CRUD.
7. Unavailable ranking/volume fields display as “Not provided”, never as zeros pretending to be data.

## Success metrics (measurable later)

- % of portfolio products with ≥1 mapped keyword.
- Count of imports succeeding vs validation failures.
- (Post Phase 3) Observations with non-null position and documented source.

## Out of scope for Phase 1

Search Console OAuth, live rank scraping, opportunity scoring UI, Chrome extension, billing.
