"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProviderStatus } from "@/lib/keywords/registry";
import { COUNTRIES, LANGUAGES, countryName, languageName } from "@/lib/keywords/locales";
import { TIME_WINDOWS, type KeywordSearchResponse, type TimeWindow } from "@/lib/keywords/types";
import { EMPTY_FILTERS, TABS, formatMetric, inTab, toCsv, toJsonExport, toRows, type Row, type TabId, type TableFilters } from "@/lib/keywords/view";
import { DeviceChart, HistoryChart } from "./charts";
import { KeywordTable } from "./keyword-table";
import { AiPanel, SavedPanel, SettingsDrawer } from "./panels";
import { PlatformRow, STATE_STYLE, isUsable } from "./platform-row";
import { download, newId, pushHistory, useHistory, useLists, useSavedSearches, useSettings, type HistoryEntry } from "./storage";

type SearchState = { status: "idle" } | { status: "loading"; startedAt: number } | { status: "error"; error: string } | { status: "done" };

const selectCls = "rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-200";

function MetricCard({ label, value, sub, muted }: { label: string; value: React.ReactNode; sub?: React.ReactNode; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${muted ? "text-sm font-normal text-zinc-500" : "text-zinc-50"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p>}
    </div>
  );
}

export function KeywordWorkspace() {
  const [settings, setSettings, settingsLoaded] = useSettings();
  const [history, setHistory] = useHistory();
  const [saved, setSaved] = useSavedSearches();
  const [lists, setLists] = useLists();

  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [providersError, setProvidersError] = useState<string>();
  const [providersLoading, setProvidersLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [focused, setFocused] = useState<string>();

  const [query, setQuery] = useState("");
  const [country, setCountry] = useState(settings.country);
  const [language, setLanguage] = useState(settings.language);
  const [window_, setWindow] = useState<TimeWindow>(settings.window);

  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [response, setResponse] = useState<KeywordSearchResponse>();
  const [tab, setTab] = useState<TabId>("suggestions");
  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS);
  const [rowSel, setRowSel] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean>();
  const [listName, setListName] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!settingsLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- apply stored defaults once they load
    setCountry(settings.country);
    setLanguage(settings.language);
    setWindow(settings.window);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/keywords/providers")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { providers: ProviderStatus[] };
      })
      .then((d) => !cancelled && setProviders(d.providers))
      .catch((e) => !cancelled && setProvidersError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setProvidersLoading(false));
    fetch("/api/keywords/ai-expand")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => !cancelled && setAiConfigured(Boolean(d.configured)))
      .catch(() => !cancelled && setAiConfigured(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!providers.length || !settingsLoaded) return;
    const usable = providers.filter(isUsable);
    const preferred = settings.providers?.filter((id) => usable.some((p) => p.id === id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial selection depends on fetched provider states
    setSelected(preferred?.length ? preferred : usable.filter((p) => p.defaultEnabled).map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, settingsLoaded]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const byId = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p])), [providers]);
  const providerNames = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p.name])), [providers]);
  const selectedProviders = selected.map((id) => byId[id]).filter(Boolean) as ProviderStatus[];

  const toggleProvider = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setSettings((s) => ({ ...s, providers: next }));
      return next;
    });
  };

  const runSearch = useCallback(
    async (entry: Omit<HistoryEntry, "at">) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearch({ status: "loading", startedAt: Date.now() });
      setRowSel(new Set());
      setFilters(EMPTY_FILTERS);
      try {
        const res = await fetch("/api/keywords/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...entry, stackExchangeSite: settings.stackExchangeSite }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const r = data as KeywordSearchResponse;
        setResponse(r);
        setSearch({ status: "done" });
        setHistory((h) => pushHistory(h, { ...entry, at: r.fetchedAt }));
        const firstTab = TABS.find((t) => r.records.some((rec) => inTab(rec, t.id)))?.id;
        if (firstTab) setTab(firstTab);
      } catch (err) {
        if (controller.signal.aborted) {
          setSearch({ status: "error", error: "Search cancelled." });
          return;
        }
        setSearch({ status: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [settings.stackExchangeSite, setHistory],
  );

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || !selected.length) return;
    void runSearch({ query: query.trim(), country, language, window: window_, providers: selected });
  };

  const replay = (h: Omit<HistoryEntry, "at">) => {
    setQuery(h.query);
    setCountry(h.country);
    setLanguage(h.language);
    setWindow(h.window);
    const usable = h.providers.filter((id) => byId[id] && isUsable(byId[id]!));
    const providerIds = usable.length ? usable : selected;
    setSelected(providerIds);
    void runSearch({ ...h, providers: providerIds });
  };

  const allRows = useMemo(() => toRows(response?.records ?? []), [response]);
  const tabRows = useMemo(() => allRows.filter((r) => inTab(r, tab)), [allRows, tab]);
  const tabCounts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.id, allRows.filter((r) => inTab(r, t.id)).length])), [allRows]);
  const okOutcomes = response?.outcomes.filter((o) => o.status === "ok" || o.status === "empty") ?? [];
  const failedOutcomes = response?.outcomes.filter((o) => o.status !== "ok" && o.status !== "empty") ?? [];
  const seedFor = (provider: string) => (response?.seeds?.[provider] ? response.records.find((r) => r.id === response.seeds![provider]) : undefined);
  const seedRecord = seedFor("wikipedia");
  const adsSeed = seedFor("google-ads");
  const adsMetric = (key: string) => adsSeed?.metrics.find((m) => m.key === key);
  const loading = search.status === "loading";

  const unsupported = (key: "country" | "language" | "window") => selectedProviders.filter((p) => p.implemented && !p.supports[key]).map((p) => p.name);

  const exportCtx = () => ({ response: response!, tab, filters, exportedAt: new Date().toISOString() });
  const pickRows = (visible: Row[]) => (rowSel.size ? allRows.filter((r) => rowSel.has(r.id)) : visible);
  const fileBase = () => `keywords_${(response?.query ?? "export").replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40)}_${tab}`;

  const addToList = (rows: Row[]) => {
    const name = listName.trim() || "My keywords";
    const now = new Date().toISOString();
    setLists((ls) => {
      const existing = ls.find((l) => l.name.toLowerCase() === name.toLowerCase());
      const items = rows.map((r) => ({ keyword: r.keyword, provider: r.provider, category: r.category, sourceUrl: r.sourceUrl, fetchedAt: r.fetchedAt, addedAt: now, query: response?.query ?? "" }));
      if (!existing) return [...ls, { id: newId(), name, items, updatedAt: now }];
      const keys = new Set(existing.items.map((i) => `${i.provider}:${i.keyword}`));
      return ls.map((l) => (l.id === existing.id ? { ...l, items: [...l.items, ...items.filter((i) => !keys.has(`${i.provider}:${i.keyword}`))], updatedAt: now } : l));
    });
    setToast(`Added ${rows.length} keyword(s) to “${name}”`);
  };

  const btn = "rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-40";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Keyword research</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-400">
            Find what shoppers search for across Amazon, Flipkart, eBay, Etsy, Google and YouTube in one pass. Every keyword, listing and figure links back to the source it came from.
          </p>
        </div>
        <button type="button" onClick={() => setSettingsOpen(true)} className={btn}>
          Settings
        </button>
      </header>

      <section aria-label="Platforms" className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-zinc-400">
            Platforms{" "}
            <span className="text-zinc-500">
              · {selected.length} selected · {providers.filter((p) => p.state === "CONNECTED").length} connected of {providers.length}
            </span>
          </p>
          <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
            {(["CONNECTED", "NOT_CONFIGURED", "ACCESS_REQUIRED", "ERROR"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${STATE_STYLE[s].dot}`} />
                {STATE_STYLE[s].label}
              </span>
            ))}
          </div>
        </div>
        {providersLoading ? (
          <div className="flex gap-1.5" aria-busy="true" aria-label="Checking platforms">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="h-[58px] w-[56px] animate-pulse rounded-lg bg-zinc-800/60" />
            ))}
          </div>
        ) : providersError ? (
          <p className="text-sm text-rose-300">Could not load platform status: {providersError}</p>
        ) : (
          <PlatformRow providers={providers} selected={selected} onToggle={toggleProvider} focused={focused} onFocus={setFocused} loading={loading} />
        )}
      </section>

      <form onSubmit={submit} role="search" className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={120}
              placeholder="Enter a product, category or brand"
              aria-label="Seed keyword"
              list="kw-history"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500"
            />
            <datalist id="kw-history">
              {history.map((h) => (
                <option key={`${h.query}|${h.country}|${h.language}|${h.window}`} value={h.query} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:flex">
            <select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)} className={selectCls}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} className={selectCls}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            <select aria-label="Time window" value={window_} onChange={(e) => setWindow(e.target.value as TimeWindow)} className={selectCls}>
              {TIME_WINDOWS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            {loading ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="flex-1 rounded-md bg-rose-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 lg:flex-none">
                Cancel
              </button>
            ) : (
              <button type="submit" disabled={!query.trim() || !selected.length} className="flex-1 rounded-md bg-sky-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-400 disabled:opacity-40 lg:flex-none">
                Search
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResponse(undefined);
                setSearch({ status: "idle" });
                setRowSel(new Set());
              }}
              className={btn}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          {!selected.length && !providersLoading && <span className="text-amber-300">Select at least one connected platform above.</span>}
          {(["country", "language", "window"] as const).map((k) => {
            const names = unsupported(k);
            return names.length ? (
              <span key={k}>
                {k === "window" ? "Time window" : k[0]!.toUpperCase() + k.slice(1)} not applied by: {names.join(", ")}
              </span>
            ) : null;
          })}
          {history.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              Recent:
              {history.slice(0, 5).map((h) => (
                <button key={`${h.query}|${h.at}`} type="button" onClick={() => replay(h)} disabled={loading} className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300 hover:bg-zinc-700">
                  {h.query}
                </button>
              ))}
              <button type="button" onClick={() => setHistory([])} className="text-zinc-600 hover:text-zinc-300">
                Clear history
              </button>
            </span>
          )}
        </div>
      </form>

      {search.status === "error" && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{search.error}</p>}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Searching">
          {selectedProviders.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" /> Querying {p.name}…
            </div>
          ))}
        </div>
      )}

      {response && !loading && (
        <>
          <section aria-label="Provider coverage" className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <p className="mb-2 text-xs font-medium text-emerald-300">Responded ({okOutcomes.length})</p>
              {okOutcomes.length ? (
                <ul className="space-y-1 text-xs">
                  {okOutcomes.map((o) => (
                    <li key={o.provider} className="flex flex-wrap gap-x-2 text-zinc-400">
                      <span className="text-zinc-200">{o.name}</span>
                      <span>
                        {o.resultCount} result{o.resultCount === 1 ? "" : "s"} · {o.durationMs} ms
                      </span>
                      {o.message && <span className="text-zinc-500">· {o.message}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">No provider responded.</p>
              )}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <p className={`mb-2 text-xs font-medium ${failedOutcomes.length ? "text-rose-300" : "text-zinc-500"}`}>No results ({failedOutcomes.length})</p>
              {failedOutcomes.length ? (
                <ul className="space-y-1 text-xs">
                  {failedOutcomes.map((o) => (
                    <li key={o.provider} className="text-zinc-400">
                      <span className="text-zinc-200">{o.name}</span> <span className={STATE_STYLE[o.state].text}>{o.status.replace("_", " ")}</span>
                      {o.message && <span className="text-zinc-500"> · {o.message}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">Every selected source responded.</p>
              )}
            </div>
          </section>

          <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Keywords returned" value={response.records.length} sub={`${tabRows.length} in ${TABS.find((t) => t.id === tab)!.label}`} />
            <MetricCard label="Providers" value={`${okOutcomes.length} / ${response.outcomes.length}`} sub="responded / queried" />
            <MetricCard
              label="Seed article views"
              value={seedRecord?.metrics[0] ? formatMetric(seedRecord.metrics[0]) : "—"}
              muted={!seedRecord?.metrics[0]}
              sub={seedRecord?.metrics[0] ? `Wikipedia “${seedRecord.keyword}” · ${seedRecord.metrics[0].period}` : "No reference article history"}
            />
            <MetricCard
              label="Trend"
              value={seedRecord?.trend ? `${seedRecord.trend.pct >= 0 ? "+" : ""}${seedRecord.trend.pct}%` : "—"}
              muted={!seedRecord?.trend}
              sub={seedRecord?.trend ? seedRecord.trend.window : "Needs comparable history"}
            />
            {adsMetric("avg_monthly_searches") ? (
              <MetricCard
                label="Avg. monthly searches"
                value={formatMetric(adsMetric("avg_monthly_searches")!)}
                sub={[adsMetric("avg_cpc") && `CPC ${formatMetric(adsMetric("avg_cpc")!)}`, adsMetric("competition_index") && `Competition ${formatMetric(adsMetric("competition_index")!)}`, "Google Ads"].filter(Boolean).join(" · ")}
              />
            ) : (
              <MetricCard
                label="Search volume · CPC"
                value="Not available"
                muted
                sub={byId["google-ads"] ? `Google Ads Keyword Planner: ${STATE_STYLE[byId["google-ads"].state].label.toLowerCase()}` : "Needs a search-ads data source"}
              />
            )}
            <MetricCard label="Fetched" value={new Date(response.fetchedAt).toLocaleTimeString()} sub={`${countryName(response.request.country)} · ${languageName(response.request.language)} · ${TIME_WINDOWS.find((w) => w.id === response.request.window)!.label}`} />
          </section>

          <section className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 lg:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-zinc-100">History</h2>
              {response.seedHistory ? (
                <HistoryChart history={response.seedHistory} providerName={providerNames[response.seedHistory.provider] ?? response.seedHistory.provider} />
              ) : (
                <p className="text-xs text-zinc-500">None of the selected sources returned history for this keyword. Monthly search history appears once Google Ads is connected.</p>
              )}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-100">Device distribution</h2>
              {response.devices ? <DeviceChart data={response.devices} /> : <p className="text-xs text-zinc-500">Device breakdown unavailable from the selected sources for this query.</p>}
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-[1fr_280px]">
            <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div role="tablist" aria-label="Keyword type" className="mb-3 flex gap-1 overflow-x-auto border-b border-zinc-800">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={tab === t.id}
                    onClick={() => {
                      setTab(t.id);
                      setRowSel(new Set());
                    }}
                    className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-sky-400 text-zinc-50" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
                  >
                    {t.label} <span className="ml-1 rounded bg-zinc-800 px-1.5 text-[11px] text-zinc-400">{tabCounts[t.id]}</span>
                  </button>
                ))}
              </div>
              <p className="mb-3 text-[11px] text-zinc-500">{TABS.find((t) => t.id === tab)!.method}</p>
              <KeywordTable
                rows={tabRows}
                providerNames={providerNames}
                columns={settings.columns}
                pageSize={settings.pageSize}
                filters={filters}
                onFilters={setFilters}
                selected={rowSel}
                onSelected={setRowSel}
                emptyMessage="The selected sources returned no keywords of this type."
                bulkActions={(visible) => {
                  const target = pickRows(visible);
                  const scope = rowSel.size ? `${rowSel.size} selected` : `${visible.length} shown`;
                  return (
                    <>
                      <span className="text-[11px] text-zinc-500">Apply to {scope}:</span>
                      <button
                        type="button"
                        disabled={!target.length}
                        className={btn}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(target.map((r) => r.keyword).join("\n"));
                            setToast(`Copied ${target.length} keyword(s)`);
                          } catch {
                            setToast("Clipboard access was blocked by the browser");
                          }
                        }}
                      >
                        Copy
                      </button>
                      <button type="button" disabled={!target.length} className={btn} onClick={() => download(`${fileBase()}.csv`, "\uFEFF" + toCsv(target, exportCtx()), "text/csv;charset=utf-8")}>
                        Export CSV
                      </button>
                      <button type="button" disabled={!target.length} className={btn} onClick={() => download(`${fileBase()}.json`, JSON.stringify(toJsonExport(target, exportCtx()), null, 2), "application/json")}>
                        Export JSON
                      </button>
                      <input
                        value={listName}
                        onChange={(e) => setListName(e.target.value)}
                        placeholder="List name"
                        aria-label="Keyword list name"
                        list="kw-lists"
                        className="w-28 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
                      />
                      <datalist id="kw-lists">
                        {lists.map((l) => (
                          <option key={l.id} value={l.name} />
                        ))}
                      </datalist>
                      <button type="button" disabled={!target.length} className={btn} onClick={() => addToList(target)}>
                        Add to list
                      </button>
                      {rowSel.size > 0 && (
                        <button type="button" className={btn} onClick={() => setRowSel(new Set())}>
                          Clear selection
                        </button>
                      )}
                    </>
                  );
                }}
              />
            </div>

            <aside className="space-y-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-100">Saved</h2>
                  <button
                    type="button"
                    className="text-xs text-sky-400 hover:text-sky-300"
                    onClick={() => {
                      const r = response.request;
                      setSaved((s) => [{ id: newId(), name: `${r.query} · ${r.country}`, query: r.query, country: r.country, language: r.language, window: r.window, providers: r.providers, at: new Date().toISOString() }, ...s]);
                      setToast("Search saved");
                    }}
                  >
                    Save search
                  </button>
                </div>
                <SavedPanel
                  saved={saved}
                  onRun={replay}
                  onDeleteSaved={(id) => setSaved((s) => s.filter((x) => x.id !== id))}
                  lists={lists}
                  onDeleteList={(id) => setLists((ls) => ls.filter((l) => l.id !== id))}
                  onRemoveItem={(listId, kw, provider) =>
                    setLists((ls) => ls.map((l) => (l.id === listId ? { ...l, items: l.items.filter((i) => !(i.keyword === kw && i.provider === provider)), updatedAt: new Date().toISOString() } : l)))
                  }
                />
              </div>
              {aiConfigured && (
                <div className="rounded-xl border border-violet-500/20 bg-zinc-900/40 p-4">
                  <h2 className="mb-2 text-sm font-semibold text-zinc-100">AI expansion</h2>
                  <AiPanel configured={aiConfigured} query={response.query} observed={response.records.map((r) => r.keyword)} country={response.request.country} language={response.request.language} />
                </div>
              )}
            </aside>
          </section>
        </>
      )}

      {!response && !loading && search.status !== "error" && (
        <section className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
            <p className="text-sm text-zinc-300">Enter a product, category or brand and press Search.</p>
            <p className="mx-auto mt-2 max-w-xl text-xs text-zinc-500">
              Results come live from the connected sources above. Marketplaces marked Not configured need your API credentials before they return listings; click a source to see what it needs.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-2 text-sm font-semibold text-zinc-100">Saved</h2>
            <SavedPanel
              saved={saved}
              onRun={replay}
              onDeleteSaved={(id) => setSaved((s) => s.filter((x) => x.id !== id))}
              lists={lists}
              onDeleteList={(id) => setLists((ls) => ls.filter((l) => l.id !== id))}
              onRemoveItem={(listId, kw, provider) =>
                setLists((ls) => ls.map((l) => (l.id === listId ? { ...l, items: l.items.filter((i) => !(i.keyword === kw && i.provider === provider)), updatedAt: new Date().toISOString() } : l)))
              }
            />
          </div>
        </section>
      )}

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={(s) => {
          setSettings(s);
          setCountry(s.country);
          setLanguage(s.language);
          setWindow(s.window);
        }}
      />

      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50">
        {toast && <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 shadow-lg">{toast}</div>}
      </div>
    </div>
  );
}
