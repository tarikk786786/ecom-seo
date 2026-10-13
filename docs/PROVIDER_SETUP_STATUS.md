# Provider Setup Status

Updated: 2026-10-13. States in section 1 come from the live check at `GET /api/keywords/providers` run on that date; everything else is from official documentation. Environment variable names only — never values.

## 1. Adapters in the app

| Provider | What it gives an ecommerce seller | Env variables | Live state (2026-10-13) | What is needed next |
|---|---|---|---|---|
| DataForSEO (Google Ads data) | Google monthly search volume, CPC, competition, 12-month history | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | **Connected** | Paid per call from the account balance. Off by default; select it in the workspace when needed. |
| Google Trends (trending now RSS) | Searches trending today in a country | none | **Connected** | — |
| Wikipedia | Article pageview history as a demand signal | none | **Connected** | — |
| Stack Exchange | Real buyer questions (product troubleshooting) | none | **Connected** | Off by default. Unauthenticated quota is per IP. |
| News (GDELT) | News coverage timeline and headlines | none | Error: network error at check time (frequent 429s otherwise) | Nothing to configure; provider is unreliable. |
| Amazon (Creators API) | Amazon product titles and offer prices | `AMAZON_CREATORS_CREDENTIAL_ID`, `AMAZON_CREATORS_CREDENTIAL_SECRET`, `AMAZON_PARTNER_TAG` (set), `AMAZON_MARKETPLACE`, `AMAZON_CREATORS_CREDENTIAL_VERSION` | Not configured (2 of 3 required missing) | Creators API credentials from Associates Central. Per the owner's notes, Amazon requires qualifying sales before API access. |
| Flipkart Affiliate | Flipkart product titles and prices (max 10 per query) | `FLIPKART_AFFILIATE_ID`, `FLIPKART_AFFILIATE_TOKEN` | Not configured | Per the owner's notes, new public affiliate sign-ups are closed. Only an existing affiliate account can supply these. |
| eBay Browse | eBay listing titles, total matching listings, prices | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | Not configured | Developer account under review; then create a production keyset. |
| Etsy Open API v3 | Etsy listing titles, total listings, favorites, prices | `ETSY_API_KEY`, `ETSY_SHARED_SECRET` | Not configured | Create an app at developers.etsy.com in a normal browser session. |
| YouTube Data API v3 | Product video titles and view/like/comment counts | `YOUTUBE_API_KEY` | Not configured | Google Cloud project, enable YouTube Data API v3, create a server API key. Free 10,000 units/day; each search costs 100. |
| Google Ads Keyword Planner | Google search volume, CPC, competition (free with an Ads account) | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, optional `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Not configured | Manager account, developer token with Basic access, OAuth client and refresh token. Overlaps with DataForSEO. |
| Reddit | Discussion titles and engagement | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | Not configured | Create a script app. Commercial use needs a separate agreement with Reddit. |
| OpenAI (AI keyword expansion) | Extra keyword ideas, labelled unverified | `OPENAI_API_KEY`, `OPENAI_MODEL` | Key present; route reports configured (not exercised in this check) | Usage-based billing. |
| Supabase | Sign-in and account storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Configured | — |

## 2. Ecommerce data sources not built yet

| Source | What it adds | Requirements | Cost | Notes |
|---|---|---|---|---|
| DataForSEO Labs — Amazon bulk search volume (`POST /v3/dataforseo_labs/amazon/bulk_search_volume/live`) | Approximate monthly **Amazon** search volume, up to 1,000 keywords per request | Existing DataForSEO credentials | $0.012 per request + $0.00012 per keyword ([pricing](https://dataforseo.com/pricing/dataforseo-labs/dataforseo-amazon-api)) | Highest-value addition: Amazon demand without seller approvals. Estimates from DataForSEO's database, not Amazon itself. |
| Amazon SP-API Brand Analytics — Search Terms report (`GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT`) | Amazon search frequency rank, top clicked ASINs, click and conversion share | Seller/vendor in Amazon Brand Registry, brand representative, SP-API app with the Brand Analytics role ([docs](https://developer-docs.amazon.com/sp-api/docs/report-type-values-analytics)) | Free | First-party Amazon data, but ranks rather than volumes. Placeholders: `AMAZON_SP_API_*`. |
| Amazon Ads API — keyword recommendations (`POST /sp/targets/keywords/recommendations`) | Keyword suggestions for your ASINs with suggested bids | Amazon Ads advertiser account and Ads API access | Free | No search volume. |
| Google Search Console | Clicks, impressions, CTR, position for your own store site | OAuth with `webmasters.readonly`, verified property | Free | Own-site data only. |
| Walmart, Pinterest, Meta, Microsoft Ads, X, Semrush, Keyword Tool | Varies | See `docs/API_REQUIREMENTS_MATRIX.md` | Several are paid | Placeholders already in `.env.example`. |

## 3. Suggested order

1. Amazon search volume via DataForSEO Labs (uses credentials already present; needs approval to spend credits on live calls).
2. YouTube API key (free, quick).
3. eBay keyset once the review clears; Etsy app.
4. Google Ads Keyword Planner if a free alternative to DataForSEO volume is wanted.
