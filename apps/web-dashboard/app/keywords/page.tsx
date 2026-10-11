import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/card";
import { ConnectionBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Keyword research" };

const PLAN = [
  "Each result keeps its source, metric definition, country, retrieval time and evidence link.",
  "Sources are shown side by side; different metrics are never merged into one invented number.",
  "Unavailable providers are reported as unavailable, never as zero.",
  "Intent (informational, commercial, transactional, navigational) is labelled with its method and confidence.",
];

export default function KeywordsPage() {
  return (
    <>
      <PageHeader title="Keyword research" description="Search a keyword across connected trend and keyword providers." />
      <Card title="Status" action={<ConnectionBadge state="not_integrated" />}>
        <p className="text-sm text-zinc-300">
          Keyword search is not available yet because no keyword or trend provider is connected in this repository. A search box is intentionally not shown until it
          can return real results.
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Provider requirements are listed on the{" "}
          <Link href="/integrations" className="text-sky-400 hover:text-sky-300">
            Integrations
          </Link>{" "}
          page.
        </p>
      </Card>
      <Card title="How results will be presented" className="mt-4">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-400">
          {PLAN.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
