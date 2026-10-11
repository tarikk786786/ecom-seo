# Cursor Agent — Execute API Requirements Discovery and Continue Building Ecom SEO

Repository: `https://github.com/tarikk786786/ecom-seo`
Branch: `main`

## Instruction: execute, don't just plan

Read and obey `.cursor/rules/ecom-seo.mdc`. Then read:
- `docs/AUTO_REQUIREMENT_DISCOVERY_PROMPT.md`
- `docs/API_INTEGRATION_CATALOG.md`
- `docs/MASTER_PRD.md`
- `docs/KEYWORD_RESEARCH_UI_SPEC.md`
- `BUILD_PROGRESS.md`
- `FEATURE_STATUS.md`
- `IMPLEMENTATION_LOG.md`
- `ARCHITECTURE.md`

The repository has an existing Next.js-based keyword research workspace and provider registry. **Do not rebuild it from scratch.** First inspect current `main`, source files, provider implementation states, package scripts, local environment-variable presence (never values), recent tests, and UI functionality.

## Goal

Automatically gather all remaining technical/access requirements for the full product, populate a verified provider matrix, and then implement the next highest-value available feature. Continue past documentation where code is possible.

### Step 1 — Baseline and preview
- Inspect git status, branch and remote HEAD.
- Run the existing project's scripts after inspecting `package.json`: typecheck, lint, tests, build, secret scan.
- Start/refresh the app using its actual script.
- Verify the existing screenshot-guided keyword workspace and current provider registry.
- Capture a real browser preview or provide the working local URL and test evidence. Do not use fake production data.

### Step 2 — Discover all API requirements
Follow `docs/AUTO_REQUIREMENT_DISCOVERY_PROMPT.md` in full. Use current official developer docs and pricing/terms pages for every API product in `docs/API_INTEGRATION_CATALOG.md`, plus any relevant missing platforms.

For each provider/API product verify:
- Exact supported endpoint/method/version and returned fields.
- Authentication/key type/OAuth scopes and account role.
- Eligibility, approval, production access and regional coverage.
- Quotas, paging, refresh constraints and official cost.
- Display, attribution, caching, retention and resale restrictions.
- Environment-variable names, health-check method, errors and reproducible test.
- Whether the existing connector is really implemented and live-tested.

Keep Amazon Creators API separate from Amazon SP-API. Keep Flipkart Affiliate API separate from Flipkart Seller API. Keep global product discovery separate from connected seller/store data. Keep search volume/CPC separate from Trends relative interest and from social/page-view engagement.

### Step 3 — Create the requirement outputs
Create/update:
- `docs/API_REQUIREMENTS_MATRIX.md`
- `docs/REQUIREMENTS_CHECKLIST.md`
- `.env.example` with placeholder names only
- A practical API credentials/setup guide with exact official console links and required scopes/roles
- `BUILD_PROGRESS.md`
- `FEATURE_STATUS.md`
- `IMPLEMENTATION_LOG.md`
- `ARCHITECTURE.md`, if architecture changes

Use honest statuses, including credentials missing, approval required, paid plan required, sandbox only, documented/not implemented, deprecated/unavailable and live-tested. Never treat a provider as live because its icon exists or a key is configured.

### Step 4 — Implement, prioritised by value and feasibility
1. Fix any real defects in existing providers and UI.
2. Implement Google Ads keyword ideas/historical metrics if access is configured; otherwise implement/test the adapter contract and document exact setup requirements.
3. Evaluate a paid keyword-data provider (e.g. DataForSEO or Semrush) against official pricing, coverage, licensing and likely request cost; do not activate billing or issue chargeable bulk calls without my explicit approval.
4. Implement Amazon and Flipkart connectors only against the appropriate official API product and current access requirements.
5. Continue with YouTube, eBay, Etsy, Google Search Console, eligible Shopify/WooCommerce integrations, social/news APIs, and additional marketplaces based on actual availability and value.
6. Keep AI-generated suggestions visibly separate from observed provider results and ground factual explanations in real evidence records.

For missing secrets/approvals, complete safe code and tests without pretending the provider works. Never search browser cookies, passwords, unrelated files or other repositories for credentials. Never bypass API controls or manufacture access.

### Step 5 — Verify
For every changed provider/UI:
- Add or update unit and contract tests for success, empty responses, malformed data, unauthorized access, rate limits and timeouts.
- If authorized credentials exist, run a real read-only test query and verify source URLs, timestamps, locale, units and semantics.
- Test provider partial failures and secret redaction.
- Run typecheck, lint, unit tests, production build and relevant security checks.
- Re-check the actual dashboard at desktop and mobile viewports.

Only report commands and outcomes that really occurred.

### Step 6 — Push every verified cycle
After each coherent, tested change:
1. Inspect the diff and ensure no secrets or unrelated changes are included.
2. Update progress/status/log docs.
3. Commit with a descriptive message.
4. Push to `main` without force-pushing.
5. Verify the remote commit SHA.
6. Report changed files, tests, preview, connected and blocked providers, and the commit link.

Never claim successful push/build/preview/test without evidence. If Cursor's current workspace cannot push, keep the local changes and report the exact Git error rather than claiming it was pushed.

## NEXT behavior

Whenever I type `NEXT`, repeat the same loop from the real repository state and choose the highest-priority unfinished task. Do not restart the project or respond with only a plan.

## Finish this run with
- API requirements matrix and checklist.
- Current live vs blocked provider status.
- Implemented code/tests for the next feasible feature.
- Real preview or reproducible launch instructions.
- Accurate progress docs.
- Verified GitHub commit SHA/link.
- The single most useful next action.

Do not stop just because some API keys or approvals are missing. Complete the work possible without them and give me exact, actionable steps for the remaining account-owner requirements.
