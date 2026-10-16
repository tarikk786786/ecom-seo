# API credentials setup guide

Each provider below has an adapter in this repository. It stays `NOT_CONFIGURED` until you add the credentials. Put values only in the repository-root `.env.local`, which git ignores. For deployments, use the hosting platform's secret manager. Never use a `NEXT_PUBLIC_` prefix for these values.

After editing `.env.local`, rebuild and restart (`npm run build --workspace apps/web-dashboard`, then `npm start --workspace apps/web-dashboard`). Then open the dashboard. A provider shows **CONNECTED** only after its live check makes a real authorised request.

None of these steps can be automated by the agent. Each one needs you to sign in, accept terms, or wait for approval.

## Google Search Console (own-site queries, clicks, impressions, average position)

Own verified properties only. This does not expose competitors’ private data.

1. In Google Cloud Console, create or pick a project and enable the **Google Search Console API**.
2. Create an OAuth client (Desktop or Web). Note the client ID and secret.
3. Generate a refresh token for a Google account that has access to the Search Console property, using scope `https://www.googleapis.com/auth/webmasters.readonly` (OAuth Playground with your own client is fine for local setup).
4. Set in `.env.local`:
   - `GSC_CLIENT_ID`
   - `GSC_CLIENT_SECRET`
   - `GSC_REFRESH_TOKEN`
   - `GSC_SITE_URL`: URL-prefix property (`https://www.example.com/`) or domain property (`sc-domain:example.com`)
5. Open **SEO intelligence** (`/seo`). State becomes **CONNECTED** only after a live `sites.list` call succeeds and the configured property appears.
6. Until credentials exist, the page shows an honest setup state and `/api/gsc/query` returns HTTP 503 with the missing variable names—never fabricated rows.

Average position from Search Console is a property-level aggregate, not a personalized SERP rank for every user.

## Google Ads API (search volume, CPC, competition)

1. Use a Google Ads **manager account** (MCC) and open *Admin → API Center*. Accept the API terms; this issues a developer token at Test Account or Explorer level.
2. Apply for **Basic access** in the API Center (about 5 business days). Choose the use case "Researching keywords and recommendations". Keyword planning endpoints do not work with Test Account or Explorer access.
3. In Google Cloud Console, enable the *Google Ads API*. Create an OAuth client (type *Desktop* or *Web*) and note the client ID and secret.
4. Generate a refresh token for a Google user with access to the Ads account, using scope `https://www.googleapis.com/auth/adwords` (for example, Google's OAuth Playground with your own client).
5. Set:
   - `GOOGLE_ADS_DEVELOPER_TOKEN`
   - `GOOGLE_ADS_CLIENT_ID`
   - `GOOGLE_ADS_CLIENT_SECRET`
   - `GOOGLE_ADS_REFRESH_TOKEN`
   - `GOOGLE_ADS_CUSTOMER_ID`: the account to plan against.
   - `GOOGLE_ADS_LOGIN_CUSTOMER_ID`: the manager account ID, only if you access the client through the manager.
6. Expected errors:
   - `DEVELOPER_TOKEN_NOT_APPROVED`: Basic access is still pending.
   - `invalid_grant`: the refresh token was revoked or expired.
   - `RESOURCE_EXHAUSTED`: more than 1 request per second for this customer.

The API is free. Bid values use the Ads account currency.

## YouTube Data API v3

1. In Google Cloud Console, enable *YouTube Data API v3*. Create an **API key** and restrict it to that API, plus your server IP if you can.
2. Set `YOUTUBE_API_KEY`.
3. Quota: `search.list` has its own default allowance of 100 calls per day, resetting at midnight Pacific time. Each dashboard search with YouTube selected uses one call. Quota increases require a compliance audit.

## Amazon Creators API (replaced PA-API 5 on 2026-05-15)

1. You need an Amazon Associates account for the marketplace (for example, Amazon.in) with **at least 10 qualifying sales in the last 30 days**.
2. In Associates Central, register for the Creators API and create credentials. Note the *Credential ID*, *Credential Secret* and *version*: 3.1 for North America, 3.2 for Europe including India, 3.3 for the Far East.
3. Set:
   - `AMAZON_CREATORS_CREDENTIAL_ID`
   - `AMAZON_CREATORS_CREDENTIAL_SECRET`
   - `AMAZON_CREATORS_CREDENTIAL_VERSION` (default `3.2`)
   - `AMAZON_PARTNER_TAG` (your store ID, for example `name-21`)
   - `AMAZON_MARKETPLACE` (default `www.amazon.in`)
4. Before relying on the adapter in production, compare its request against the sample request in Associates Central. The adapter follows the published `searchItems` contract but has not run against a live account.

Results are product titles and prices, not Amazon search volume.

## Flipkart Affiliate API

1. Sign in at [affiliate.flipkart.com](https://affiliate.flipkart.com). Under *API Token*, generate a token.
2. Set `FLIPKART_AFFILIATE_ID` and `FLIPKART_AFFILIATE_TOKEN`.
3. Flipkart's API documentation was last updated in 2016, and the API may not be issued to new affiliates. If the token page is missing, contact Flipkart affiliate support. Do not substitute scraping.

## eBay Browse API

1. Create an account at [developer.ebay.com](https://developer.ebay.com). Create a **Production** keyset and note the App ID (client ID) and Cert ID (client secret).
2. Set `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`. The adapter requests an application token with scope `https://api.ebay.com/oauth/api_scope`.
3. Supported marketplaces: US, GB, CA, AU, DE, FR, ES, IT, NL and SG. eBay has no India marketplace.

## Etsy Open API v3

1. Register an app at [etsy.com/developers](https://www.etsy.com/developers/your-apps) and wait for approval.
2. Set `ETSY_API_KEY` (the keystring) and `ETSY_SHARED_SECRET`. The adapter sends `x-api-key: keystring:shared_secret`.
3. The error "API key not found or not active" means the app is not yet active on Etsy's side.

## OpenAI (optional AI expansion)

Set `OPENAI_API_KEY`, and optionally `OPENAI_MODEL`. Output is always labelled AI-inferred and never carries metrics.

## Paid third-party data (requires your authorisation; not configured)

- **DataForSEO**: pay-as-you-go. Minimum top-up is $50; live search-volume tasks cost $0.09 each. Credentials are `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`.
- **Semrush**: requires a Business plan plus API units, configured with `SEMRUSH_API_KEY`.

Both resell or estimate data, so check their display and resale terms before showing it to customers.

## Verifying without printing secrets

```powershell
# Prints only whether each variable is set, never its value.
$names = 'GOOGLE_ADS_DEVELOPER_TOKEN','YOUTUBE_API_KEY','EBAY_CLIENT_ID','ETSY_API_KEY'
Get-Content .env.local | ForEach-Object { if ($_ -match '^([A-Z0-9_]+)=(.*)$' -and $names -contains $Matches[1]) { "$($Matches[1]): " + ($(if ($Matches[2]) {'SET'} else {'EMPTY'})) } }
```

Then load `http://localhost:3000/api/keywords/providers`. Each provider reports `state` plus a redacted `detail`.
