import type { ConfigState, KeywordProvider, KeywordProviderDescriptor } from "./provider";
import { amazonCreators } from "./providers/amazon-creators";
import { ebay } from "./providers/ebay";
import { etsy } from "./providers/etsy";
import { flipkart } from "./providers/flipkart";
import { gdelt } from "./providers/gdelt";
import { googleAds } from "./providers/google-ads";
import { googleTrendsRss } from "./providers/google-trends-rss";
import { hackerNews } from "./providers/hackernews";
import { stackExchange } from "./providers/stackexchange";
import { wikipedia } from "./providers/wikipedia";
import { youtube } from "./providers/youtube";
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
  googleAds,
  googleTrendsRss,
  youtube,
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
  amazonCreators,
  flipkart,
  etsy,
  ebay,
  planned({
    id: "google-play",
    name: "Google Play",
    group: "App stores",
    glyph: "\u25B6",
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
    access: "X API paid access (pay-per-use credits) for recent search and post counts.",
    docsUrl: "https://docs.x.com/x-api/posts/recent-search",
    provides: ["Recent posts and post counts for a query"],
    notProvided: ["Search volume"],
    state: "ACCESS_REQUIRED",
    reason: `${NOT_IMPLEMENTED} Requires paid X API credits; not purchased.`,
  }),
  planned({
    id: "reddit",
    name: "Reddit",
    group: "Social",
    glyph: "R",
    color: "#f97316",
    access: "Reddit Data API requires app approval; commercial use needs a separate agreement with Reddit. Free tier is 100 queries/minute for approved non-commercial apps.",
    docsUrl: "https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki",
    provides: ["Posts and questions matching a query", "Scores and comment counts"],
    notProvided: ["Search volume"],
    state: "ACCESS_REQUIRED",
    reason: `${NOT_IMPLEMENTED} Commercial use requires Reddit's written approval and contract.`,
  }),
  gdelt,
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
