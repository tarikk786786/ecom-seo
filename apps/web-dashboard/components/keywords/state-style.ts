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
