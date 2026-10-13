"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type ConnectCardProps = {
  provider: string;
  name: string;
  gain: string;
  cost: string;
  loginUrl: string;
  loginLabel: string;
  steps: string[];
  fields: { env: string; label: string; secret: boolean; hint?: string; saved: boolean; value?: string }[];
  enabled: boolean;
};

type Result = { tone: "ok" | "warn" | "error"; text: string };

export function ConnectCard(p: ConnectCardProps) {
  const router = useRouter();
  const connected = p.fields.every((f) => f.saved);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>();

  async function send(values: Record<string, unknown>) {
    setBusy(true);
    setResult(undefined);
    try {
      const res = await fetch("/api/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: p.provider, values }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; live?: boolean; removed?: boolean };
      if (!res.ok) setResult({ tone: "error", text: body.error ?? `Something went wrong (HTTP ${res.status}).` });
      else {
        setResult({ tone: body.live || body.removed ? "ok" : "warn", text: body.message ?? "Saved." });
        if (body.live || body.removed) setOpen(false);
        router.refresh();
      }
    } catch {
      setResult({ tone: "error", text: "Couldn't reach the dashboard. Is it still running?" });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void send(Object.fromEntries(p.fields.map((f) => [f.env, String(data.get(f.env) ?? "")])));
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100">{p.name}</h2>
          <p className="mt-1 text-sm text-zinc-400">{p.gain}</p>
          <p className="mt-1 text-xs text-zinc-500">{p.cost}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${connected ? "text-emerald-300" : "text-zinc-400"}`}>
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-500"}`} />
          {connected ? "Keys saved" : "Using free public data"}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={p.loginUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-sky-400"
        >
          {p.loginLabel} ↗
        </a>
        {p.enabled && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            {open ? "Cancel" : connected ? "Replace keys" : "Paste keys"}
          </button>
        )}
        {p.enabled && connected && !open && (
          <button type="button" disabled={busy} onClick={() => void send({ __remove: true })} className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition hover:text-rose-300 disabled:opacity-50">
            Remove keys
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={onSubmit} className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-400">
            {p.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {p.fields.map((f) => (
            <label key={f.env} className="block">
              <span className="text-xs font-medium text-zinc-300">{f.label}</span>
              <input
                name={f.env}
                type={f.secret ? "password" : "text"}
                defaultValue={f.secret ? "" : f.value}
                autoComplete="off"
                spellCheck={false}
                required={!f.saved}
                placeholder={f.saved ? "Saved. Leave blank to keep it." : f.hint ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:font-sans placeholder:text-zinc-600 focus:border-sky-500"
              />
            </label>
          ))}
          <button type="submit" disabled={busy} className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-60">
            {busy ? "Saving and testing…" : "Save and test"}
          </button>
        </form>
      )}

      {result && (
        <p role="status" className={`mt-3 text-sm ${result.tone === "ok" ? "text-emerald-300" : result.tone === "warn" ? "text-amber-300" : "text-rose-300"}`}>
          {result.text}
        </p>
      )}
    </section>
  );
}
