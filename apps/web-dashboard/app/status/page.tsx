import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/card";
import { BuildBadge } from "@/components/status-badge";
import { FEATURES, REPO_URL } from "@/lib/features";

export const metadata: Metadata = { title: "Build status" };

export default function StatusPage() {
  const areas = [...new Set(FEATURES.map((f) => f.area))];
  return (
    <>
      <PageHeader
        title="Build status"
        description={
          <>
            What exists in this repository today. Mirrors <code className="font-mono">FEATURE_STATUS.md</code> in{" "}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">
              ecom-seo
            </a>
            .
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {areas.map((area) => (
          <Card key={area} title={area}>
            <ul className="divide-y divide-zinc-800">
              {FEATURES.filter((f) => f.area === area).map((f) => (
                <li key={f.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div>
                    <p className="text-sm text-zinc-200">{f.name}</p>
                    <p className="text-xs text-zinc-500">{f.note}</p>
                  </div>
                  <BuildBadge status={f.status} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
