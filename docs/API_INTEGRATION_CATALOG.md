# API Integration Catalog — Trend Intelligence AI / Ecom SEO

Updated: 2026-10-11

This catalog lists official API and documentation entry points for the screenshot-guided keyword research workspace and e-commerce research modules. It is an integration register, not a statement that credentials, approvals, quotas, or APIs are available. Confirm current access terms and capabilities before coding each adapter.

## Critical data rules

1. **No single API gives every metric across every platform.** Keyword volume/CPC/competition, Google Trends relative interest, public content counts, marketplace catalog search, seller-only analytics, and store-owned analytics are different data products.
2. A documentation URL is not an unauthenticated direct API call. Most API calls need OAuth, API keys, request signatures, seller/affiliate registration, application approval, required headers, region/marketplace parameters, quotas, and sometimes billing.
3. Store secrets server-side. Do not commit tokens, OAuth client secrets, Seller/Affiliate tokens, DataForSEO credentials, OpenAI keys, or private database credentials.
4. Only mark a provider CONNECTED after a real authenticated health/query request succeeds. Keep ACCESS_REQUIRED, NOT_CONFIGURED, RATE_LIMITED, DEGRADED and DISABLED states truthful.
5. Do not infer search volume from page views, video views, social engagement, number of listings, or Google Trends' relative 0–100-style values.
6. Verify provider licensing, attribution, caching, retention and commercial resale rules before exposing data to paying customers.

## 1. Best APIs for screenshot-style keyword metrics

### A. Google Ads API — primary source for Google keyword planning
- Docs / overview: https://developers.google.com/google-ads/api/docs/keyword-planning/overview
- Keyword ideas: https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas
- Historical metrics: https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics
- Access levels: https://developers.google.com/google-ads/api/docs/productionize/access-levels
- OAuth: https://developers.google.com/google-ads/api/docs/oauth/overview
- Cloud setup: https://developers.google.com/google-ads/api/docs/oauth/cloud-project
- REST operation pattern (version is a placeholder and must match the supported API version):
  - `POST https://googleads.googleapis.com/vXX/customers/{CUSTOMER_ID}:generateKeywordIdeas`
  - `POST https://googleads.googleapis.com/vXX/customers/{CUSTOMER_ID}:generateKeywordHistoricalMetrics`
- Provides: Google keyword ideas, average monthly search metrics, monthly history, competition fields and top-of-page bid ranges where returned.
- Requires: Google Cloud project, OAuth credentials, Google Ads developer token, appropriate API access level, and customer/account context. Check current quota and permissible-use requirements. Do not hard-code an old API version.

### B. Official Google Trends API
- Access / alpha information: https://developers.google.com/search/apis/trends
- Announcement: https://developers.google.com/search/blog/2025/07/trends-api
- Provides relative search interest and related topics/queries when access is granted.
- Access is limited to approved alpha testers according to the published program. Do not assume production access. Trends interest is not absolute search volume.

### C. Google Trends public feeds for daily trending searches
- Trends UI: https://trends.google.com/trending
- RSS pattern used for a country feed (test actual feed response and availability): `https://trends.google.com/trending/rss?geo=IN`
- Useful for current/rising trend discovery, not complete keyword metrics or CPC. Preserve the approximate traffic bucket as provided.

### D. DataForSEO — paid aggregation option
- API overview: https://docs.dataforseo.com/
- Keyword Data overview: https://docs.dataforseo.com/v3/keywords-data-overview/
- Google Ads search volume endpoint: https://docs.dataforseo.com/v3/keywords_data-google_ads-search_volume-live/
- Google keyword ideas endpoint: https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live/
- Google Trends Explore endpoint: https://docs.dataforseo.com/v3/keywords_data-google-trends-explore-live/
- Google organic SERP endpoint: https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/
- Amazon Merchant API: https://docs.dataforseo.com/v3/merchant-amazon-overview/
- Endpoint examples in the current docs include:
  - `POST https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live`
  - `POST https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live`
  - `POST https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live`
  - SERP endpoint path: `/v3/serp/google/organic/live/advanced`
- Requires account credentials and paid usage. Check current endpoint pricing and country/language coverage. It is one candidate for reducing the number of individually maintained data vendors, but does not mean it has every marketplace's internal search-volume data.

### E. Semrush SEO API
- API v4 overview: https://developer.semrush.com/api/v4/seo/overview/
- Keyword reports: https://developer.semrush.com/api/v4/seo/keyword-reports/
- Can return supported keyword metrics such as search volume, difficulty, intent, CPC/competition and SERP features.
- Requires a suitable Semrush subscription/API access. API v4 is described as Early Access in the current docs; verify status and pricing before implementing. Older v3 keyword reports are deprecated for new integrations.

### F. Ahrefs API
- API docs: https://docs.ahrefs.com/
- Site Explorer API reference: https://docs.ahrefs.com/en/api/reference/site-explorer
- Use only the specific API features included in the account plan and currently supported. Do not treat all Ahrefs web-app functions as automatically available in the API.

### G. Microsoft Advertising API — Bing keyword planner/ads metrics
- Keyword ideas and traffic estimates: https://learn.microsoft.com/en-us/advertising/guides/keyword-ideas-traffic-estimates?view=bingads-13
- Ad Insight operations: https://learn.microsoft.com/en-us/advertising/ad-insight-service/ad-insight-service-operations?view=bingads-13
- Provides Microsoft Advertising keyword ideas and historical/estimated metrics, including search counts, suggested bids/CPC and traffic estimates where available.
- Requires developer registration, OAuth and a Microsoft Advertising account context. Values describe its supported advertising data, not all Bing searches.

### H. Bing Webmaster API
- Current overview: https://learn.microsoft.com/en-us/bingwebmaster/
- Useful for keyword/rank/traffic/indexing details about the user's own registered/verified websites.
- Not a general public keyword volume provider for any arbitrary keyword.
- The official documentation warns that legacy SOAP/POX APIs are scheduled for retirement in 2026; use current REST documentation instead of building a new SOAP integration.

### I. Google Search Console API
- Query Search Analytics: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- Direct request pattern:
  `POST https://www.googleapis.com/webmasters/v3/sites/{URL_ENCODED_SITE_URL}/searchAnalytics/query`
- Requires OAuth authorization for a verified property. Returns that site's query/click/impression/position data within API limits; not universal search-volume data for competitors.

### J. SERP data provider alternative
- SerpApi Google Trends: https://serpapi.com/google-trends-api
- SerpApi general search API: https://serpapi.com/search-api
- Paid third-party provider; verify current plan, returned fields, supported regions, rate limits and permitted use.

## 2. Amazon APIs

### A. Amazon Creators API (affiliate product discovery)
- India SearchItems: https://affiliate-program.amazon.in/creatorsapi/docs/en-us/api-reference/operations/search-items
- API introduction and prerequisites: https://affiliate-program.amazon.in/creatorsapi/docs/en-us/introduction
- All operations: https://affiliate-program.amazon.in/creatorsapi/docs/en-us/api-reference
- Operations: SearchItems, GetItems, GetVariations, GetBrowseNodes.
- Can search product items and return supported item information, images, offers and refinements.
- Requires Associates Program enrollment for the target marketplace, API registration/credentials and current qualifying/access criteria. The API returns a limited set per request and is not a source for universal Amazon keyword volume or seller analytics.

### B. Amazon Selling Partner API (SP-API) — seller-authorized catalog and business data
- Developer documentation: https://developer-docs.amazon.com/sp-api/
- Search Catalog Items guide: https://developer-docs.amazon.com/sp-api/docs/search-catalog-items
- Search Catalog Items reference: https://developer-docs.amazon/sp-api/reference/searchcatalogitems-1
- Manage product listings: https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/manage-product-listings-guide
- Competitive summary pricing operation: https://developer-docs.amazon/sp-api/lang-en_US/reference/getcompetitivesummary
- Product fee estimate guide: https://developer-docs.amazon.com/sp-api/docs/get-product-fee-estimates-asin
- Typical operation families to evaluate:
  - Catalog Items API: catalog lookup/search, identifiers, attributes, variations and supported sales-rank fields.
  - Product Pricing API: eligible competitive offer summaries/pricing signals.
  - Listings Items API: the authorized seller's listing content/status.
  - Reports API: reports available to the authorized selling partner.
  - Product Fees API: seller-specific fee estimates.
- Requires SP-API application registration, seller authorization, assigned developer roles/scopes and region-appropriate endpoint/marketplace configuration. Seller reports are for the authorizing seller, not all Amazon sales.
- Do not copy a North America host into the India marketplace adapter. Derive the correct region endpoint from current SP-API documentation.

## 3. Flipkart APIs

### A. Flipkart Affiliate API — keyword product search and offers
- Overview: https://affiliate.flipkart.com/api-docs/af_overview.html
- Product API reference: https://affiliate.flipkart.com/api-docs/af_prod_ref.html
- Documented v1.0 example endpoint:
  `GET https://affiliate-api.flipkart.net/affiliate/1.0/search.json?query={URL_ENCODED_QUERY}&resultCount=10`
- Required request headers in the docs:
  - `Fk-Affiliate-Id: {AFFILIATE_ID}`
  - `Fk-Affiliate-Token: {AFFILIATE_API_TOKEN}`
- Search returns at most 10 products per request in the documented endpoint. Confirm current affiliate account/API availability before coding because some documentation routes are marked for deprecation or migration.
- Can return eligible products/offers and affiliate-related reports; it does not expose arbitrary marketplace keyword volumes or all seller internals.

### B. Flipkart Seller API
- Official docs: https://seller.flipkart.com/api-docs/index.html
- Supports seller-authorized listing/product management, fulfillment, orders, returns and related seller workflows.
- Requires seller registration, application setup, access/refresh tokens and seller authorization.
- Do not use this as a public marketplace-wide keyword API.

## 4. Other marketplace product/catalog APIs

### eBay Browse API
- Docs: https://developer.ebay.com/api-docs/buy/static/api-browse.html
- Overview: https://developer.ebay.com/develop/api/buy/browse_api
- Search endpoint pattern: `GET https://api.ebay.com/buy/browse/v1/item_summary/search?q={URL_ENCODED_QUERY}`
- Application access token required. Some production Buy API capabilities are partner/limited-release controlled; production approval is not guaranteed.

### Etsy Open API v3
- Listing tutorial: https://developers.etsy.com/documentation/tutorials/listings/
- Authentication: https://developers.etsy.com/documentation/essentials/authentication/
- Requires API key; OAuth is also required for private user data and scoped operations. Marketplace-wide access depends on the approved access level. Do not assume all listing endpoints are open.

### Walmart Marketplace API
- Item Search reference: https://developer.walmart.com/us-marketplace/reference/getsearchresult
- Global marketplace reference: https://developer.walmart.com/global-marketplace/reference/getsearchresult
- Documented endpoint example: `GET https://marketplace.walmartapis.com/v3/items/walmart/search`
- Requires the applicable Marketplace API authorization/account. Verify that the intended seller/partner use case is eligible before integrating.

### TikTok Shop Open API
- Partner Center docs: https://partner.tiktokshop.com/docv2
- Search Products operation: https://partner.tiktokshop.com/docv2/page/search-products-202309
- Documented path: `POST /product/202309/products/search`
- Requires the appropriate seller/shop authorization and fields such as the authorized shop identifier; this is not a general public TikTok trending-keyword API.

### AliExpress
- Official developer portal: https://open.aliexpress.com/
- Investigate currently available affiliate/partner product APIs and application requirements. Do not depend on unofficial endpoint copies or seller scraping if the approved API does not offer a capability.

### Lazada
- Official Open Platform: https://open.lazada.com/
- Access and available APIs depend on region, partner app and seller authorization.

### Meesho, Myntra, AJIO and JioMart
- Do not assume unrestricted public product-search APIs are available.
- Seek current official seller/partner/affiliate API access or a licensed provider with explicit rights for the intended use.
- If no approved source is available, keep the connector ACCESS_REQUIRED or DISABLED and document the limitation. Do not invent API endpoints.

## 5. Your own e-commerce stores and feeds

### Shopify Admin GraphQL API
- Product query: https://shopify.dev/docs/api/admin-graphql/latest/queries/products
- Authentication: https://shopify.dev/docs/apps/build/authentication-authorization
- Access scopes: https://shopify.dev/docs/apps/build/authentication-authorization/manage-access-scopes
- Request pattern:
  `POST https://{SHOP}.myshopify.com/admin/api/{SUPPORTED_VERSION}/graphql.json`
- Requires merchant installation/authorization and appropriate scopes, e.g. product read access. It accesses the connected store, not every Shopify store on the internet.

### WooCommerce REST API v3
- API docs: https://developer.woocommerce.com/docs/apis/rest-api/v3/
- Setup and keys: https://woocommerce.com/document/woocommerce-rest-api/
- Authenticated product endpoint:
  `GET https://{STORE_DOMAIN}/wp-json/wc/v3/products`
- Public Store API product docs: https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/products/
- Store API pattern:
  `GET https://{STORE_DOMAIN}/wp-json/wc/store/v1/products`
- REST API keys grant store permissions. Store API only exposes supported public product data and must not be used to retrieve private orders/customer information.

### Google Merchant API
- Overview: https://developers.google.com/merchant/api/overview
- Manage products: https://developers.google.com/merchant/api/guides/products/overview
- Product API manages the connected Merchant Center account's own product catalog, data sources and product issues. It is not a universal Google Shopping catalog search API.

## 6. Video, social and community trend sources

### YouTube Data API v3
- Search list: https://developers.google.com/youtube/v3/docs/search/list
- Videos list: https://developers.google.com/youtube/v3/docs/videos/list
- Search endpoint pattern:
  `GET https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q={QUERY}&key={API_KEY}`
- Requires Google Cloud project and API key or authorized OAuth where required, and subject to quota. It returns eligible videos/channels/playlists and metadata, not universal YouTube search volume.
- If using Google Trends for YouTube interest, label it as relative interest.

### TikTok for Developers
- Products and docs: https://developers.tiktok.com/doc/
- Display API overview: https://developers.tiktok.com/docs/en/display-api-overview
- Research API information: https://developers.tiktok.com/products/research-api/
- Display API is for displaying authorized creator profiles/videos; Research API has eligibility/use restrictions. Neither should be assumed to provide a commercial all-keyword popularity API.

### Pinterest API v5
- Official introduction: https://developers.pinterest.com/docs/api/v5/introduction/
- Offers selected content, ads, analytics and targeting endpoints, including certain trending-keyword capabilities subject to the API product, permissions and account access. Confirm each endpoint's currently available scope.

### Instagram Graph API
- Instagram Platform: https://developers.facebook.com/docs/instagram-platform/
- Hashtag Search reference: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag-search/
- Requires a compatible professional account, app configuration, permissions and review where required. Hashtag/content discovery is limited by Meta's supported endpoints and rules; it is not a public global Instagram keyword-volume endpoint.

### X API
- Official docs: https://docs.x.com/
- Search posts introduction: https://docs.x.com/x-api/posts/search/introduction
- Search endpoints return posts matching supported queries and access windows. They do not automatically provide global keyword search volume. Check current product tier, costs and access window before enabling.

### Reddit API
- API reference: https://www.reddit.com/dev/api/
- Developer documentation: https://developers.reddit.com/docs/
- Data API terms: https://redditinc.com/policies/data-api-terms
- Requires an eligible application/OAuth and adherence to developer/data terms, rate limits and applicable data deletion/retention requirements.

### News and public discussion
- GDELT Project and API resources: https://www.gdeltproject.org/
- GDELT query API example pattern: `https://api.gdeltproject.org/api/v2/doc/doc?query={URL_ENCODED_QUERY}&format=json`
- News/API or RSS sources are for reports/discussions, not search volume. Track article timestamps, source URL, language/region fields and deduplicate syndicated coverage.

## 7. Other optional APIs for the product

### OpenAI API (AI keyword expansion and explanation)
- API documentation: https://platform.openai.com/docs/api-reference
- Responses API: https://platform.openai.com/docs/api-reference/responses
- Keep API keys only on the server, apply per-user budgets/rate limits, and require evidence IDs for factual explanations. AI-generated keyword ideas must be labelled separately from provider observations.

### Supabase
- SSR client setup: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- REST/Data API docs: https://supabase.com/docs/guides/api
- Auth, database and storage are separate health checks. A reachable project URL does not prove that a particular table exists or that the current user is authorized.
- Use publishable keys in public clients only alongside correct RLS. Never expose service-role or secret keys.

### Billing (only when monetizing)
- Razorpay APIs: https://razorpay.com/docs/api/
- Razorpay Subscriptions: https://razorpay.com/docs/api/payments/subscriptions/
- Stripe API: https://docs.stripe.com/api
- Verify current eligibility for the business and country. Verify webhook signatures server-side; never grant an entitlement merely because the browser returned from a checkout page.

## 8. Suggested environment-variable names

Add only when a specific connector is implemented. Never commit real values.

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Google Ads API (OAuth and developer token are separate credentials)
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=

# YouTube / Google OAuth as required
YOUTUBE_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Data providers
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
SEMRUSH_API_KEY=
AHREFS_API_KEY=
SERPAPI_API_KEY=
MICROSOFT_ADS_CLIENT_ID=
MICROSOFT_ADS_CLIENT_SECRET=
MICROSOFT_ADS_DEVELOPER_TOKEN=

# Amazon — use the exact credential scheme documented for the selected API
# Implemented names (Associates Central calls these Credential ID / Secret / Version)
AMAZON_CREATORS_CREDENTIAL_ID=
AMAZON_CREATORS_CREDENTIAL_SECRET=
AMAZON_CREATORS_CREDENTIAL_VERSION=
AMAZON_PARTNER_TAG=
AMAZON_MARKETPLACE=
AMAZON_SP_API_CLIENT_ID=
AMAZON_SP_API_CLIENT_SECRET=
AMAZON_SP_API_REFRESH_TOKEN=

# Flipkart
FLIPKART_AFFILIATE_ID=
FLIPKART_AFFILIATE_TOKEN=
FLIPKART_SELLER_CLIENT_ID=
FLIPKART_SELLER_CLIENT_SECRET=

# Other eligible marketplace connectors
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
ETSY_API_KEY=
ETSY_SHARED_SECRET=
WALMART_CLIENT_ID=
WALMART_CLIENT_SECRET=
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
WOOCOMMERCE_CONSUMER_KEY=
WOOCOMMERCE_CONSUMER_SECRET=
TIKTOK_SHOP_APP_KEY=
TIKTOK_SHOP_APP_SECRET=
PINTEREST_ACCESS_TOKEN=
X_BEARER_TOKEN=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
META_APP_ID=
META_APP_SECRET=
OPENAI_API_KEY=

# Billing, only when implemented
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

The exact required names must match the implementation and current provider OAuth flow. This list intentionally contains placeholders, not supplied secrets. Some APIs use different credentials for different regions or application types. OAuth tokens should be encrypted and stored per connected customer where appropriate rather than relying on one global token.

## 9. Recommended integration order for this project

### Phase 1 — Get real keyword metrics
1. Google Ads API: keyword ideas + historical metrics (best native source for Google monthly search metrics, bid ranges and competition, subject to access).
2. DataForSEO Google keyword/Trends/SERP APIs OR Semrush API as a paid alternative/backup. Compare cost, country coverage, permitted use and licensing first; do not wire every paid provider before measuring the need.
3. Google Trends alpha if access is approved; otherwise use the documented RSS trend feed or an approved provider's Trends endpoint, clearly label method and metric semantics.
4. Search Console for the user's own verified website queries.
5. Microsoft Advertising Ad Insight and Bing Webmaster for their respective supported use cases.

### Phase 2 — Product search and e-commerce
1. Amazon Creators API if the account meets current Associates/access requirements.
2. Flipkart Affiliate API after confirming that the account and current endpoint access are eligible; add Seller API only for authorized sellers.
3. eBay Browse API, Etsy and Walmart only after their application/production eligibility is verified.
4. Shopify/WooCommerce and Merchant Center as merchant-authorized store connections.
5. TikTok Shop only for supported seller-authorized operations.
6. Add more Indian marketplaces only when a verifiable official/partner API or licensed data contract exists.

### Phase 3 — Social, video and news
1. YouTube Data API.
2. Reddit/X/Pinterest/Instagram/TikTok only after access, billing and policy verification.
3. GDELT/news sources for news-driven topic discovery.

### Phase 4 — AI and monetization
1. OpenAI or a replaceable model adapter for evidence-based keyword expansion.
2. Supabase Auth + RLS-backed persistence for per-user saved searches.
3. Razorpay/Stripe only when subscription billing is implemented and approved.

## 10. Acceptance checks for every API adapter

Before a provider can be marked CONNECTED:
- Documentation and terms were checked on the official provider site.
- The correct region, version, endpoint, authentication method and scopes are configured.
- A real authenticated test request succeeds in the deployed/test environment.
- Response schemas and required fields are validated.
- Rate limits, error handling, timeouts and retries are implemented.
- Source URLs, units, metric definitions and timestamps are retained.
- Missing or restricted fields remain missing, not synthesized.
- Pricing, quotas, data retention and commercial display rights are documented.
- Test fixtures remain separate from live results.
- The integration is recorded in `FEATURE_STATUS.md` with the actual verification evidence.

No API in this catalog is automatically activated by being listed here.
