import type { ConfigState, KeywordProvider, KeywordProviderDescriptor } from "./provider";
import { googleTrendsRss } from "./providers/google-trends-rss";
import { hackerNews } from "./providers/hackernews";
import { stackExchange } from "./providers/stackexchange";
import { wikipedia } from "./providers/wikipedia";
import type { ProviderState } from "./types";

type Planned = Omit<KeywordProviderDescriptor, "implemented" | "defaultEnabled" | "supports"> & {
  state: Exclude<ConfigState, { ok: true }>["state"];
  reason: string;
  supports?: KeywordProviderDescriptor["supports"];
};

/** Registry entries without an adapter. They are selectable only to show setup requirements. */
function planned(p: Planned): KeywordProvider {
  const { state, reason, supports, ...d } = p;
  return { ...d, implemented: false, defaultEnabled: false, supports: supports ?? { country: false, language: false, window: false }, configuration: () => ({ ok: false, state, reason }) };
}

const NOT_IMPLEMENTED = "Adapter not implemented yet.";

export const PROVIDERS: KeywordProvider[] = [
  planned({
    id: "google-ads",
    name: "Google Search (Keyword Planner)",
    group: "Search & ads",
    glyph: "G",
    color: "#4ade80",
    access: "Google Ads API developer token (Basic access or higher) plus OAuth consent from a Google Ads account.",
    docsUrl: "https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas",
    provides: ["Keyword ideas", "Average monthly searches (historical)", "Top-of-page bid low/high", "Competition (LOW/MEDIUM/HIGH and 0–100 index)"],
    notProvided: ["Live/real-time trends", "Device split in keyword ideas"],
    state: "ACCESS_REQUIRED",
    reason: `${NOT_IMPLEMENTED} Requires an approved Google Ads developer token and account OAuth. This is the source for search volume, CPC and competition.`,
  }),
  googleTrendsRss,
  planned({
    id: "youtube",
    name: "YouTube",
    group: "Video",
    glyph: "YT",
    color: "#f87171",
    access: "YouTube Data API v3 key from Google Cloud (search.list costs 100 quota units).",
    docsUrl: "https://developers.google.com/youtube/v3/docs/search/list",
    provides: ["Video titles matching a query", "Video view/like counts"],
    notProvided: ["YouTube search volume", "CPC"],
    state: "NOT_CONFIGURED",
    reason: `${NOT_IMPLEMENTED} Needs YOUTUBE_API_KEY on the server.`,
  }),
  planned({
    id: "bing",
    name: "Bing",
    group: "Search & ads",
    glyph: "B",
    color: "#22d3ee",
    access: "Microsoft retired the Bing Search and Autosuggest APIs in August 2025. Bing keyword data now requires Microsoft Advertising API access.",
    docsUrl: "https://learn.microsoft.com/en-us/advertising/guides/get-started",
    provides: ["Keyword ideas and volumes via Microsoft Advertising Ad Insight (approved accounts)"],
    notProvided: ["Public autosuggest API"],
    state: "DISABLED",
    reason: "Bing Search APIs are retired. A Microsoft Advertising Ad Insight adapter is planned.",
  }),
  planned({
    id: "amazon",
    name: "Amazon",
    group: "Marketplaces",
    glyph: "a",
    color: "#fbbf24",
    access: "Amazon Creators API (Associates) per marketplace, e.g. amazon.in; Selling Partner API covers only your own seller account.",
    docsUrl: "https://affiliate-program.amazon.com/",
    provides: ["Product search results, offers and prices (Creators API)"],
    notProvided: ["Amazon search volume", "Marketplace-wide sales data"],
    state: "ACCESS_REQUIRED",
    reason: `${NOT_IMPLEMENTED} Requires Amazon Associates API credentials and partner tags.`,
  }),
  planned({
    id: "flipkart",
    name: "Flipkart",
    group: "Marketplaces",
    glyph: "F",
    color: "#facc15",
    access: "Flipkart Affiliate API (affiliate ID and token). Seller APIs cover only your own listings.",
    docsUrl: "https://affiliate.flipkart.com",
    provides: ["Product search and offers from the affiliate catalog"],
    notProvided: ["Flipkart search volume"],
    state: "ACCESS_REQUIRED",
    reason: `${NOT_IMPLEMENTED} Requires Flipkart Affiliate credentials.`,
  }),
  planned({
    id: "etsy",
    name: "Etsy",
    group: "Marketplaces",
    glyph: "E",
    color: "#fb923c",
    access: "Etsy Open API v3 key (app approval required).",
    docsUrl: "https://developers.etsy.com/documentation/",
    provides: ["Active listings matching a query", "Listing views/favorites where returned"],
    notProvided: ["Etsy search volume"],
    state: "NOT_CONFIGURED",
    reason: `${NOT_IMPLEMENTED} Needs ETSY_API_KEY.`,
  }),
  planned({
    id: "ebay",
    name: "eBay",
    group: "Marketplaces",
    glyph: "e",
    color: "#a78bfa",
    access: "eBay Browse API (client-credentials OAuth app).",
    docsUrl: "https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search",
    provides: ["Item search results and prices", "Total matching listings"],
    notProvided: ["eBay search volume"],
    state: "NOT_CONFIGURED",
    reason: `${NOT_IMPLEMENTED} Needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET.`,
  }),
  planned({
    id: "google-play",
    name: "Google Play",
    group: "App stores",
    glyph: "▶",
    color: "#34d399",
    access: "No public Play Store search API. The Play Developer Reporting API covers only apps you own.",
    docsUrl: "https://developers.google.com/play/developer/reporting",
    provides: ["Your own apps' store performance (search terms reports in Play Console)"],
    notProvided: ["Store-wide keyword volume"],
    state: "ACCESS_REQUIRED",
    reason: `${NOT_IMPLEMENTED} Only own-app data is available through official APIs.`,
  }),
  planned({
    id: "instagram",
    name: "Instagram",
    group: "Social",
    glyph: "IG",
    color: "#f472b6",
    access: "Meta app review for Instagram Graph API hashtag search (business accounts only).",
    docsUrl: "https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag-search",
    provides: ["Recent/top media for a hashtag"],
    notProvided: ["Search volume"],
    state: "ACCESS_REQUIRED",
    reason: `${NOT_IMPLEMENTED} Requires an approved Meta app and Instagram business account.`,
  }),
  planned({
    id: "tiktok",
    name: "TikTok",
    group: "Social",
    glyph: "TT",
    color: "#e879f9",
    access: "TikTok Research API (approved researchers) or Commercial Content API.",
    docsUrl: "https://developers.tiktok.com/products/research-api/",
    provides: ["Video search and engagement for approved researchers"],
    notProvided: ["Search volume"],
    state: "ACCESS_REQUIRED",
    reason: `${NOT_IMPLEMENTED} Requires TikTok Research API approval.`,
  }),
  planned({
    id: "pinterest",
    name: "Pinterest",
    group: "Social",
    glyph: "P",
    color: "#ef4444",
    access: "Pinterest API v5 app with Trends access.",
    docsUrl: "https://developers.pinterest.com/docs/api/v5/trending_keywords-list/",
    provides: ["Trending keywords by region"],
    notProvided: ["Absolute search volume"],
    state: "ACCESS_REQUIRED",
    reason: `${NOT_IMPLEMENTED} Requires a Pinterest developer app with trends access.`,
  }),
  planned({
    id: "x",
    name: "X",
    group: "Social",
    glyph: "X",
    color: "#e4e4e7",
    access: "X API paid tier for recent search and post counts.",
    docsUrl: "https://docs.x.com/x-api/posts/recent-search",
    provides: ["Recent posts and post counts for a query"],
    notProvided: ["Search volume"],
    state: "ACCESS_REQUIRED",
    reason: `${NOT_IMPLEMENTED} Requires a paid X API plan.`,
  }),
  planned({
    id: "reddit",
    name: "Reddit",
    group: "Social",
    glyph: "R",
    color: "#f97316",
    access: "Reddit Data API OAuth app (registration and terms acceptance).",
    docsUrl: "https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki",
    provides: ["Posts and questions matching a query", "Scores and comment counts"],
    notProvided: ["Search volume"],
    state: "NOT_CONFIGURED",
    reason: `${NOT_IMPLEMENTED} Needs REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.`,
  }),
  planned({
    id: "news",
    name: "News (GDELT)",
    group: "News & web",
    glyph: "N",
    color: "#38bdf8",
    access: "GDELT DOC 2.0 API, public, rate-limited to about one request every 5 seconds.",
    docsUrl: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
    provides: ["News article coverage volume over time", "Article links"],
    notProvided: ["Search volume"],
    state: "NOT_CONFIGURED",
    reason: NOT_IMPLEMENTED,
  }),
  stackExchange,
  hackerNews,
  wikipedia,
  planned({
    id: "shopify",
    name: "Shopify store",
    group: "Your stores",
    glyph: "S",
    color: "#86efac",
    access: "Connect your own store via a Shopify app (OAuth, read_products / analytics scopes).",
    docsUrl: "https://shopify.dev/docs/api/admin-graphql",
    provides: ["Your catalog and store search analytics where scopes allow"],
    notProvided: ["Other merchants' data"],
    state: "NOT_CONFIGURED",
    reason: `${NOT_IMPLEMENTED} Connect a store you own.`,
  }),
  planned({
    id: "woocommerce",
    name: "WooCommerce store",
    group: "Your stores",
    glyph: "Wc",
    color: "#c084fc",
    access: "WooCommerce REST API keys from your own store.",
    docsUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs/",
    provides: ["Your products and orders"],
    notProvided: ["Marketplace-wide data"],
    state: "NOT_CONFIGURED",
    reason: `${NOT_IMPLEMENTED} Connect a store you own.`,
  }),
];

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id);

/** Serializable descriptor for the client (no functions, no configuration values). */
export type ProviderInfo = KeywordProviderDescriptor & { config: ConfigState };

export type ProviderStatus = ProviderInfo & { state: ProviderState; checkedAt?: string; detail?: string; latencyMs?: number };

export function providerInfo(p: KeywordProvider, env: Record<string, string | undefined>): ProviderInfo {
  const { configuration, search, liveCheck, ...d } = p;
  void search;
  void liveCheck;
  return { ...d, config: configuration({ env }) };
}
