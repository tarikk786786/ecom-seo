/** Shared keyword research contract used by providers, the search API and the UI. */

export type ProviderState =
  | "NOT_CONFIGURED"
  | "ACCESS_REQUIRED"
  | "CONNECTING"
  | "CONNECTED"
  | "DEGRADED"
  | "RATE_LIMITED"
  | "DISCONNECTED"
  | "ERROR"
  | "DISABLED";

/** How a keyword was obtained. Lets the UI keep provider data apart from derived or AI output. */
export type KeywordCategory = "suggestion" | "question" | "related" | "rising";

export type DataType = "observed" | "derived" | "estimated" | "ai_inferred";

/**
 * - absolute: a count of real events (e.g. article views, searches)
 * - relative_index: normalised 0–100 style index, never convertible to counts
 * - engagement: votes, comments, views of a post (not search demand)
 * - approximate_bucket: provider-rounded bucket such as "200+"
 */
export type MetricKind = "absolute" | "relative_index" | "engagement" | "approximate_bucket";

export type Metric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  kind: MetricKind;
  /** Human-readable reporting period, e.g. "last 30 days to 2026-10-10". */
  period?: string;
  definition: string;
  /** Raw provider value when it is not purely numeric (e.g. "200+"). */
  display?: string;
};

export type HistoryPoint = { date: string; value: number };

export type History = {
  label: string;
  unit: string;
  kind: MetricKind;
  granularity: "daily" | "monthly";
  points: HistoryPoint[];
  definition: string;
  sourceUrl?: string;
  /** Dates in the requested range with no observation (shown as gaps, never filled). */
  missing?: string[];
};

export type Trend = { pct: number; window: string; definition: string };

export type KeywordRecord = {
  id: string;
  keyword: string;
  normalized: string;
  category: KeywordCategory;
  provider: string;
  method: string;
  dataType: DataType;
  language?: string;
  country?: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  fetchedAt: string;
  observedAt?: string;
  /** Provider-specific metrics. Never merged across providers. */
  metrics: Metric[];
  trend?: Trend;
  history?: History;
};

export type DeviceShare = { device: string; value: number; share: number };

export type DeviceDistribution = {
  provider: string;
  label: string;
  definition: string;
  period: string;
  unit: string;
  items: DeviceShare[];
  sourceUrl?: string;
};

export type FilterApplication = "applied" | "not_supported" | "not_requested";

export type ProviderOutcome = {
  provider: string;
  name: string;
  status: "ok" | "empty" | "error" | "timeout" | "skipped" | "rate_limited";
  state: ProviderState;
  message?: string;
  durationMs?: number;
  resultCount: number;
  fetchedAt?: string;
  applied: { country: FilterApplication; language: FilterApplication; window: FilterApplication };
};

export type TimeWindow = "30d" | "90d" | "12m" | "24m";

export type KeywordSearchRequest = {
  query: string;
  providers: string[];
  country: string;
  language: string;
  window: TimeWindow;
  stackExchangeSite?: string;
};

export type KeywordSearchResponse = {
  query: string;
  request: KeywordSearchRequest;
  fetchedAt: string;
  records: KeywordRecord[];
  outcomes: ProviderOutcome[];
  /** Seed-level evidence (chart and device split) from the first provider that supplies it. */
  seedHistory?: History & { provider: string };
  devices?: DeviceDistribution;
};

export const TIME_WINDOWS: { id: TimeWindow; label: string; days: number }[] = [
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "12m", label: "Last 12 months", days: 365 },
  { id: "24m", label: "Last 24 months", days: 730 },
];
