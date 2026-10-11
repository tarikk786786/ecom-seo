"use client";

import type { ProviderStatus } from "@/lib/keywords/registry";
import type { ProviderState } from "@/lib/keywords/types";

export const STATE_STYLE: Record<ProviderState, { dot: string; label: string; text: string }> = {
  CONNECTED: { dot: "bg-emerald-400", label: "Connected", text: "text-emerald-300" },
  CONNECTING: { dot: "bg-sky-400 animate-pulse", label: "Checking", text: "text-sky-300" },
  DEGRADED: { dot: "bg-amber-400", label: "Degraded", text: "text-amber-300" },
  RATE_LIMITED: { dot: "bg-amber-400", label: "Rate limited", text: "text-amber-300" },
  ERROR: { dot: "bg-rose-500", label: "Error", text: "text-rose-300" },
  DISCONNECTED: { dot: "bg-rose-500", label: "Disconnected", text: "text-rose-300" },
  NOT_CONFIGURED: { dot: "bg-zinc-500", label: "Not configured", text: "text-zinc-400" },
  ACCESS_REQUIRED: { dot: "bg-violet-400", label: "Access required", text: "text-violet-300" },
  DISABLED: { dot: "bg-zinc-700", label: "Disabled", text: "text-zinc-500" },
};

export const isUsable = (p: ProviderStatus) => p.implemented && p.config.ok && p.state !== "DISABLED";

export function PlatformRow({
  providers,
  selected,
  onToggle,
  focused,
  onFocus,
  loading,
}: {
  providers: ProviderStatus[];
  selected: string[];
  onToggle: (id: string) => void;
  focused?: string;
  onFocus: (id: string | undefined) => void;
  loading: boolean;
}) {
  const detail = providers.find((p) => p.id === focused);
  return (
    <div>
      <div role="group" aria-label="Platforms" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {providers.map((p) => {
          const usable = isUsable(p);
          const on = usable && selected.includes(p.id);
          const st = STATE_STYLE[p.state];
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={usable ? on : undefined}
              aria-label={`${p.name}: ${st.label}${usable ? (on ? ", selected" : ", not selected") : ", show setup requirements"}`}
              title={`${p.name} — ${st.label}`}
              onClick={() => {
                if (usable) onToggle(p.id);
                onFocus(focused === p.id && !usable ? undefined : p.id);
              }}
              className={`group relative flex shrink-0 flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] transition ${
                on ? "border-sky-500/70 bg-sky-500/10" : usable ? "border-zinc-800 bg-zinc-900 hover:border-zinc-600" : "border-dashed border-zinc-800 bg-zinc-950 opacity-70 hover:opacity-100"
              }`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-md text-[11px] font-bold" style={{ background: `${p.color}22`, color: p.color }}>
                {p.glyph}
              </span>
              <span className="max-w-16 truncate text-zinc-400">{p.name.split(" (")[0]}</span>
              <span aria-hidden className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${loading && p.implemented ? STATE_STYLE.CONNECTING.dot : st.dot}`} />
            </button>
          );
        })}
      </div>

      {detail && (
        <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-xs" role="region" aria-label={`${detail.name} details`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-zinc-100">
              {detail.name} <span className={`ml-1 ${STATE_STYLE[detail.state].text}`}>· {STATE_STYLE[detail.state].label}</span>
              {detail.latencyMs !== undefined && <span className="ml-1 text-zinc-500">· live check {detail.latencyMs} ms</span>}
            </p>
            <button type="button" onClick={() => onFocus(undefined)} className="text-zinc-500 hover:text-zinc-200">
              Close
            </button>
          </div>
          {detail.detail && <p className="mt-1 text-zinc-400">{detail.detail}</p>}
          <p className="mt-1 text-zinc-400">
            <span className="text-zinc-500">Access: </span>
            {detail.access}{" "}
            <a href={detail.docsUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">
              Docs ↗
            </a>
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-zinc-500">Provides</p>
              <ul className="list-disc pl-4 text-zinc-300">{detail.provides.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div>
              <p className="text-zinc-500">Not provided</p>
              <ul className="list-disc pl-4 text-zinc-400">{detail.notProvided.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
          <p className="mt-2 text-zinc-500">
            Filters: country {detail.supports.country ? "supported" : "not supported"} · language {detail.supports.language ? "supported" : "not supported"} · time window{" "}
            {detail.supports.window ? "supported" : "not supported"}
            {detail.checkedAt && ` · last checked ${new Date(detail.checkedAt).toLocaleTimeString()}`}
          </p>
        </div>
      )}
    </div>
  );
}
