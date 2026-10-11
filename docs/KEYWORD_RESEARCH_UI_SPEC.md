# All-Platform Keyword Research Workspace — UI and Functional Specification

## Purpose

Use the user's supplied screenshot as the primary UX reference for the main keyword research workspace. The target is a dense, professional SEO research console, similar in information hierarchy to the reference: platform selector, unified search, market/language selectors, query-type tabs, summary metrics, historical charts, device breakdown where supported, and a sortable keyword table.

This is a design and implementation specification, not a claim that the UI or providers have already been built. Do not recreate the screenshot's numerical examples as product data.

## Core layout

### 1. Platform selector row

Create a compact row of branded platform buttons or icons. Include provider entries where useful:
- Google Search / Google Ads keyword planning
- Google Trends
- YouTube
- Bing
- Amazon (separate marketplace/region connectors)
- Flipkart
- Etsy
- eBay
- Google Play
- Instagram
- TikTok
- Pinterest
- X
- Reddit
- News/web search
- Shopify and WooCommerce connected stores
- A configurable “More sources” provider registry

Use official brand assets according to each brand's usage requirements; otherwise use a recognizable generic provider icon. The icon must communicate the source, not imply a connection. Use a visible state for selected, connected, access-required, disabled, and degraded providers. Provide accessible text labels and keyboard navigation.

Do not promise universal access. Every icon opens or selects an actual provider adapter. Unavailable providers remain selectable only to show setup requirements or are disabled with an explanation. Never pretend an adapter is connected when it is not.

### 2. Search controls

The main query bar should support:
- Seed keyword, phrase, brand, product or topic.
- Search scope: all enabled providers, selected providers, or one provider.
- Geography: worldwide where supported, country, and region when a provider supports region-level data.
- Language selection.
- Date range / trend window appropriate to each data source.
- Search and clear actions.
- Search history and saved searches.
- Search cancellation and keyboard submission.
- Optional advanced filters such as category, intent, minimum volume, trend direction, CPC range, competition, and marketplace.
- Provider coverage summary after every search.

The interface must explain when country, region, language, time range, or other filters cannot be applied to a selected source.

### 3. Keyword type tabs

Provide tabs matching the reference:
- Keyword Suggestions
- Questions
- Prepositions
- Related Keywords

Also include optional views:
- Autocomplete / Search Suggestions
- Long-tail Keywords
- Comparisons and “vs” queries
- Branded and non-branded terms
- Search Intent
- Topic Clusters
- Marketplace Keywords
- Recently Rising
- Seasonal Queries
- Competitor/Content Gaps (authorized/permitted evidence only)

The provider, generation method, and evidence type must be clear. Label direct provider results separately from AI-generated expansions. AI-generated terms are hypotheses until validated with a real data source.

### 4. Summary metric strip

Show metric cards appropriate to the current selected data source:
- Total keywords returned
- Total search volume (only if comparable provider-reported volume data exists; display measurement period and locale)
- Average / median volume where meaningful
- Trend direction and percentage change over an explicitly defined window
- CPC or advertising bid low/high range, with currency
- Competition metric and the source-specific competition definition
- Number of providers queried and successfully returned
- Data freshness / last updated time

Do not add incompatible provider metrics into a single “total volume.” If cross-provider figures are not comparable, show per-provider totals or clearly documented estimates. Do not use zero for missing metrics. If a metric is unsupported, show “Not provided by this source.”

### 5. Historical trend chart

Build an interactive time-series or bar chart:
- Source-reported historical values only.
- Period selector that respects the provider's available history.
- Hover details showing date, raw value, unit, provider, geography, and source record.
- Compare terms and sources where metrics are compatible.
- Indicate gaps, missing periods, normalization, and incomplete history.
- Accessible table fallback and export.
- Clear labels differentiating absolute search volume, relative interest index, listing counts, engagement counts, and estimates.

Do not fabricate months, fill missing periods with artificial values, or turn relative index data into absolute search counts.

### 6. Device distribution chart

Support desktop/mobile/tablet split only when a connected source actually provides a valid breakdown for the selected query and timeframe. If the provider does not offer this metric, hide the chart or display “Device breakdown unavailable from this source.” Do not copy illustrative slices from the reference image.

### 7. Keyword results table

Create a fast, keyboard-accessible, sortable, filterable table with selectable rows and bulk actions. Suggested columns, conditional on available data:
- Select
- Keyword
- Source/provider
- Search volume and reporting period
- Trend percentage and comparison window
- Sparkline / trend history
- CPC or top-of-page bid low range
- CPC or top-of-page bid high range
- Competition and its source-defined scale
- Keyword difficulty (from an identified licensed/permitted provider, or explicitly labeled estimate)
- Intent (AI-classified, optionally editable)
- Country / language
- Freshness
- Evidence / source link
- Actions

Keep column configuration user-editable. Show unavailable metrics as “—” with a tooltip explaining why. Provide sticky headers, pagination or virtualized rendering for large result sets, column visibility settings, and responsive alternatives for narrow screens.

Bulk actions:
- Add/remove from keyword list.
- Compare selected keywords.
- Group into topic clusters.
- Generate an evidence-backed content brief.
- Copy keywords.
- Export selected results to CSV/JSON and other formats only when implemented and tested.
- Add alerts or scheduled monitoring.
- Recheck provider freshness where allowed.

### 8. Filters, settings and export

Include a settings drawer for:
- Default country and language
- Preferred providers
- Default date range
- Metric display preferences
- Currency display
- Table columns
- Trend thresholds
- Keyword list behavior
- Cache/freshness preferences
- Export options
- AI provider selection and usage preferences
- Paid feature/usage status, when implemented

Filters must show active state, have a reset option, and be reflected in exported output. Exports must include source, metric definitions, locale, timeframe, fetched timestamp, and whether values are observed, derived, estimated, or AI-inferred.

### 9. AI analysis panel

Provide optional AI tools alongside, not instead of, source data:
- Explain why a keyword might be rising, referencing evidence.
- Expand seeds into semantically related terms.
- Cluster keywords by topic and intent.
- Compare countries, markets, or sources.
- Suggest article briefs, titles, FAQs and internal-link opportunities.
- Identify product/category opportunities for marketplaces.
- Explain uncertainty, conflicting evidence, coverage gaps and missing metrics.

Every AI factual claim about metrics or activity must cite actual retrieved records. Clearly mark suggestions as AI-generated. Do not let AI invent volume, CPC, ranking, demand, or competition.

### 10. Platform-specific metric semantics

Never normalize away source meaning:
- Google Ads keyword metrics: provider-reported historical search metrics and advertising bid/competition metrics, subject to API access and reporting definitions.
- Google Trends: relative interest and supported trend queries; not absolute search counts.
- YouTube: observable video/channel search and engagement fields the API actually returns; not platform-wide search volume unless directly available.
- Amazon/Flipkart/other marketplaces: only the product, catalog, affiliate, seller or keyword fields supported by the authorized connector.
- Social platforms: only eligible API/feed fields with correct time and coverage.
- Connected Shopify/WooCommerce accounts: store-owned catalog/analytics only according to authorized scopes.
- Search-result providers: returned results and supported metadata; no assumed private analytics.

Present separate source records. Only aggregate metrics when their meaning, unit, currency, timeframe and geography are compatible.

## Authenticity and connection states

Every provider must have an explicit status:
NOT_CONFIGURED, ACCESS_REQUIRED, CONNECTING, CONNECTED, DEGRADED, RATE_LIMITED, DISCONNECTED, ERROR or DISABLED.

Display provider responses, last successful test, last data fetch, error message, and available capabilities. Do not expose tokens or sensitive configuration in the UI.

Development fixtures must be visually labeled and isolated from production. Remove fixture-backed charts and table data from production query paths. A screenshot or static dashboard is not proof of functioning search.

## UX and accessibility requirements

- Match the screenshot's compact, data-dense SEO workflow, but improve clarity, spacing, responsiveness, keyboard support, and accessibility.
- Desktop: provider toolbar, query controls, query-type tabs, metric cards/charts, dense results table.
- Tablet: collapsible filters and horizontally scrollable/configurable table.
- Mobile: stacked metrics, compact charts, card/table toggle, filter drawer.
- Include loading skeletons, empty states, rate-limit states, provider-level partial errors, no-credentials states and stale-data notices.
- Keep chart text and table content readable at ordinary zoom.
- Do not use fake live counters or decorative controls that do nothing.
- Test keyboard navigation, focus, contrast, and responsive layouts.

## API contract suggestions

Use typed request and response schemas. A unified keyword search request should include:
- query
- selected provider IDs
- geography and language
- date range
- query category (suggestions/questions/prepositions/related/etc.)
- supported filters
- page/cursor
- requested metrics

The response should include:
- normalized result records
- original provider result IDs and source URLs
- provider status and per-provider errors
- metric definitions and units
- requested vs applied filters
- pagination/cursor
- observedAt and fetchedAt timestamps
- data-quality and comparability flags
- data type: observed, derived, estimated, or AI-inferred

Use partial-result semantics. One failed provider must not erase successful results from other providers.

## Acceptance criteria

The feature is not complete until:
1. The UI closely follows the supplied screenshot's functional information hierarchy.
2. Search submits a real query to each enabled and authorized provider.
3. Connected providers are distinguished from merely configured providers.
4. Results are sourced and timestamped, with honest missing-data states.
5. Suggestions, questions, prepositions and related keywords are distinguishable by source/method.
6. Table sorting, filters, row selection, copy and implemented exports work.
7. Charts show only supported observations and accurate units.
8. Search works when one or more providers fail, returning successful providers' partial results.
9. AI analysis references actual evidence and labels unverified suggestions.
10. Desktop and mobile previews are verified.
11. Unit, contract, integration and end-to-end tests pass for enabled functionality.
12. Progress docs record exactly which providers have live verification and which require credentials/approval.

## Implementation priority

1. Create the screenshot-guided dashboard layout and responsive components using clearly labeled empty states.
2. Create common provider contracts and provider connection/status UI.
3. Add one real keyword data connector after access is verified.
4. Wire search, keyword-type tabs, filtering, sorting and source evidence to real results.
5. Add charts with actual compatible historical data.
6. Add the remaining eligible provider adapters incrementally.
7. Add AI analyses with evidence constraints.
8. Add exports, saved lists, alerts and paid entitlements.
9. Test responsive behavior, accessibility, security and live integration.
10. Commit/push each verified development cycle, show the real preview, and update progress records.
