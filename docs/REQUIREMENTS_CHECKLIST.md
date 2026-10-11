# Requirements checklist

Tracks the API discovery and integration run (`docs/AUTO_REQUIREMENT_DISCOVERY_PROMPT.md`, `docs/CURSOR_AGENT_RUN_PROMPT.md`). `[x]` means done and verified in this repository; `[ ]` means open, with the blocker named.

## A. Hardening (shared provider layer)

- [x] Per-request timeout, caller cancellation, 2 MB response cap (`lib/keywords/http.ts`)
- [x] Bounded retries with exponential backoff for network/5xx only (never for 401/403/429)
- [x] Error categories: timeout, rate_limited, auth, http, network, parse, cancelled; 401/403 map to `ACCESS_REQUIRED`
- [x] Provider error codes are extracted, sanitised and truncated; secret env values and bearer tokens are redacted from messages (`redactSecrets`)
- [x] In-memory OAuth token cache per credential with an early refresh margin (`cachedToken`)
- [x] Process-level pacing for providers with mandated rates (`createThrottle`: GDELT 5.2 s, Google Ads keyword planning 1.1 s)
- [x] Search route rate limit (20/min per IP) and 5-minute cached status checks (existing)
- [x] Each adapter exposes `configuration` (names missing env vars), `liveCheck` (real authorised request) and `search`
- [x] Status checks never spend scarce quota (YouTube uses `videos.list`, not `search.list`)
- [ ] Persist rate-limit and token state across server instances (needs a shared store; not required for a single local server)

## B. Search volume

- [x] Google Ads API v25 Keyword Planner adapter (ideas, volume, monthly history, competition, bids, CPC in account currency)
- [x] Seed chart prefers observed Google search counts over proxy series
- [ ] **Blocked: credentials.** Google Ads developer token with Basic access, OAuth client, refresh token, customer ID
- [ ] `GenerateKeywordHistoricalMetrics` for saved lists (after server-side saved lists)
- [x] DataForSEO and Semrush evaluated (third-party, paid). Nothing purchased
- [ ] **Blocked: your decision and authorisation** to buy DataForSEO credit or a Semrush API plan

## C. Marketplaces

- [x] Amazon Creators API adapter (`searchItems`, LwA token by credential version, marketplace header)
- [x] Amazon PA-API 5 recorded as retired (2026-05-15)
- [ ] **Blocked: Associates eligibility** (≥10 qualifying sales in 30 days) and Creators API credentials
- [ ] Amazon SP-API connector (seller-only; needs seller OAuth connect flow)
- [x] Flipkart Affiliate adapter (search, max 10 results)
- [ ] **Blocked: Flipkart affiliate credentials**; confirm the API is still issued to new affiliates
- [ ] Flipkart Seller API connector (seller-only)
- [x] Indian marketplaces without public APIs (Meesho, Myntra, AJIO, JioMart, Nykaa) recorded; no scraping

## D. Other platforms

- [x] YouTube Data API adapter. **Blocked: `YOUTUBE_API_KEY`**
- [x] eBay Browse adapter. **Blocked: `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`**
- [x] Etsy v3 adapter. **Blocked: Etsy app approval and keys**
- [x] GDELT news adapter (no key). Format verified live; GDELT was returning 429 during this run
- [ ] Walmart (seller-only), Search Console (own site), Shopify/WooCommerce (own store): need per-user OAuth/connect flows
- [ ] Reddit (commercial agreement), X (paid credits), Pinterest/Instagram/TikTok (approvals): access blockers documented

## E. AI, persistence, alerts

- [x] AI expansion route (server-only key, output labelled AI-inferred)
- [ ] **Blocked: `OPENAI_API_KEY`** for live AI expansion
- [ ] Saved lists and alerts in Supabase (tables, RLS, migrations): next engineering task

## Tests

- [x] Valid, empty, malformed, paginated/capped, unauthorized, quota/rate-limit and timeout cases for every new adapter (`tests/providers.test.ts`, mocked fetch)
- [x] No mocked result is labelled live; credentialed providers show `NOT_CONFIGURED` until env vars exist and `liveCheck` succeeds

## Delivery

- [x] `.env.example` placeholders only; `.env.local` stays ignored
- [x] `docs/API_REQUIREMENTS_MATRIX.md`, `docs/API_SETUP_GUIDE.md`, this checklist
- [x] Typecheck, lint, tests, production build, local preview, secrets scan, commit and push. Results are in `IMPLEMENTATION_LOG.md`
