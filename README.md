# Ecom SEO — Trend Intelligence AI

A modular project for a Chrome extension and web platform for verified trend discovery, SEO keyword research, and e-commerce product intelligence.

## Development workflow

This repository is the source of truth. Every meaningful implementation change must be committed and pushed to this repository as part of the development cycle.

### Required loop for every change

1. Inspect the current repository state and read `BUILD_PROGRESS.md`, `FEATURE_STATUS.md`, `IMPLEMENTATION_LOG.md`, and `ARCHITECTURE.md` when present.
2. Choose one coherent change that builds on the current state.
3. Implement it without discarding existing user work.
4. Run relevant unit tests, type checks, linting, integration tests where credentials are available, and a production build.
5. Run the application or extension and show a real preview, screenshot, local URL, or reproducible test evidence. A screenshot alone is not proof that functionality works.
6. Fix regressions and report unresolved limitations honestly.
7. Update progress and feature-status documentation.
8. Review the diff for secrets, credentials, generated artifacts, and unrelated changes.
9. Commit and push the verified change to this GitHub repository. Prefer small, descriptive commits. Do not force-push or overwrite other work.
10. Report the commit SHA, changed files, checks actually run, preview details, and the next logical task.

Do not claim a push, test, deployment, or preview succeeded unless it has been verified. If remote Git access or the runtime is unavailable, explain the blocker and provide the unpushed changes or commands needed to resume.

## Special command: NEXT

When the user says **NEXT**, resume from the actual repository state and progress documents. Continue the highest-priority incomplete feature or fix. Do not start over, repeat completed work, or respond with only a plan when code changes are possible.

For each NEXT cycle: implement, test, launch or refresh the preview, update progress, and commit/push the verified change. Do not wait for a separate reminder to update GitHub.

## Product principles

- Only present real provider results as live data. Clearly label fixtures, estimates, derived metrics, and AI hypotheses.
- Preserve source URLs, observation times, retrieval times, geographic context, metric definitions, and provider errors.
- Use official APIs, authorized access, and permitted feeds; respect quotas, licenses, privacy, and data retention policies.
- Keep provider adapters modular so new marketplaces and services can be added without rewriting unrelated modules.
- Keep API secrets on the server and out of the extension, repository, screenshots, and logs.
- Keep the application runnable. Use feature flags and clear unavailable states for integrations that need credentials or approvals.
- The extension must follow Chrome Manifest V3 and Chrome Web Store policies; do not execute arbitrary remote code.
- Support self-hosted deployment through documented environment configuration, health checks, backups, migrations, and recovery procedures.
- Make paid features enforceable by server-side entitlements, not frontend-only switches.

## Running locally

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # then set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev                  # http://localhost:3000
npm run check                # typecheck, lint, unit tests, production build
npm run secrets:scan
```

## Project status

See `BUILD_PROGRESS.md` and `FEATURE_STATUS.md` for what is implemented and verified. Provider integrations are only marked connected after a live test with authorized credentials.


## Automatic requirements discovery prompt

Use [docs/AUTO_REQUIREMENT_DISCOVERY_PROMPT.md](docs/AUTO_REQUIREMENT_DISCOVERY_PROMPT.md) to research official API requirements, access rules, authentication, cost, quotas, and environment-variable needs. It directs the agent to implement viable connectors incrementally and document what still needs account-owner approval.
