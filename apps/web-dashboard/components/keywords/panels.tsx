"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES, LANGUAGES } from "@/lib/keywords/locales";
import { STACK_SITES } from "@/lib/keywords/stack-sites";
import { TIME_WINDOWS } from "@/lib/keywords/types";
import { COLUMN_LABELS, DEFAULT_SETTINGS, download, type ColumnId, type KeywordList, type SavedSearch, type Settings } from "./storage";

const selectCls = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200";

export function SettingsDrawer({ open, onClose, settings, onChange }: { open: boolean; onClose: () => void; settings: Settings; onChange: (s: Settings) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} aria-label="Search settings" className="ml-auto mr-0 h-full max-h-none w-[min(92vw,380px)] border-l border-zinc-800 bg-zinc-950 p-0 text-zinc-200 backdrop:bg-black/50">
      <div className="space-y-5 p-5 text-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-50">Search settings</h2>
          <button type="button" onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-100">
            Close
          </button>
        </div>
        <p className="text-xs text-zinc-500">Saved in this browser only. Defaults apply to new searches.</p>

        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Default country</span>
          <select className={selectCls} value={settings.country} onChange={(e) => onChange({ ...settings, country: e.target.value })}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Default language</span>
          <select className={selectCls} value={settings.language} onChange={(e) => onChange({ ...settings, language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Default time window</span>
          <select className={selectCls} value={settings.window} onChange={(e) => onChange({ ...settings, window: e.target.value as Settings["window"] })}>
            {TIME_WINDOWS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Stack Exchange site for questions</span>
          <select className={selectCls} value={settings.stackExchangeSite} onChange={(e) => onChange({ ...settings, stackExchangeSite: e.target.value })}>
            {STACK_SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Rows per page</span>
          <select className={selectCls} value={settings.pageSize} onChange={(e) => onChange({ ...settings, pageSize: Number(e.target.value) })}>
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs text-zinc-400">Table columns</legend>
          {(Object.keys(COLUMN_LABELS) as ColumnId[]).map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" className="accent-sky-500" checked={settings.columns[c]} onChange={(e) => onChange({ ...settings, columns: { ...settings.columns, [c]: e.target.checked } })} />
              {COLUMN_LABELS[c]}
            </label>
          ))}
        </fieldset>
        <button type="button" onClick={() => onChange(DEFAULT_SETTINGS)} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500">
          Restore defaults
        </button>
      </div>
    </dialog>
  );
}

export function SavedPanel({
  saved,
  onRun,
  onDeleteSaved,
  lists,
  onDeleteList,
  onRemoveItem,
}: {
  saved: SavedSearch[];
  onRun: (s: SavedSearch) => void;
  onDeleteSaved: (id: string) => void;
  lists: KeywordList[];
  onDeleteList: (id: string) => void;
  onRemoveItem: (listId: string, keyword: string, provider: string) => void;
}) {
  const [openList, setOpenList] = useState<string | undefined>();
  return (
    <div className="space-y-4 text-xs">
      <div>
        <h3 className="mb-1.5 font-semibold text-zinc-300">Saved searches</h3>
        {saved.length === 0 ? (
          <p className="text-zinc-500">None yet. Run a search and choose “Save search”.</p>
        ) : (
          <ul className="space-y-1">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => onRun(s)} className="truncate text-left text-sky-400 hover:text-sky-300" title={`${s.query} · ${s.country} · ${s.language} · ${s.window}`}>
                  {s.name}
                </button>
                <button type="button" onClick={() => onDeleteSaved(s.id)} aria-label={`Delete saved search ${s.name}`} className="text-zinc-500 hover:text-rose-400">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-1.5 font-semibold text-zinc-300">Keyword lists</h3>
        {lists.length === 0 ? (
          <p className="text-zinc-500">Select rows in the table and use “Add to list”.</p>
        ) : (
          <ul className="space-y-2">
            {lists.map((l) => (
              <li key={l.id} className="rounded border border-zinc-800 p-2">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setOpenList(openList === l.id ? undefined : l.id)} aria-expanded={openList === l.id} className="truncate text-left text-zinc-200 hover:text-white">
                    {l.name} <span className="text-zinc-500">({l.items.length})</span>
                  </button>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => download(`${l.name.replace(/[^\w-]+/g, "_")}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), ...l }, null, 2), "application/json")}
                      className="text-zinc-400 hover:text-zinc-100"
                    >
                      Export
                    </button>
                    <button type="button" onClick={() => onDeleteList(l.id)} aria-label={`Delete list ${l.name}`} className="text-zinc-500 hover:text-rose-400">
                      ✕
                    </button>
                  </span>
                </div>
                {openList === l.id && (
                  <ul className="mt-2 max-h-48 space-y-0.5 overflow-auto">
                    {l.items.map((it) => (
                      <li key={`${it.provider}:${it.keyword}`} className="flex items-center justify-between gap-2 text-zinc-400">
                        <span className="truncate" title={`${it.provider} · from “${it.query}”`}>
                          {it.keyword}
                        </span>
                        <button type="button" onClick={() => onRemoveItem(l.id, it.keyword, it.provider)} aria-label={`Remove ${it.keyword}`} className="text-zinc-600 hover:text-rose-400">
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-zinc-600">Stored on this device only. Account sync needs the Supabase keyword tables (see docs).</p>
    </div>
  );
}

type AiState = { status: "idle" | "loading" | "error" | "done"; error?: string; model?: string; generatedAt?: string; ideas?: { keyword: string; rationale: string }[] };

export function AiPanel({ configured, query, observed, country, language }: { configured: boolean | undefined; query?: string; observed: string[]; country: string; language: string }) {
  const [state, setState] = useState<AiState>({ status: "idle" });
  const [forQuery, setForQuery] = useState<string | undefined>();
  if (forQuery !== query) {
    setForQuery(query);
    setState({ status: "idle" });
  }

  async function run() {
    if (!query) return;
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/keywords/ai-expand", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, observed, country, language }) });
      const data = await res.json();
      if (!res.ok) setState({ status: "error", error: data.error ?? `HTTP ${res.status}` });
      else setState({ status: "done", ...data });
    } catch (err) {
      setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="text-xs">
      <p className="text-zinc-400">AI expansion suggests extra keyword ideas. They are hypotheses with no metrics until validated by a data source.</p>
      {configured === false ? (
        <p className="mt-2 rounded border border-zinc-800 bg-zinc-950 p-2 text-zinc-500">Not configured. Set OPENAI_API_KEY (and optionally OPENAI_MODEL) on the server to enable.</p>
      ) : (
        <button
          type="button"
          disabled={!query || state.status === "loading" || configured === undefined}
          onClick={run}
          className="mt-2 rounded-md border border-violet-500/50 bg-violet-500/10 px-3 py-1.5 text-violet-200 hover:bg-violet-500/20 disabled:opacity-40"
        >
          {state.status === "loading" ? "Generating…" : query ? `Expand “${query}” with AI` : "Search first"}
        </button>
      )}
      {state.status === "error" && <p className="mt-2 text-rose-300">{state.error}</p>}
      {state.status === "done" && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] text-violet-300">
            AI-generated · {state.model} · {state.generatedAt ? new Date(state.generatedAt).toLocaleTimeString() : ""} · unverified
          </p>
          {state.ideas?.length ? (
            <ul className="space-y-1">
              {state.ideas.map((i) => (
                <li key={i.keyword} className="rounded border border-violet-500/20 bg-violet-500/5 px-2 py-1">
                  <span className="text-zinc-100">{i.keyword}</span>
                  {i.rationale && <span className="block text-zinc-500">{i.rationale}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-zinc-500">The model returned no usable ideas.</p>
          )}
        </div>
      )}
    </div>
  );
}
