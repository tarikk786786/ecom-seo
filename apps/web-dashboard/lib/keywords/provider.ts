import type { FetchLike } from "./http";
import type { DeviceDistribution, History, KeywordRecord, KeywordSearchRequest, ProviderState } from "./types";

export type ProviderGroup = "Search & ads" | "Trends" | "Video" | "Marketplaces" | "App stores" | "Social" | "Community" | "News & web" | "Your stores" | "Reference";

export type ProviderContext = {
  env: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
  now: Date;
};

export type ProviderSearchResult = {
  records: KeywordRecord[];
  seedHistory?: History;
  /** Record that represents the query itself (e.g. the matching article or keyword idea). */
  seedRecordId?: string;
  devices?: DeviceDistribution;
  /** Shown to the user, e.g. "8 of 10 articles returned pageviews". */
  message?: string;
};

export type ConfigState = { ok: true } | { ok: false; state: ProviderState; reason: string };

export type KeywordProviderDescriptor = {
  id: string;
  name: string;
  group: ProviderGroup;
  /** Short monogram shown in the platform row (generic icon, not a brand logo). */
  glyph: string;
  color: string;
  /** True only when an adapter exists in this repository. */
  implemented: boolean;
  access: string;
  docsUrl: string;
  provides: string[];
  notProvided: string[];
  supports: { country: boolean; language: boolean; window: boolean };
  /** Included in "all enabled providers" searches by default. */
  defaultEnabled: boolean;
  timeoutMs?: number;
};

export interface KeywordProvider extends KeywordProviderDescriptor {
  configuration(ctx: Pick<ProviderContext, "env">): ConfigState;
  search?(req: KeywordSearchRequest, ctx: ProviderContext): Promise<ProviderSearchResult>;
  /** Cheap real request used for the connection status. */
  liveCheck?(ctx: ProviderContext): Promise<void>;
}

export const alwaysConfigured = (): ConfigState => ({ ok: true });
