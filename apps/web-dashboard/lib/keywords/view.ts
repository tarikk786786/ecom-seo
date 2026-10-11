import { classifyIntent, isQuestion, prepositionIn, type Intent } from "./text";
import type { KeywordRecord, KeywordSearchResponse, Metric } from "./types";

export type TabId = "suggestions" | "questions" | "prepositions" | "related" | "rising";

export const TABS: { id: TabId; label: string; method: string }[] = [
  { id: "suggestions", label: "Keyword Suggestions", method: "Completions returned by providers for your seed." },
  { id: "questions", label: "Questions", method: "Provider records phrased as questions (question words or a trailing ?)." },
  { id: "prepositions", label: "Prepositions", method: "Provider records containing a preposition (for, with, vs, near, …). Derived by text rule from observed records." },
  { id: "related", label: "Related Keywords", method: "Related entries returned by provider search." },
  { id: "rising", label: "Rising", method: "Searches trending now in the selected country that share a word with your seed." },
];

export function inTab(r: KeywordRecord, tab: TabId): boolean {
  switch (tab) {
    case "suggestions":
      return r.category === "suggestion";
    case "questions":
      return r.category === "question" || isQuestion(r.keyword);
    case "prepositions":
      return prepositionIn(r.keyword) !== undefined;
    case "related":
      return r.category === "related";
    case "rising":
      return r.category === "rising";
  }
}

export type Row = KeywordRecord & { intent: Intent; preposition?: string; primary?: Metric };

export function toRows(records: KeywordRecord[]): Row[] {
  return records.map((r) => ({ ...r, intent: classifyIntent(r.keyword), preposition: prepositionIn(r.keyword), primary: r.metrics[0] }));
}

export type SortKey = "keyword" | "provider" | "metric" | "trend" | "intent" | "observed";
export type Sort = { key: SortKey; dir: "asc" | "desc" };

/**
 * Metric sorting groups rows by metric type first, so values with different meanings
 * (article views vs. question views vs. HN points) are never ranked against each other.
 */
export function sortRows(rows: Row[], sort: Sort): Row[] {
  const m = sort.dir === "asc" ? 1 : -1;
  const missingLast = (a: number | undefined, b: number | undefined) => (a === undefined ? (b === undefined ? 0 : 1) : b === undefined ? -1 : 0);
  return [...rows].sort((a, b) => {
    switch (sort.key) {
      case "keyword":
        return m * a.keyword.localeCompare(b.keyword);
      case "provider":
        return m * a.provider.localeCompare(b.provider) || a.keyword.localeCompare(b.keyword);
      case "intent":
        return m * a.intent.localeCompare(b.intent);
      case "metric": {
        const ka = a.primary?.key;
        const kb = b.primary?.key;
        if (ka !== kb) return ka === undefined ? 1 : kb === undefined ? -1 : ka.localeCompare(kb);
        return missingLast(a.primary?.value, b.primary?.value) || m * ((a.primary?.value ?? 0) - (b.primary?.value ?? 0));
      }
      case "trend":
        return missingLast(a.trend?.pct, b.trend?.pct) || m * ((a.trend?.pct ?? 0) - (b.trend?.pct ?? 0));
      case "observed":
        return missingLast(a.observedAt ? 1 : undefined, b.observedAt ? 1 : undefined) || m * (a.observedAt ?? "").localeCompare(b.observedAt ?? "");
    }
  });
}

export type TableFilters = { text: string; providers: string[]; intents: Intent[]; withMetricsOnly: boolean };
export const EMPTY_FILTERS: TableFilters = { text: "", providers: [], intents: [], withMetricsOnly: false };

export function filtersActive(f: TableFilters): boolean {
  return Boolean(f.text.trim() || f.providers.length || f.intents.length || f.withMetricsOnly);
}

export function filterRows(rows: Row[], f: TableFilters): Row[] {
  const text = f.text.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!text || r.keyword.toLowerCase().includes(text)) &&
      (!f.providers.length || f.providers.includes(r.provider)) &&
      (!f.intents.length || f.intents.includes(r.intent)) &&
      (!f.withMetricsOnly || r.metrics.length > 0),
  );
}

export function paginate<T>(items: T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: items.slice((p - 1) * size, p * size), page: p, pages };
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: n >= 100_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}

export function formatMetric(metric: Metric): string {
  return metric.display ?? formatNumber(metric.value);
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export type ExportContext = { response: KeywordSearchResponse; tab: TabId; filters: TableFilters; exportedAt: string };

const CSV_COLUMNS = [
  "keyword", "tab", "category", "provider", "method", "data_type", "intent_rule_based",
  "metric_label", "metric_value", "metric_display", "metric_unit", "metric_kind", "metric_period", "metric_definition",
  "other_metrics", "trend_pct", "trend_window", "country", "language", "source_url", "source_record_id",
  "observed_at", "fetched_at", "query", "requested_country", "requested_language", "requested_window", "table_filters", "exported_at",
] as const;

export function toCsv(rows: Row[], ctx: ExportContext): string {
  const req = ctx.response.request;
  const filters = filtersActive(ctx.filters) ? JSON.stringify(ctx.filters) : "";
  const lines = rows.map((r) =>
    [
      r.keyword, ctx.tab, r.category, r.provider, r.method, r.dataType, r.intent,
      r.primary?.label, r.primary?.value, r.primary?.display, r.primary?.unit, r.primary?.kind, r.primary?.period, r.primary?.definition,
      r.metrics.length > 1 ? JSON.stringify(r.metrics.slice(1).map(({ key, value, unit, period }) => ({ key, value, unit, period }))) : "",
      r.trend?.pct, r.trend?.window, r.country, r.language, r.sourceUrl, r.sourceRecordId,
      r.observedAt, r.fetchedAt, req.query, req.country, req.language, req.window, filters, ctx.exportedAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...lines].join("\r\n");
}

export function toJsonExport(rows: Row[], ctx: ExportContext) {
  const definitions = new Map<string, Pick<Metric, "label" | "unit" | "kind" | "definition">>();
  for (const r of rows) for (const m of r.metrics) definitions.set(`${r.provider}:${m.key}`, { label: m.label, unit: m.unit, kind: m.kind, definition: m.definition });
  return {
    exportedAt: ctx.exportedAt,
    query: ctx.response.query,
    request: ctx.response.request,
    searchedAt: ctx.response.fetchedAt,
    tab: ctx.tab,
    tableFilters: ctx.filters,
    providers: ctx.response.outcomes,
    metricDefinitions: Object.fromEntries(definitions),
    notes: "Metrics are provider-specific and must not be summed across providers. intent is a rule-based estimate.",
    records: rows.map(({ primary, ...r }) => (void primary, r)),
  };
}
