"use client";

import { useState, useTransition } from "react";
import { Card, PageHeader } from "@/components/card";
import type { PageAuditResult } from "@/lib/audits/page-audit";
import type { GscQueryResult, GscStatus } from "@/lib/gsc/types";

export function SeoIntelligenceWorkspace({ initialGsc }: { initialGsc: GscStatus }) {
  const [gsc, setGsc] = useState(initialGsc);
  const [gscResult, setGscResult] = useState<GscQueryResult | null>(null);
  const [auditUrl, setAuditUrl] = useState("");
  const [audit, setAudit] = useState<PageAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refreshStatus() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/gsc/status", { cache: "no-store" });
        const json = (await res.json()) as GscStatus & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Status check failed");
        setGsc(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Status check failed");
      }
    });
  }

  function runGscQuery() {
    startTransition(async () => {
      setError(null);
      setGscResult(null);
      try {
        const res = await fetch("/api/gsc/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dimensions: ["query"], rowLimit: 25 }),
        });
        const json = (await res.json()) as GscQueryResult & { error?: string; missing?: string[]; setup?: boolean };
        if (!res.ok) throw new Error(json.error ?? `Query failed (${res.status})`);
        setGscResult(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Query failed");
      }
    });
  }

  function runAudit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      setAudit(null);
      try {
        const res = await fetch("/api/audits/page", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: auditUrl }),
        });
        const json = (await res.json()) as PageAuditResult & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `Audit failed (${res.status})`);
        setAudit(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Audit failed");
      }
    });
  }

  return (
    <>
      <PageHeader
        title="SEO intelligence"
        description="Import authorized Search Console performance for your own verified properties, and run static HTML listing audits. Positions from Search Console are averages for your property—not guaranteed rankings for every shopper."
      />

      {error && (
        <p className="mb-4 rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Google Search Console"
          action={
            <button type="button" disabled={pending} onClick={refreshStatus} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">
              Re-check
            </button>
          }
        >
          <p className="text-sm text-zinc-300">
            State: <span className="font-medium text-zinc-100">{gsc.state}</span>
            {gsc.latencyMs !== undefined && <span className="text-zinc-500"> · {gsc.latencyMs} ms</span>}
          </p>
          <p className="mt-2 text-xs text-zinc-400">{gsc.detail}</p>
          {gsc.siteUrl && <p className="mt-2 text-xs text-zinc-500">Configured property: {gsc.siteUrl}</p>}
          {gsc.missing.length > 0 && (
            <ul className="mt-3 list-inside list-disc text-xs text-amber-200/90">
              {gsc.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {!gsc.configured && (
            <p className="mt-3 text-xs text-zinc-400">
              Setup: create a Google Cloud OAuth client, enable Search Console API, generate a refresh token with scope <code className="text-zinc-300">webmasters.readonly</code>, then set{" "}
              <code className="text-zinc-300">GSC_CLIENT_ID</code>, <code className="text-zinc-300">GSC_CLIENT_SECRET</code>, <code className="text-zinc-300">GSC_REFRESH_TOKEN</code>, and{" "}
              <code className="text-zinc-300">GSC_SITE_URL</code> in <code className="text-zinc-300">.env.local</code>. See docs/API_SETUP_GUIDE.md.
            </p>
          )}
          <button
            type="button"
            disabled={pending || !gsc.configured}
            onClick={runGscQuery}
            className="mt-4 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            Fetch top queries (28d)
          </button>

          {gscResult && (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-2 text-xs text-zinc-500">
                {gscResult.rows.length} rows · {gscResult.startDate} → {gscResult.endDate} · {gscResult.note}
              </p>
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-2">Query</th>
                    <th className="pb-2 pr-2">Clicks</th>
                    <th className="pb-2 pr-2">Impr.</th>
                    <th className="pb-2 pr-2">CTR</th>
                    <th className="pb-2">Avg pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {gscResult.rows.map((r, i) => (
                    <tr key={`${r.keys.join("|")}-${i}`} className="border-t border-zinc-800">
                      <td className="py-2 pr-2 text-zinc-200">{r.keys[0] ?? "—"}</td>
                      <td className="py-2 pr-2">{r.clicks}</td>
                      <td className="py-2 pr-2">{r.impressions}</td>
                      <td className="py-2 pr-2">{(r.ctr * 100).toFixed(1)}%</td>
                      <td className="py-2">{r.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Product page audit">
          <p className="mb-3 text-xs text-zinc-400">
            Fetches public http(s) HTML and checks titles, meta, headings, canonical, robots, viewport, image alt, and Product JSON-LD. Private IPs and metadata hosts are blocked. Does not run Lighthouse lab metrics yet.
          </p>
          <form onSubmit={runAudit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs text-zinc-400">
              Listing URL
              <input
                value={auditUrl}
                onChange={(e) => setAuditUrl(e.target.value)}
                required
                placeholder="https://www.example.com/product/…"
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <button type="submit" disabled={pending || !auditUrl.trim()} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40">
              Audit
            </button>
          </form>

          {audit && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-zinc-500">
                HTTP {audit.httpStatus} · {audit.finalUrl} · {audit.findings.length} findings · {audit.note}
              </p>
              <dl className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                <div>
                  <dt className="text-zinc-500">Title</dt>
                  <dd className="text-zinc-200">{audit.title ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">H1 count</dt>
                  <dd className="text-zinc-200">{audit.h1.length}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-zinc-500">Meta description</dt>
                  <dd className="text-zinc-200">{audit.metaDescription ?? "—"}</dd>
                </div>
              </dl>
              <ul className="space-y-2">
                {audit.findings.map((f) => (
                  <li key={f.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm">
                    <p className="font-medium text-zinc-100">
                      <span className="mr-2 text-xs uppercase text-zinc-500">{f.severity}</span>
                      {f.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">{f.detail}</p>
                    <p className="mt-1 text-xs text-sky-300/90">{f.recommendation}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
