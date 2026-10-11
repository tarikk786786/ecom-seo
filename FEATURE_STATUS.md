# Feature Status

Statuses: NOT STARTED, IN PROGRESS, IMPLEMENTED, TESTED, VERIFIED IN DEPLOYED ENVIRONMENT, BLOCKED.

| Feature | Status | Evidence / notes |
|---|---|---|
| Repository workflow documentation | IMPLEMENTED | README.md committed to main |
| Master PRD | IMPLEMENTED | docs/MASTER_PRD.md |
| Screenshot-guided keyword research UI specification | IMPLEMENTED | docs/KEYWORD_RESEARCH_UI_SPEC.md; requirements documented only, UI not yet built |
| Screenshot-guided keyword research dashboard | NOT STARTED | Must match reference hierarchy; no app code yet |
| Provider icon/status toolbar | NOT STARTED | Must reflect actual connector status |
| Search suggestions/questions/prepositions/related tabs | NOT STARTED | Must distinguish real provider results vs AI expansions |
| Keyword metrics and historical charts | NOT STARTED | Must use actual values and explicit metric semantics |
| Sortable/filterable keyword table and exports | NOT STARTED | |
| Chrome Manifest V3 extension | NOT STARTED | |
| Popup and side panel | NOT STARTED | |
| Responsive web dashboard | TESTED | Next.js app in apps/web-dashboard; build passes; desktop preview inspected in browser |
| Supabase SSR clients and session proxy | TESTED | Unit tests for proxy pass-through and cookie/header copying; live session refresh BLOCKED on publishable key |
| Supabase connection diagnostics | TESTED | 17 mocked classification tests; live endpoint reachability verified; Auth/DB checks BLOCKED on publishable key |
| Email authentication (sign in/up/out, protected /account) | IMPLEMENTED | Unauthenticated /account redirect verified; live sign-in BLOCKED on publishable key |
| API and health endpoint | IMPLEMENTED | /api/health/supabase |
| Shared types and validation | NOT STARTED | |
| PostgreSQL schema and migrations | NOT STARTED | |
| Authentication and tenant isolation | NOT STARTED | |
| Provider registry/capabilities | NOT STARTED | |
| Google Trends integration | NOT STARTED | Access to official API may be limited |
| Google Ads keyword planning | NOT STARTED | Requires eligible API access/account |
| Google Search Console | NOT STARTED | Requires authorized site access |
| YouTube integration | NOT STARTED | Requires API access and quota |
| News/RSS/search providers | NOT STARTED | Provider selection/access to be verified |
| Unified e-commerce search | NOT STARTED | |
| Amazon provider(s) | NOT STARTED | Creators and Seller APIs differ in permissions |
| Flipkart provider(s) | NOT STARTED | Affiliate and Seller APIs differ |
| Other marketplace adapters | NOT STARTED | Access to be verified per provider |
| Cross-marketplace product matching | NOT STARTED | |
| Price/rank history | NOT STARTED | Subject to provider support and retention rules |
| AI orchestration/evidence validation | NOT STARTED | |
| Trend scoring/calibration | NOT STARTED | Proposed formulas require evaluation |
| Server connection manager | NOT STARTED | |
| Durable background jobs and scheduler | NOT STARTED | |
| Alerts and saved searches | NOT STARTED | |
| SaaS subscriptions/entitlements | NOT STARTED | |
| Payment integration/webhooks | NOT STARTED | |
| Self-hosted licensing | NOT STARTED | |
| Docker/deployment/backup assets | NOT STARTED | |
| Unit/integration/e2e/security tests | NOT STARTED | |
| CI build/security workflow | NOT STARTED | |
| Live preview | IMPLEMENTED | Local only (`npm run dev` / `npm start`, http://localhost:3000); no hosted preview |
| Production deployment verification | NOT STARTED | |
