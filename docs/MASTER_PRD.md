# Trend Intelligence AI — Master Product Requirements Document

## 1. Product vision

Build a production-minded Chrome extension and web dashboard for verified trend discovery, SEO keyword research, e-commerce product intelligence, AI analysis, and sellable modular research tools. Treat this document as the durable product baseline; update it when scope or architecture changes.

**Truth requirement:** Do not fabricate metrics, search volume, products, prices, rankings, data freshness, source citations, API connectivity, tests, previews, or deployments. Every displayed observation must preserve provider provenance and retrieval/observation timestamps. Mark estimates and AI hypotheses explicitly.

## 2. User experience

- Chrome Manifest V3 extension with popup, side panel, options/settings, and explicit user-triggered page context features.
- Responsive standalone web dashboard.
- Global search and source/platform filters.
- Keyword/topic views, product discovery, evidence details, history charts, saved searches, watchlists, exports, alerts, provider health, and settings.
- Consistent loading, empty, disconnected, partial-result, stale-data, rate-limited, and error states.
- Premium, accessible UI with responsive layouts and tested interactions.
- Always provide a real preview or reproducible evidence during implementation when the environment supports it. A static mockup is not a working product.

## 3. Trend discovery sources

Use independent provider adapters and a capability registry for sources such as:
- Google Trends, conditional on actual API access; otherwise offer documented, permitted alternatives.
- Google Ads API for keyword ideas and provider-reported historical metrics, with correct account/access requirements.
- Google Search Console for properties the connected user is authorized to access.
- YouTube Data API.
- Reddit or other community APIs where authorized.
- News APIs and permitted RSS feeds.
- Search-provider APIs.
- Other platforms only when official, licensed, or otherwise permitted access exists.

Show source, date/time, geography, language, metric definitions, refresh cadence, access status, quota state, and source URL where available. Do not imply all platforms are universally accessible or all metrics are real-time.

## 4. E-commerce intelligence

Target providers include Amazon marketplaces, Flipkart, eBay, Etsy, Walmart Marketplace, Shopify, WooCommerce, Google Merchant Center, AliExpress, TikTok Shop, Meesho, Myntra, AJIO, JioMart, and future authorized providers.

Marketplace access must be verified per provider:
- Marketplace-wide discovery and private seller-account analytics are different capabilities.
- Amazon Creators/Affiliate APIs and Selling Partner APIs have distinct eligibility and permissions.
- Flipkart affiliate and seller APIs have distinct purposes and access requirements.
- Shopify/WooCommerce store data requires the merchant's authorization.
- Do not show a marketplace as connected until an authenticated live check passes.
- Do not scrape restricted interfaces or bypass authentication, CAPTCHAs, rate limits, or terms.

Feature requirements:
- Unified concurrent search across enabled connectors.
- Keyword, product ID, identifier, category, brand, price, currency, country, and availability filters where supported.
- Partial-result rendering when a provider is unavailable.
- Product normalization and deduplication without losing original listing identities.
- Cross-marketplace product matching with identifiers, specifications, variants, and explainable confidence.
- Price and rank history only where supported and permitted.
- Marketplace-specific keyword research, listing SEO, topic/category analysis, product watchlists, and alerts.
- Product opportunity analysis with evidence and limitations; no guaranteed sales/profit claims.
- India-first support for INR, English, Hindi, Hinglish, and regional terms where actual data supports it.

## 5. Unified search behavior

Query enabled providers concurrently with per-provider deadlines, cancellation, pagination, rate limiting, bounded retry/backoff, and caching. Return partial results rather than failing the entire search because one source times out.

Every search response should describe providers queried, success/failure, result counts, retrieval timestamps, paging state, and actionable errors.

Suggested connector states:
NOT_CONFIGURED, ACCESS_REQUIRED, CONNECTING, CONNECTED, DEGRADED, RATE_LIMITED, DISCONNECTED, ERROR, DISABLED.

## 6. Data integrity and AI

Use a canonical source observation record with:
- Stable record ID, provider, provider record ID, topic/product identity and original URL.
- Geographic and language scope.
- Metric name, numeric value when available, unit, metric type and source measurement window.
- Observed timestamp, fetched timestamp and methodology version.
- Provenance references and data-quality flags.
- Observed, derived, estimated, or AI-inferred classification.

Never use zero to represent unknown data. Never combine incompatible measurement types, such as relative search interest and absolute search volume. Derived results must retain their input record IDs and method version.

AI uses:
- Natural-language research queries.
- Keyword expansion, topic/entity clustering and search-intent classification.
- Evidence-grounded trend explanations and multilingual summaries.
- Content briefs, product/listing recommendations, FAQ and title ideas.
- Cross-source agreement and contradiction analysis.
- Competitor/topic gap analysis only from permitted observable or authorized data.

AI factual claims must reference actual retrieved records. Reject nonexistent source IDs and label estimates/hypotheses. Treat web pages and listing content as untrusted; prevent prompt injection from triggering tools or unauthorized actions.

Any scoring weights are provisional until calibrated against historical data. Show component scores, methodology, missing inputs, and uncertainty. Do not claim predictive accuracy without evaluation.

## 7. Architecture and stack

Preferred defaults, subject to repository audit:
- Extension: React, TypeScript, Vite, Tailwind CSS, Chrome Manifest V3.
- API: TypeScript/Node.js with a validated API framework such as Fastify.
- Persistence: PostgreSQL, optionally managed by Supabase.
- Jobs: durable queue and independently deployable workers; Redis/BullMQ or an appropriate managed queue.
- Scheduling: backend scheduler/managed scheduled jobs, not a permanently running extension worker.
- Validation: Zod/JSON Schema and typed provider contracts.
- Testing: Vitest, React Testing Library, Playwright, provider contract tests, integration tests, and security tests.
- CI: GitHub Actions, dependency and secret scanning.
- Observability: structured logs, health checks, metrics, and error tracking.

Audit the repository before installing frameworks or replacing existing components. Reuse compatible dependencies and avoid unnecessary duplicates.

Suggested boundaries:
- apps/chrome-extension
- apps/web-dashboard
- apps/api
- packages/shared-types
- packages/validation
- packages/trend-scoring
- packages/topic-clustering
- packages/ai-orchestrator
- packages/ecommerce-normalization
- packages/product-matching
- providers/*
- workers/*
- database/migrations
- tests/*

## 8. Server portability and reliability

Provide a server connection manager for trusted, owner-configured compatible API servers. Support named development/staging/production profiles, API version checks, TLS verification, authentication, health checks, timeouts, and status reporting.

Validate endpoint URLs and redirects, prevent SSRF and credential leakage, and do not send secrets to unverified hosts. Support user-controlled Linux VPS and Docker-compatible deployments where implemented.

Deliver Dockerfiles/Compose, environment templates without secrets, HTTPS/reverse-proxy guidance, persistent database storage, migrations, rollback, backups/restores, health checks, and deployment verification.

Use durable idempotent jobs, retry/backoff, queue persistence and explicit outage/stale-data indicators. Never promise uninterrupted service.

## 9. Security and privacy

- Least-privilege Chrome permissions and optional host permissions.
- Keep provider and admin secrets server-side.
- Use supported OAuth flows, short-lived tokens where possible, revocation, and minimal scopes.
- Tenant isolation and server-side authorization for all protected API operations.
- Test cross-tenant access, SSRF, XSS, prompt injection, token leakage, webhook replay, authorization bypass, rate-limit abuse, and malicious redirects.
- Secure headers, TLS, validation, bounded responses/timeouts, audit events, and secure backups.
- Minimize browsing data collection; obtain appropriate consent for disclosed page-context features.
- Provide account/data export and deletion and document retention.
- Follow provider terms, privacy obligations, and Chrome Web Store policies.
- Never download and execute arbitrary remote JavaScript in the extension; extension code changes must use a compliant release mechanism.

## 10. Commercialization

Design for SaaS and eligible self-hosted commercial editions:
- Configurable Free, Starter, Pro, Business, and Enterprise plans.
- Server-side feature entitlements, quotas, usage and AI budgets.
- Organizations/workspaces and tenant isolation.
- Trials, renewals, upgrades/downgrades, cancellations, payment failure, invoices, refunds and auditable billing events.
- Replaceable billing adapter; use providers such as Razorpay or Stripe only when the account/business/product is eligible.
- Verify signed webhooks and use idempotency. Browser redirects are not proof of payment.
- Signed license entitlements for eligible self-hosted editions, with activation, expiry, module/user/instance limits, revocation and renewal.
- Owner-only administration with strong authorization and audit trails.

Do not expose payment, license-signing, or admin secrets in the extension. Do not claim payment, licensing, or billing features are implemented until verified.

## 11. Continuous development and GitHub workflow

Repository: https://github.com/tarikk786786/ecom-seo

The repository is the source of truth. Every meaningful verified change must be committed and pushed. Use small descriptive commits; never force-push, discard user changes, or overwrite concurrent work.

For every development cycle:
1. Inspect repository state, recent commits, uncommitted changes, progress records and architecture.
2. Select one coherent next task.
3. Implement in the existing project.
4. Run relevant unit/type/lint/build checks and appropriate integrations.
5. Launch or refresh the real preview when possible; capture the actual affected screen or provide reproducible evidence.
6. Fix regressions.
7. Update BUILD_PROGRESS.md, FEATURE_STATUS.md, IMPLEMENTATION_LOG.md and ARCHITECTURE.md as appropriate.
8. Review diffs for secrets, unrelated changes and generated artifacts.
9. Commit and push the verified change.
10. Report commit SHA/link, changed files, actual test results, preview status, blockers and next task.

If the user says NEXT, resume from the actual repository and progress files, continue the highest-priority incomplete task, implement it where possible, test, preview, document, and commit/push. Do not restart or answer with only a plan.

If credentials, approvals, or runtime access are missing, complete independent work and precisely record blocked live checks. Never claim a push, test, preview, or deployment succeeded without evidence.

## 12. Definition of done

A feature is complete only when code is implemented, relevant tests actually run, required live integration is verified with authorized credentials, source evidence is traceable, the relevant preview or reproducible evidence is supplied, documentation and status files are current, and the verified change is pushed to GitHub. Mark unresolved work BLOCKED instead of pretending it works.


## 13. Screenshot-guided all-platform keyword research workspace

The primary keyword-research UI must follow the user's reference screenshot's functional structure. The full design and acceptance specification is maintained in [docs/KEYWORD_RESEARCH_UI_SPEC.md](./KEYWORD_RESEARCH_UI_SPEC.md).

Required workspace features:
- Compact source/provider icon row with genuine provider connection states.
- One query bar with provider selection, geography, language, date range and supported filters.
- Tabs for Keyword Suggestions, Questions, Prepositions and Related Keywords, plus optional autocomplete, long-tail, intent, clustering and marketplace views.
- Metric cards for total keywords, source-compatible search volume, trend change, CPC/bid ranges, competition, successful provider count and data freshness.
- Historical trend charts using actual source observations; relative interest must never be represented as absolute search volume.
- Desktop/mobile/tablet distribution only when a real source provides this breakdown.
- A sortable, filterable, selectable keyword table with volume, trend, sparkline, CPC/bid ranges, competition, source, locale, timestamps and evidence links when available.
- Settings for sources, geography, language, date range, display metrics, columns, currency, exports and AI usage.
- Bulk keyword lists, comparisons, clusters, export and evidence-grounded AI analysis.
- Desktop, tablet and mobile layouts; loading, empty, disconnected, partial-failure, rate-limited and stale-data states.

The workspace must query actual configured providers and show per-provider success/failure. It must not manufacture volume, CPC, competition, device share, ranking, source URLs or chart history. The UI may use clearly labeled fixtures during local UI development, but fixture data must be isolated from production queries. Metrics with incompatible definitions are displayed separately instead of incorrectly aggregated.

This visual direction does not remove the platform-access rule: every source requires its actual supported API, approved access, permitted feed or licensed integration. “All platforms” means all eligible configured connectors, not guaranteed universal access.
