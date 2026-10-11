# AUTO REQUIREMENTS DISCOVERY & API INTEGRATION PROMPT

Repository: https://github.com/tarikk786786/ecom-seo
Branch: main
Read first: README.md, docs/MASTER_PRD.md, docs/API_INTEGRATION_CATALOG.md, docs/KEYWORD_RESEARCH_UI_SPEC.md, BUILD_PROGRESS.md, FEATURE_STATUS.md, IMPLEMENTATION_LOG.md, ARCHITECTURE.md.

## Mission
Automatically research official API requirements for the full Ecom SEO / Trend Intelligence AI product, compare them with the existing code and safely configured environment, implement every useful part that is currently possible, test it, show a real preview or verifiable evidence, update project tracking files, and push each verified development cycle to GitHub.

Automate research and engineering, not impossible or unauthorized credential acquisition. Do not claim that an API key, approval, paid subscription, or restricted API access can be obtained automatically.

## 1. Audit before changes
Fetch the latest main branch and inspect recent commits, git status, package manifests/lockfiles, framework/runtime versions, current provider registry and adapters, UI/API routes, Supabase configuration, migrations, tests, CI and deployment settings. Preserve all existing working code, avoid duplicate dependencies and do not restart/rewrite the project without cause. Record current HEAD and baseline checks.

## 2. Research all relevant providers through official sources
Use live web/documentation access. For each provider, read the official developer portal, current API reference, version/changelog, access/eligibility/approval pages, official pricing, rate-limit/quota rules, terms and data-retention/attribution policy. Verify APIs are still supported; do not build against expired endpoints copied from old tutorials.

Research:
- Search/SEO: Google Ads keyword ideas and historical metrics, Google Trends, Search Console, Microsoft Advertising/Bing Webmaster, DataForSEO, Semrush, Ahrefs and suitable licensed alternatives.
- E-commerce: Amazon Creators API, Amazon SP-API, Flipkart Affiliate API, Flipkart Seller API, eBay Browse, Etsy, Walmart, AliExpress, TikTok Shop, Shopify, WooCommerce, Google Merchant Center, and eligible Indian marketplaces such as Meesho, Myntra, AJIO and JioMart.
- Social/video/community/news: YouTube, Reddit, X, Pinterest, Instagram/Meta, TikTok, RSS and GDELT where relevant.
- AI, data, billing and deployment: OpenAI or replaceable models, Supabase, eligible billing APIs, hosting, queues, monitoring and deployment services.

For every API product (separate affiliate from seller APIs), capture:
1. Official docs and endpoint reference URLs.
2. Exact current endpoint, HTTP method, supported API version, headers and required parameters.
3. Actual response fields, metric meanings and unsupported requested fields.
4. Auth type and required credentials.
5. OAuth scopes, developer-token requirements, account/affiliate/seller eligibility, review and approval.
6. Quotas, rate limits, paging, update frequency and any maximum result count.
7. Official prices, subscriptions, metered usage and minimum spend if published.
8. Supported countries, marketplaces, regions and languages.
9. Terms on attribution, display, caching, resale, retention and deletion.
10. Sandbox/test environment and a minimal read-only verification request.
11. Required environment-variable names, never values.
12. Common error cases, integration acceptance tests and date last verified.

Use official sources preferentially. If access or current support is uncertain, document that uncertainty instead of inventing endpoint names. Identify third-party paid data providers as third party, not official marketplace APIs.

## 3. Produce and maintain requirement documents
Create/update docs/API_REQUIREMENTS_MATRIX.md with columns:
Provider/API product | Use case | Official docs | Metrics/fields | Auth/scopes | Approval | Quota | Cost | Env vars | Status | Test evidence | Remaining action.

Create/update docs/REQUIREMENTS_CHECKLIST.md covering product features, source coverage, database/RLS, authentication, secrets, provider compliance, quota/cost, retries, observability, accessibility, tests, privacy/retention, deployment, backup/rollback and commercialization.

Use truthful states:
- IMPLEMENTED_AND_LIVE_TESTED
- IMPLEMENTED_BUT_CREDENTIALS_MISSING
- ACCESS_APPROVAL_REQUIRED
- PAID_PLAN_REQUIRED
- SANDBOX_ONLY
- DOCUMENTED_NOT_IMPLEMENTED
- UNAVAILABLE_OR_DEPRECATED
- NOT_APPLICABLE

Explicitly differentiate absolute search volume from relative Trends interest; CPC/ad bid/paid competition from organic difficulty; marketplace-wide data from seller-private analytics; connected store data from global product catalogs; observed/derived/estimated values from AI suggestions; API technical access from commercial resale rights.

A docs URL is not proof that an API works or can legally be resold.

## 4. Detect configured credentials safely
Inspect only relevant project env/configuration files, deployment settings and approved secret-manager metadata. Report whether an expected variable is present or missing without printing its value. Check the existing provider registry and tests before deciding to rewrite anything.

Never scan the entire computer, browser profiles, cookies, password managers or unrelated repositories for secrets. Never extract tokens from authenticated pages, bypass OAuth/CAPTCHA/approval/paywalls/quotas, manufacture keys or reuse another customer's credentials. Never commit secret values, print them in logs/screenshots, or place private keys in browser bundles or NEXT_PUBLIC variables.

For missing credentials, add only placeholders to .env.example and create an actionable setup guide linking to the exact official dashboard page, navigation steps, required scopes/roles and safe verification command. Ask the user only for account-owner actions that cannot legitimately be automated. Use existing authorized runtime secrets only for their intended project and API.

## 5. Adapter requirements
Audit the current connector registry. Every provider must declare its ID/name, actual capabilities, official docs, credential names, scopes/access requirements, supported locale/filters, metric units/definitions/time windows, quota/timeout/pagination/cache policy, attribution/retention terms, connection test and failure behavior.

Implement a safe testConnection/read-only test query, response validation, bounded timeouts/retries/backoff, rate limiting, pagination/cancellation when supported, partial result behavior, and redacted errors.

A provider is CONNECTED only after a real authorized query succeeds. URL reachability alone is not successful authentication. Use honest states for credential missing, approval required, rate-limited, degraded, disconnected, disabled and deprecated.

## 6. Execute implementation in priority order

### A. Audit and harden current workspace
Run existing typecheck, lint, unit tests, production build and available live-provider checks. Verify the screenshot-guided keyword UI and current public providers. Fix actual bugs and prevent fake metrics from entering production paths.

### B. Real keyword metrics
Implement Google Ads keyword ideas and historical metrics after verifying developer token, OAuth, customer account and access level. If credentials are missing, complete safe adapter code, contracts, tests, .env.example, setup instructions, and mark live testing blocked.

Evaluate DataForSEO or Semrush as a paid alternative only after researching official pricing, quota, field coverage and terms. Do not buy credits, start subscriptions or issue chargeable bulk requests without explicit user authorization.

### C. Amazon and Flipkart
Research and implement separate connectors for:
- Amazon Creators API: eligible affiliate product lookup.
- Amazon SP-API: seller-authorized catalog/pricing/business operations.
- Flipkart Affiliate API: eligible affiliate product lookup.
- Flipkart Seller API: seller-authorized operations.

Confirm the current endpoint and access conditions. Do not describe seller-only data as public marketplace-wide data. If keys/approval are absent, implement testable code only where responsible and keep the provider not connected until a real test succeeds.

### D. More providers
Add YouTube, eBay, Etsy, Walmart, Search Console, authorized Shopify/WooCommerce, social and news APIs one at a time based on user value, access feasibility, cost and data quality. Do not make provider icons appear connected when they are not.

### E. AI and paid/product features
Keep AI suggestions separately labeled from observations. Factual claims about metrics need real evidence records. Implement saved-list persistence, alerts, marketplace listing SEO, product matching and paid entitlements according to existing PRD, with correct auth/RLS and privacy rules.

## 7. Testing
For each provider implement unit and contract tests for valid, malformed, empty, paginated, unauthorized, quota and timeout responses. Keep mocks separate from real integration tests. When approved credentials exist, run at least one live read-only query and verify returned fields, URL, timestamp, region, units, attribution and metric semantics. Check secret redaction and partial-result behavior. Run typecheck/lint/tests/build and relevant security checks.

Never claim a test ran if it did not. Never describe a mocked result as a live connection. Never invent missing volume/CPC/rank values.

## 8. Costs and legal/access boundaries
Document official prices and quotas for paid APIs; estimate costs only where published pricing supports it. Do not buy credits, accept terms, open subscriptions, deploy paid services or run chargeable bulk queries without explicit user authorization. Respect data-use, attribution, retention, personal-data, display and resale terms. Technical API access does not automatically permit resale of the resulting data.

## 9. Preview, tracking files and GitHub
After each coherent change:
1. Implement code.
2. Run relevant checks; fix regressions.
3. Start/refresh the actual app preview where supported and show real screenshots/URL or reproducible evidence.
4. Update docs/API_REQUIREMENTS_MATRIX.md, docs/REQUIREMENTS_CHECKLIST.md and existing BUILD_PROGRESS.md, FEATURE_STATUS.md, IMPLEMENTATION_LOG.md and ARCHITECTURE.md where relevant.
5. Review the diff and scan for secrets.
6. Commit and push to main with a descriptive message.
7. Verify the remote commit SHA and link.

Never force-push or discard changes. If API credentials, approval, runtime or GitHub access are unavailable, specify the exact blocker.

When I say NEXT, resume from actual main and progress files, implement the next highest-priority incomplete task, test, preview, document and push. Do not restart or answer only with a plan.

## 10. Deliverables
- Official API requirements matrix covering every in-scope API product.
- Requirements checklist and actionable credential/access setup guide.
- .env.example with placeholders only.
- Working adapters and tests for integrations actually implemented.
- Honest blockers for all missing access/approval/paid plans.
- Build/test report, real preview or reproducible launch instructions.
- Updated tracking documents and verified GitHub commit.
- Next action ranked by value, cost and feasibility.

Definition of done: every in-scope provider/feature has documented requirements and a truthful status; an integration is implemented only when real code and tests exist; it is live only when an actual authorized API query succeeds. Never claim private credentials, approvals, paid accounts or universal access were automatically acquired.
