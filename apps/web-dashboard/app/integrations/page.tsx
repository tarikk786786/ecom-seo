import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/card";
import { STATE_STYLE } from "@/components/keywords/state-style";
import { SupabaseStatus } from "@/components/supabase-status";
import { getProviderStatuses } from "@/lib/keywords/provider-status";
import type { ProviderStatus } from "@/lib/keywords/registry";

export const metadata: Metadata = { title: "Data sources" };
export const dynamic = "force-dynamic";

function SourceRow({ p }: { p: ProviderStatus }) {
  const st = STATE_STYLE[p.state];
  return (
    <li className="flex flex-col gap-2 border-t border-zinc-800 py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-200">{p.name}</p>
        <p className="mt-0.5 text-xs text-zinc-400">{p.provides.join(" · ")}</p>
        {p.state !== "CONNECTED" && <p className="mt-1 text-xs text-zinc-500">{p.detail ?? p.access}</p>}
        <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-sky-400 hover:text-sky-300">
          Provider documentation ↗
        </a>
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${st.text}`}>
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
        {st.label}
        {p.latencyMs !== undefined && p.state === "CONNECTED" && <span className="font-normal text-zinc-500">· {p.latencyMs} ms</span>}
      </span>
    </li>
  );
}

export default async function DataSourcesPage() {
  const { providers, checkedAt } = await getProviderStatuses();
  const groups = [...new Set(providers.map((p) => p.group))];
  const connected = providers.filter((p) => p.state === "CONNECTED").length;

  return (
    <>
      <PageHeader
        title="Data sources"
        description={`${connected} of ${providers.length} sources connected. Marketplace and search-volume sources need your own API credentials; until they are added they return nothing rather than estimates. Last checked ${new Date(checkedAt).toLocaleString()}.`}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {groups.map((g) => (
          <Card key={g} title={g}>
            <ul>
              {providers
                .filter((p) => p.group === g)
                .map((p) => (
                  <SourceRow key={p.id} p={p} />
                ))}
            </ul>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Account backend</h2>
      <SupabaseStatus />
    </>
  );
}
