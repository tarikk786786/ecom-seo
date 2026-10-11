# Architecture

## Principles
- Modular, replaceable components and provider adapters.
- Server-side truth for permissions, quotas, credentials and paid entitlements.
- Source provenance and data quality are first-class data contracts.
- Background ingestion runs on durable backend workers, not on assumptions about a persistent Chrome extension service worker.
- Partial provider failure must not fabricate success or erase successful providers' results.
- Deployment-specific details remain configuration, not hardcoded app assumptions.
- Every meaningful change is tested, previewed when possible, documented and pushed to the repository.

## Planned boundaries
- `apps/chrome-extension`: Manifest V3 popup, side panel, options/settings, minimal permission content scripts.
- `apps/web-dashboard`: responsive research and administration views.
- `apps/api`: authentication, authorization, query orchestration, public/tenant APIs, health endpoints.
- `packages/shared-types`: canonical source, trend, product, provider and API contracts.
- `packages/validation`: runtime validation and schemas.
- `packages/trend-scoring`: versioned transparent metrics.
- `packages/ai-orchestrator`: provider-independent AI calls and evidence validation.
- `packages/ecommerce-normalization`: provider-specific product normalization.
- `packages/product-matching`: product identity resolution with explainable confidence.
- `providers/*`: isolated connector implementations and capability declarations.
- `workers/*`: ingestion, normalization, scheduled refresh, price/rank history and alerts.
- `database/migrations`: versioned database changes and documented rollback considerations.
- `tests/*`: unit, contract, integration, security and end-to-end testing.

## Proposed baseline (confirm during implementation)
- Frontend/extension: React, TypeScript, Vite, Tailwind CSS.
- API: Node.js/TypeScript with Fastify or compatible existing framework.
- Database: PostgreSQL, optionally managed by Supabase.
- Jobs: durable queue (Redis/BullMQ or managed alternative) and backend scheduler.
- Validation: Zod or equivalent.
- Testing: Vitest, React Testing Library, Playwright, API/provider contract tests.
- CI: GitHub Actions, build/test plus dependency and secret scanning.

No framework should be installed until the repository is audited for existing code and dependencies. This architecture is a plan, not a claim that any component exists.


## Keyword research UI boundaries
- The dashboard presentation layer should be provider-agnostic and use typed normalized records plus provider-status metadata.
- Query controls and tabs live in the web dashboard and may be shared with the Chrome extension where useful, without coupling UI to a specific provider.
- Each metric carries its source, unit, geography, period and freshness. Aggregation is permitted only when the compared measurements are compatible.
- Chart components render only actual records or visibly labeled test fixtures; production paths must not fall back to fake sample values.
- See docs/KEYWORD_RESEARCH_UI_SPEC.md for the full UI contract and acceptance criteria.
