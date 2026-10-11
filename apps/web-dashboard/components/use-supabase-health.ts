"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthResponse } from "@/lib/supabase-diagnostics";

export type HealthState = { status: "loading" } | { status: "ready"; data: HealthResponse } | { status: "error"; message: string };

export function useSupabaseHealth() {
  const [state, setState] = useState<HealthState>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/health/supabase", { cache: "no-store" });
      if (!res.ok) throw new Error(`Diagnostics endpoint returned HTTP ${res.status}`);
      setState({ status: "ready", data: (await res.json()) as HealthResponse });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount; state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    setState({ status: "loading" });
    void load();
  }, [load]);

  return { state, refresh };
}
