# Feature Status

Statuses: NOT STARTED, IN PROGRESS, IMPLEMENTED, TESTED, VERIFIED IN DEPLOYED ENVIRONMENT, BLOCKED.

| Feature | Status | Evidence / notes |
|---|---|---|
| Repository workflow documentation | IMPLEMENTED | README.md committed to main |
| Master PRD | IMPLEMENTED | docs/MASTER_PRD.md |
| Screenshot-guided keyword research UI specification | IMPLEMENTED | docs/KEYWORD_RESEARCH_UI_SPEC.md |
| Screenshot-guided keyword research dashboard | TESTED | `/`; follows the spec hierarchy (the screenshot image itself was not available in this environment); browser-verified at 1440 px and 390 px |
| Provider icon/status toolbar | TESTED | 20 platforms; CONNECTED only after a live check; setup requirements on click |
| Search suggestions/questions/prepositions/related tabs | TESTED | Plus Rising tab; method shown per tab; AI output kept in a separate labelled panel |
| Keyword metrics and historical charts | TESTED | Wikipedia article-view history and access-method split; volume/CPC shown as Not provided |
| Sortable/filterable keyword table and exports | TESTED | Sort, filter, paginate, select, copy, CSV (formula-safe) and JSON with provenance |
| Chrome Manifest V3 extension | NOT STARTED | |
| Popup and side panel | NOT STARTED | |
| Responsive web dashboard | TESTED | Next.js app in apps/web-dashboard; build passes; desktop preview inspected in browser |
| Supabase SSR clients and session proxy | TESTED | Unit tests pass; publishable key configured locally; live sign-in not yet exercised |
| Supabase connection diagnostics | TESTED | Live: Auth connected (200), Data API reachable, public.todos not found (404) |
| Email authentication (sign in/up/out, protected /account) | IMPLEMENTED | Unauthenticated /account redirect verified; Auth accepts the key; no test account was created |
| API and health endpoint | IMPLEMENTED | /api/health/supabase, /api/keywords/search, /api/keywords/providers, /api/keywords/ai-expand |
| Shared types and validation | IN PROGRESS | lib/keywords/types.ts; search request validation tested |
| PostgreSQL schema and migrations | NOT STARTED | |
| Authentication and tenant isolation | NOT STARTED | |
| Provider registry/capabilities | TESTED | lib/keywords/registry.ts with provides/not-provided/filter support per provider |
| Google Trends integration | IN PROGRESS | Daily trending RSS live (rising searches, approx. traffic bucket); official API not available |
| Google Ads keyword planning | BLOCKED | Needs developer token + OAuth; source for volume/CPC/competition |
| Google Search Console | NOT STARTED | Requires authorized site access |
| YouTube integration | BLOCKED | Needs YOUTUBE_API_KEY; adapter not written |
| News/RSS/search providers | IN PROGRESS | Wikipedia, Stack Exchange, Hacker News live; GDELT planned; Bing APIs retired |
| Unified e-commerce search | NOT STARTED | |
| Amazon provider(s) | NOT STARTED | Creators and Seller APIs differ in permissions |
| Flipkart provider(s) | NOT STARTED | Affiliate and Seller APIs differ |
| Other marketplace adapters | NOT STARTED | Access to be verified per provider |
| Cross-marketplace product matching | NOT STARTED | |
| Price/rank history | NOT STARTED | Subject to provider support and retention rules |
| AI orchestration/evidence validation | IN PROGRESS | AI keyword expansion route (labelled, no metrics); BLOCKED on OPENAI_API_KEY for live use |
| Trend scoring/calibration | NOT STARTED | Proposed formulas require evaluation |
| Server connection manager | NOT STARTED | |
| Durable background jobs and scheduler | NOT STARTED | |
| Alerts and saved searches | IN PROGRESS | Saved searches, history and keyword lists in browser storage; account sync and alerts not started |
| SaaS subscriptions/entitlements | NOT STARTED | |
| Payment integration/webhooks | NOT STARTED | |
| Self-hosted licensing | NOT STARTED | |
| Docker/deployment/backup assets | NOT STARTED | |
| Unit/integration/e2e/security tests | IN PROGRESS | 55 Vitest unit tests (mocked provider fixtures); no e2e suite yet |
| CI build/security workflow | NOT STARTED | |
| Live preview | IMPLEMENTED | Local only (`npm run dev` / `npm start`, http://localhost:3000); no hosted preview |
| Production deployment verification | NOT STARTED | |
