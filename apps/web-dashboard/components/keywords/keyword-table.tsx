"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Intent } from "@/lib/keywords/text";
import { EMPTY_FILTERS, filterRows, filtersActive, formatMetric, paginate, sortRows, type Row, type Sort, type SortKey, type TableFilters } from "@/lib/keywords/view";
import { Sparkline } from "./charts";
import type { ColumnId } from "./storage";

const INTENTS: Intent[] = ["informational", "commercial", "transactional", "navigational"];

const DATA_TYPE_LABEL = { observed: "Observed", derived: "Derived", estimated: "Estimate", ai_inferred: "AI" } as const;

export function KeywordTable({
  rows,
  providerNames,
  columns,
  pageSize,
  filters,
  onFilters,
  selected,
  onSelected,
  bulkActions,
  emptyMessage,
}: {
  rows: Row[];
  providerNames: Record<string, string>;
  columns: Record<ColumnId, boolean>;
  pageSize: number;
  filters: TableFilters;
  onFilters: (f: TableFilters) => void;
  selected: Set<string>;
  onSelected: (s: Set<string>) => void;
  bulkActions: (visible: Row[]) => React.ReactNode;
  emptyMessage: string;
}) {
  const [sort, setSort] = useState<Sort>({ key: "metric", dir: "desc" });
  const [page, setPage] = useState(1);
  const [evidence, setEvidence] = useState<Row | undefined>();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const filtered = useMemo(() => sortRows(filterRows(rows, filters), sort), [rows, filters, sort]);
  const pg = paginate(filtered, page, pageSize);
  const providersPresent = useMemo(() => [...new Set(rows.map((r) => r.provider))], [rows]);

  useEffect(() => {
    setPage(1);
  }, [rows, filters]);

  useEffect(() => {
    if (evidence) dialogRef.current?.showModal();
  }, [evidence]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "keyword" || key === "provider" ? "asc" : "desc" }));
  const allOnPage = pg.items.length > 0 && pg.items.every((r) => selected.has(r.id));
  const setOnPage = (on: boolean) => {
    const next = new Set(selected);
    for (const r of pg.items) {
      if (on) next.add(r.id);
      else next.delete(r.id);
    }
    onSelected(next);
  };

  const th = (k: SortKey | undefined, children: React.ReactNode, className = "") => (
    <th scope="col" aria-sort={k && sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : undefined} className={`whitespace-nowrap px-2 py-2 font-medium ${className}`}>
      {k ? (
        <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-zinc-200">
          {children}
          <span aria-hidden className="text-[9px]">{sort.key === k ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <input
          type="search"
          value={filters.text}
          onChange={(e) => onFilters({ ...filters, text: e.target.value })}
          placeholder="Filter keywords…"
          aria-label="Filter keywords in table"
          className="w-44 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200 placeholder:text-zinc-600"
        />
        <select
          aria-label="Filter by source"
          value={filters.providers[0] ?? ""}
          onChange={(e) => onFilters({ ...filters, providers: e.target.value ? [e.target.value] : [] })}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
        >
          <option value="">All sources</option>
          {providersPresent.map((p) => (
            <option key={p} value={p}>
              {providerNames[p] ?? p}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by intent"
          value={filters.intents[0] ?? ""}
          onChange={(e) => onFilters({ ...filters, intents: e.target.value ? [e.target.value as Intent] : [] })}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-200"
        >
          <option value="">All intents</option>
          {INTENTS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-zinc-400">
          <input type="checkbox" checked={filters.withMetricsOnly} onChange={(e) => onFilters({ ...filters, withMetricsOnly: e.target.checked })} className="accent-sky-500" />
          With metrics only
        </label>
        {filtersActive(filters) && (
          <button type="button" onClick={() => onFilters(EMPTY_FILTERS)} className="rounded-md border border-zinc-700 px-2 py-1.5 text-amber-300 hover:border-zinc-500">
            Reset filters
          </button>
        )}
        <span className="ml-auto text-zinc-500">
          {filtered.length} of {rows.length} shown{selected.size ? ` · ${selected.size} selected` : ""}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">{bulkActions(filtered)}</div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        <>
          <div className="max-h-[560px] overflow-auto rounded-lg border border-zinc-800">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-900 text-zinc-400">
                <tr>
                  <th scope="col" className="w-8 px-2 py-2">
                    <input type="checkbox" aria-label="Select all rows on this page" checked={allOnPage} onChange={(e) => setOnPage(e.target.checked)} className="accent-sky-500" />
                  </th>
                  {th("keyword", "Keyword")}
                  {columns.provider && th("provider", "Source")}
                  {columns.metric && th("metric", "Metric", "text-right")}
                  {columns.trend && th("trend", "Trend", "text-right")}
                  {columns.sparkline && th(undefined, "History")}
                  {columns.intent && th("intent", "Intent")}
                  {columns.locale && th(undefined, "Locale")}
                  {columns.observed && th("observed", "Observed")}
                  {th(undefined, "Evidence")}
                </tr>
              </thead>
              <tbody>
                {pg.items.map((r) => (
                  <tr key={r.id} className={`border-t border-zinc-800/70 ${selected.has(r.id) ? "bg-sky-500/5" : "hover:bg-zinc-900/60"}`}>
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.keyword}`}
                        checked={selected.has(r.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r.id);
                          else next.delete(r.id);
                          onSelected(next);
                        }}
                        className="accent-sky-500"
                      />
                    </td>
                    <td className="max-w-md px-2 py-1.5 text-zinc-100">
                      <span className="line-clamp-2">{r.keyword}</span>
                    </td>
                    {columns.provider && (
                      <td className="whitespace-nowrap px-2 py-1.5 text-zinc-400">
                        {providerNames[r.provider] ?? r.provider}
                        <span className="ml-1 rounded bg-zinc-800 px-1 text-[10px] text-zinc-400">{DATA_TYPE_LABEL[r.dataType]}</span>
                      </td>
                    )}
                    {columns.metric && (
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                        {r.primary ? (
                          <span title={`${r.primary.label}${r.primary.period ? ` (${r.primary.period})` : ""}: ${r.primary.definition}`}>
                            <span className="text-zinc-100">{formatMetric(r.primary)}</span> <span className="text-[10px] text-zinc-500">{r.primary.unit}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-600" title="This source returned no metric for this keyword.">
                            —
                          </span>
                        )}
                      </td>
                    )}
                    {columns.trend && (
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                        {r.trend ? (
                          <span title={`${r.trend.window}. ${r.trend.definition}`} className={r.trend.pct >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {r.trend.pct >= 0 ? "+" : ""}
                            {r.trend.pct}%
                          </span>
                        ) : (
                          <span className="text-zinc-600" title="No comparable history from this source.">
                            —
                          </span>
                        )}
                      </td>
                    )}
                    {columns.sparkline && (
                      <td className="px-2 py-1">
                        <Sparkline history={r.history} />
                      </td>
                    )}
                    {columns.intent && (
                      <td className="px-2 py-1.5 text-zinc-400" title="Rule-based estimate from words in the keyword">
                        {r.intent}
                      </td>
                    )}
                    {columns.locale && (
                      <td className="whitespace-nowrap px-2 py-1.5 text-zinc-400">
                        {r.country ?? "—"} / {r.language ?? "—"}
                      </td>
                    )}
                    {columns.observed && <td className="whitespace-nowrap px-2 py-1.5 text-zinc-400">{r.observedAt ? r.observedAt.slice(0, 10) : "—"}</td>}
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <button type="button" onClick={() => setEvidence(r)} className="text-sky-400 hover:text-sky-300">
                        Details
                      </button>
                      {r.sourceUrl && (
                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-zinc-500 hover:text-zinc-300" aria-label={`Open source for ${r.keyword}`}>
                          ↗
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <p className="p-4 text-center text-xs text-zinc-500">No rows match the table filters.</p>}
          <nav aria-label="Table pages" className="mt-2 flex items-center justify-end gap-2 text-xs text-zinc-400">
            <button type="button" disabled={pg.page <= 1} onClick={() => setPage(pg.page - 1)} className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40">
              Previous
            </button>
            <span>
              Page {pg.page} of {pg.pages}
            </span>
            <button type="button" disabled={pg.page >= pg.pages} onClick={() => setPage(pg.page + 1)} className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40">
              Next
            </button>
          </nav>
        </>
      )}

      <dialog ref={dialogRef} onClose={() => setEvidence(undefined)} className="m-auto w-[min(92vw,560px)] rounded-xl border border-zinc-700 bg-zinc-950 p-0 text-zinc-200 backdrop:bg-black/60">
        {evidence && (
          <div className="p-5 text-sm">
            <h3 className="pr-8 font-semibold text-zinc-50">{evidence.keyword}</h3>
            <dl className="mt-3 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-zinc-500">Source</dt>
              <dd>{providerNames[evidence.provider] ?? evidence.provider}</dd>
              <dt className="text-zinc-500">Method</dt>
              <dd>{evidence.method}</dd>
              <dt className="text-zinc-500">Data type</dt>
              <dd>{DATA_TYPE_LABEL[evidence.dataType]}</dd>
              <dt className="text-zinc-500">Record ID</dt>
              <dd className="break-all">{evidence.sourceRecordId ?? "—"}</dd>
              <dt className="text-zinc-500">Fetched</dt>
              <dd>{new Date(evidence.fetchedAt).toLocaleString()}</dd>
              {evidence.observedAt && (
                <>
                  <dt className="text-zinc-500">Observed</dt>
                  <dd>{new Date(evidence.observedAt).toLocaleString()}</dd>
                </>
              )}
              <dt className="text-zinc-500">Intent</dt>
              <dd>{evidence.intent} (rule-based estimate)</dd>
            </dl>
            <h4 className="mt-4 text-xs font-semibold text-zinc-300">Metrics</h4>
            {evidence.metrics.length ? (
              <ul className="mt-1 space-y-2 text-xs">
                {evidence.metrics.map((m) => (
                  <li key={m.key} className="rounded border border-zinc-800 p-2">
                    <p className="text-zinc-100">
                      {m.label}: <span className="tabular-nums">{formatMetric(m)}</span> {m.unit}
                    </p>
                    <p className="text-zinc-500">{m.period ? `${m.period}. ` : ""}{m.definition}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">This source returned no metrics for this keyword.</p>
            )}
            {evidence.trend && (
              <p className="mt-2 text-xs text-zinc-400">
                Trend {evidence.trend.pct >= 0 ? "+" : ""}
                {evidence.trend.pct}% ({evidence.trend.window}). {evidence.trend.definition}
              </p>
            )}
            <div className="mt-4 flex justify-between">
              {evidence.sourceUrl ? (
                <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:text-sky-300">
                  Open source record ↗
                </a>
              ) : (
                <span />
              )}
              <button type="button" onClick={() => dialogRef.current?.close()} className="rounded border border-zinc-700 px-3 py-1 text-xs hover:border-zinc-500">
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
