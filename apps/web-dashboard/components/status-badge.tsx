import type { ConnectionState } from "@/lib/supabase-diagnostics";

const CONNECTION: Record<ConnectionState, { label: string; tone: string }> = {
  configured: { label: "Configured", tone: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  checking: { label: "Checking connection", tone: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300" },
  connected: { label: "Connected", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  reachable: { label: "Reachable", tone: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  auth_required: { label: "Authentication required", tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  missing_config: { label: "Missing environment configuration", tone: "border-orange-500/40 bg-orange-500/10 text-orange-300" },
  connection_error: { label: "Connection error", tone: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  not_integrated: { label: "Not yet integrated", tone: "border-zinc-600/50 bg-zinc-800/60 text-zinc-400" },
  reachable_unverified: { label: "Reachable · not verified", tone: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  not_found: { label: "Not found", tone: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300" },
};

function Pill({ label, tone, pulse }: { label: string; tone: string; pulse?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${pulse ? "animate-pulse" : ""}`} aria-hidden />
      {label}
    </span>
  );
}

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const s = CONNECTION[state];
  return <Pill label={s.label} tone={s.tone} pulse={state === "checking"} />;
}
