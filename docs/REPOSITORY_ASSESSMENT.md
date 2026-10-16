# Phase 0 — Repository Assessment

**Date:** 2026-10-16  
**Repository:** https://github.com/tarikk786786/ecom-seo  
**Branch:** `main` (clean working tree at assessment start)  
**Workspace clone:** `MY SEO TOOL` (local)

## Current state

| Area | Finding |
|---|---|
| Layout | npm workspaces monorepo; only `apps/web-dashboard` implemented |
| Runtime | Node ≥20.9; local Node v24.15.0 |
| App | Next.js 16.4 App Router, React 19.3, TypeScript 5.9, Tailwind 4.3 |
| Auth / DB host | Supabase SSR (`@supabase/ssr`); publishable key only |
| Persistence | Keyword saved searches/lists in browser `localStorage`; **no Postgres migrations applied** |
| Domain focus today | All-platform keyword & trend research workspace |
| Tests | Vitest unit/contract tests for keywords, providers, auth, connect, env |
| CI | Not present |
| Chrome extension / workers / packages/* | Planned in ARCHITECTURE.md; not started |
| Local `.env.local` | Absent in this workspace clone |

## Architecture (as implemented)

```
apps/web-dashboard
  app/          pages + API routes (keywords, connect, health, auth)
  components/   keyword workspace, connect UI, nav
  lib/keywords/ provider adapters, search orchestration, view/export
  lib/connect/  credential catalog + local .env.local writer
  utils/supabase/ SSR clients + session proxy
```

Provider adapters are modular. Public sources (Wikipedia, Stack Exchange, HN, Google Trends RSS, GDELT) can run without keys. Credentialed adapters exist but stay `NOT_CONFIGURED` until live checks pass.

## Baseline checks (pre-change)

| Check | Status at Phase 0 |
|---|---|
| `npm install` | Required before first run in this clone |
| typecheck / lint / test / build | Deferred to Phase 1 verification after install |
| Secrets in repo | `.env.example` placeholders only; `secrets:scan` script present |
| Pre-existing failures | None known from prior docs; this clone had no `node_modules` |

## Gap vs Product Ranking Intelligence PRD

| Capability | Status |
|---|---|
| Product catalog + CSV import/export | Missing → Phase 1 target |
| Normalized DB schema / migrations | Missing → Phase 1 target |
| Product–keyword mapping | Missing → Phase 1 (basic) |
| Google Search Console | Not started (Phase 2) |
| Rank observation store | Not started (Phase 3) |
| Marketplace seller connectors | Documented / adapters partial; live blocked on credentials |
| Opportunity scoring / SEO audit engine | Not started (Phase 5) |
| Scheduled jobs / alerts | Not started (Phase 6) |

## Risks

1. **Scope collision:** Existing product is trend/keyword research; Ranking Intelligence must extend it, not replace the working workspace.
2. **No applied schema:** Supabase project has no product tables; migrations need owner approval to apply.
3. **Credentials:** GSC, Ads, marketplaces blocked without authorized keys.
4. **Tailwind 4 / InsForge notes:** Repo already uses Tailwind 4 + Supabase; do not migrate to InsForge/Tailwind 3.4 unless explicitly requested.
5. **Free-data limits:** Search volume, difficulty, and many marketplace rankings are unavailable without paid/authorized APIs—must stay labelled.

## Assumptions (conservative)

- Keep Next.js + Supabase + existing keyword module.
- Phase 1 products persist in a **server-side local JSON store** until Supabase migrations are applied by the owner; store backend is swappable.
- Do not fabricate ranking or volume metrics.
- Do not commit or print secrets.

## Next steps

1. Document Ranking Intelligence PRD overlay and checklist classification.
2. Implement Phase 1: product/keyword models, migration SQL, CSV import/export, product management UI + API, tests.
3. Run `npm run check` and report honest results.
4. Phase 2+ only after Phase 1 is verified.
