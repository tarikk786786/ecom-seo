# Checklist classification — Phase 0 / Phase 1

Legend: **Required** / **Optional** / **Not Applicable** / **Blocked** — with evidence.

## Product and requirements

| Item | Status | Evidence |
|---|---|---|
| Problem / goals / success measures | Required | docs/PRD_RANKING_INTELLIGENCE.md |
| Target users / roles | Required | same |
| PRD / MVP priorities | Required | P0 Phase 1 documented |
| Stakeholder approvals process | Optional | Solo repo; N/A formal board |

## Architecture

| Item | Status | Evidence |
|---|---|---|
| Architecture / module boundaries | Required | ARCHITECTURE.md + existing keyword modules |
| Framework / package manager | Required | Next 16, npm workspaces |
| Decision: local store vs Supabase first | Required | Local default so Phase 1 runs without migration apply |
| Microservices | Not Applicable | Modular monolith appropriate |

## Frontend

| Item | Status | Evidence |
|---|---|---|
| Products route / nav | Required | `/products`, nav link |
| Loading / empty / error | Required | ProductsWorkspace |
| Dark/light themes | Optional | Existing dark UI preserved |
| Localization | Optional | Country/language fields only |

## Backend / data

| Item | Status | Evidence |
|---|---|---|
| Product CRUD APIs | Required | `/api/products*` |
| CSV import/export | Required | import + export routes; sample CSV |
| SQL migrations | Required | `database/migrations/001_ranking_foundation.sql` (manual apply) |
| Supabase product repository live | Blocked | Needs owner to apply migration; local store used |
| Ranking collectors | Not Applicable | Phase 3 |

## Security

| Item | Status | Evidence |
|---|---|---|
| URL scheme validation | Required | http(s) only; no credentials in URL |
| Secrets out of Git | Required | secrets:scan passed |
| Multi-tenant RLS | Optional/Blocked | Policies in SQL; not active until migration + auth wiring |
| Rate limits on product APIs | Required | In-memory limiter |

## Testing / release

| Item | Status | Evidence |
|---|---|---|
| Unit tests products | Required | 124 tests total (products suite included) |
| typecheck / lint / build | Required | All passed 2026-10-16 |
| E2E Playwright | Optional | Not started |
| CI | Optional | Not started |
| Production deploy | Blocked | No hosting authorization this cycle |

## Project-type add-ons (C1 SaaS + e-commerce intelligence)

| Item | Status | Notes |
|---|---|---|
| Multi-tenant SaaS billing | Not Applicable | Phase later |
| Marketplace connectors live | Blocked | Credentials |
| Search Console | Blocked | Phase 2 + OAuth |
| Paid SEO APIs in core path | Not Applicable | Explicitly avoided |
