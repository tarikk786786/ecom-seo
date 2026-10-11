"use client";

import { useCallback, useEffect, useState } from "react";
import type { KeywordRecord, TimeWindow } from "@/lib/keywords/types";

export type Settings = {
  country: string;
  language: string;
  window: TimeWindow;
  providers: string[] | null;
  stackExchangeSite: string;
  pageSize: number;
  columns: Record<ColumnId, boolean>;
};

export type ColumnId = "provider" | "metric" | "trend" | "sparkline" | "intent" | "locale" | "observed";

export const COLUMN_LABELS: Record<ColumnId, string> = {
  provider: "Source",
  metric: "Metric (source-specific)",
  trend: "Trend",
  sparkline: "History",
  intent: "Intent (rule-based)",
  locale: "Country / language",
  observed: "Observed",
};

export const DEFAULT_SETTINGS: Settings = {
  country: "IN",
  language: "en",
  window: "30d",
  providers: null,
  stackExchangeSite: "superuser",
  pageSize: 25,
  columns: { provider: true, metric: true, trend: true, sparkline: true, intent: true, locale: false, observed: false },
};

export type HistoryEntry = { query: string; country: string; language: string; window: TimeWindow; providers: string[]; at: string };
export type SavedSearch = HistoryEntry & { id: string; name: string };
export type ListItem = Pick<KeywordRecord, "keyword" | "provider" | "category" | "sourceUrl" | "fetchedAt"> & { addedAt: string; query: string };
export type KeywordList = { id: string; name: string; items: ListItem[]; updatedAt: string };

const KEYS = { settings: "ecomseo.kw.settings.v1", history: "ecomseo.kw.history.v1", saved: "ecomseo.kw.saved.v1", lists: "ecomseo.kw.lists.v1" } as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** localStorage-backed state. Starts with the fallback on the server and the first client render. */
function useStored<T>(key: string, fallback: T, merge?: (stored: T) => T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const stored = read(key, fallback);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setValue(merge ? merge(stored) : stored);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(v));
        } catch {
          /* storage full or disabled: keep in memory */
        }
        return v;
      });
    },
    [key],
  );
  return [value, update, loaded] as const;
}

export const useSettings = () =>
  useStored<Settings>(KEYS.settings, DEFAULT_SETTINGS, (s) => ({ ...DEFAULT_SETTINGS, ...s, columns: { ...DEFAULT_SETTINGS.columns, ...s?.columns } }));
export const useHistory = () => useStored<HistoryEntry[]>(KEYS.history, []);
export const useSavedSearches = () => useStored<SavedSearch[]>(KEYS.saved, []);
export const useLists = () => useStored<KeywordList[]>(KEYS.lists, []);

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function pushHistory(list: HistoryEntry[], entry: HistoryEntry, max = 20): HistoryEntry[] {
  const key = (e: HistoryEntry) => `${e.query.toLowerCase()}|${e.country}|${e.language}|${e.window}`;
  return [entry, ...list.filter((e) => key(e) !== key(entry))].slice(0, max);
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
