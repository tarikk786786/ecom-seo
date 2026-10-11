"use client";

import Link from "next/link";
import type { CheckResult, ConnectionState } from "@/lib/supabase-diagnostics";
import { Card } from "./card";
import { ConnectionBadge } from "./status-badge";
import { useSupabaseHealth } from "./use-supabase-health";

function Row({ label, result, children }: { label: string; result?: CheckResult; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 border-t border-zinc-800 py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        {result && <p className="mt-0.5 text-xs text-zinc-400">{result.summary}</p>}
        {result?.detail && <p className="mt-1 break-words font-mono text-[11px] text-zinc-500">{result.detail}</p>}
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {result?.latencyMs !== undefined && <span className="text-[11px] tabular-nums text-zinc-500">{result.latencyMs} ms</span>}
        <ConnectionBadge state={result?.state ?? "checking"} />
      </div>
    </li>
  );
}

/** Live diagnostics from /api/health/supabase. `compact` shows the overall verdict only. */
export function SupabaseStatus({ compact = false }: { compact?: boolean }) {
  const { state, refresh } = useSupabaseHealth();
  const loading = state.status === "loading";

  const action = (
    <button
      type="button"
      onClick={refresh}
      disabled={loading}
      className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
    >
      {loading ? "Checking…" : "Re-check"}
    </button>
  );

  if (state.status === "error") {
    return (
      <Card title="Supabase" action={action}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-rose-300">Diagnostics failed: {state.message}</p>
          <ConnectionBadge state="connection_error" />
        </div>
      </Card>
    );
  }

  const d = state.status === "ready" ? state.data : undefined;

  if (compact) {
    const overall: ConnectionState = !d
      ? "checking"
      : d.configuration.state === "missing_config"
        ? "missing_config"
        : d.endpoint.state === "connection_error"
          ? "connection_error"
          : d.auth.state;
    return (
      <Card title="Supabase backend" action={<ConnectionBadge state={overall} />}>
        {!d ? (
          <p className="text-sm text-zinc-400">Running live diagnostics…</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-zinc-300">
              Project <span className="font-mono text-zinc-100">{d.projectRef ?? "unknown"}</span>
            </p>
            <p className="text-xs text-zinc-400">
              Endpoint: {d.endpoint.summary} Auth: {d.auth.summary}
            </p>
            <Link href="/integrations" className="inline-block text-xs text-sky-400 hover:text-sky-300">
              Full diagnostics →
            </Link>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card
      title={
        <span>
          Supabase diagnostics {d?.projectRef && <span className="ml-1 font-mono text-xs font-normal text-zinc-500">{d.projectRef}</span>}
        </span>
      }
      action={action}
    >
      <ul>
        <Row label="1. Environment configuration" result={d?.configuration}>
          {d?.configuration.issues.length ? (
            <ul className="mt-1 list-disc pl-4 text-xs text-orange-300">
              {d.configuration.issues.map((i) => (
                <li key={i.variable + i.problem}>
                  <span className="font-mono">{i.variable}</span>: {i.problem.replace("_", " ")}
                </li>
              ))}
            </ul>
          ) : null}
        </Row>
        <Row label="2. Endpoint reachability" result={d?.endpoint} />
        <Row label="3. Auth service" result={d?.auth}>
          {d?.auth.emailSignInEnabled !== undefined && (
            <p className="mt-1 text-xs text-zinc-500">
              Email sign-in {d.auth.emailSignInEnabled ? "enabled" : "disabled"}
              {d.auth.signupDisabled !== undefined && ` · new sign-ups ${d.auth.signupDisabled ? "disabled" : "allowed"}`}
            </p>
          )}
        </Row>
        <Row label="4. Database via Data API" result={d?.dataApi}>
          {d?.dataApi.exposedTables && (
            <p className="mt-1 text-xs text-zinc-500">Exposed: {d.dataApi.exposedTables.length ? d.dataApi.exposedTables.join(", ") : "no tables"}</p>
          )}
        </Row>
        <Row
          label="5. Current user"
          result={
            d
              ? {
                  state: d.session.state === "signed_in" ? "connected" : d.session.state === "signed_out" ? "auth_required" : "missing_config",
                  summary: d.session.state === "signed_in" ? `Signed in as ${d.session.email ?? "user"} (JWT verified with getClaims).` : d.session.state === "signed_out" ? "Not signed in." : (d.session.detail ?? "Unavailable."),
                }
              : undefined
          }
        />
      </ul>
      {d && <p className="mt-3 text-[11px] text-zinc-500">Checked {new Date(d.checkedAt).toLocaleString()} · project checks are cached for 15 s</p>}
    </Card>
  );
}
