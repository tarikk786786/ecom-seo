import type { ConfigState, KeywordProvider, KeywordProviderDescriptor } from "./provider";
import { amazonCreators } from "./providers/amazon-creators";
import { dataforseo } from "./providers/dataforseo";
import { ebay } from "./providers/ebay";
import { etsy } from "./providers/etsy";
import { flipkart } from "./providers/flipkart";
import { gdelt } from "./providers/gdelt";
import { googleAds } from "./providers/google-ads";
import { googleTrendsRss } from "./providers/google-trends-rss";
import { reddit } from "./providers/reddit";
import { stackExchange } from "./providers/stackexchange";
import { wikipedia } from "./providers/wikipedia";
import { youtube } from "./providers/youtube";
import type { ProviderState } from "./types";

/** Only sources with a working adapter. Marketplaces first, then search demand, then context. */
export const PROVIDERS: KeywordProvider[] = [
  amazonCreators,
  flipkart,
  ebay,
  etsy,
  googleAds,
  dataforseo,
  googleTrendsRss,
  youtube,
  wikipedia,
  gdelt,
  reddit,
  { ...stackExchange, defaultEnabled: false },
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
