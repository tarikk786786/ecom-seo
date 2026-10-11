import Link from "next/link";
import { Card, PageHeader } from "@/components/card";
import { BuildBadge, ConnectionBadge } from "@/components/status-badge";
import { SupabaseStatus } from "@/components/supabase-status";
import { getCurrentUser } from "@/lib/auth";
import { FEATURES, REPO_URL } from "@/lib/features";

const SECTIONS = [
  { href: "/integrations", title: "Google integrations", body: "Trends, Keyword Planner, Search Console and YouTube.", ids: ["google-trends", "google-ads", "search-console", "youtube"] },
  { href: "/integrations#marketplaces", title: "Marketplaces", body: "Amazon and Flipkart product search through official APIs.", ids: ["amazon", "flipkart"] },
  { href: "/keywords", title: "Keyword research", body: "Multi-source keyword evidence with provenance.", ids: ["keyword-research"] },
  { href: "/ai", title: "AI trend analysis", body: "Summaries that must cite stored evidence.", ids: ["ai-analysis"] },
];

export default async function OverviewPage() {
  const user = await getCurrentUser();
  const implemented = FEATURES.filter((f) => f.status === "implemented").length;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Foundation of the Ecom SEO Trend Intelligence platform. Statuses below come from live checks or the repository's build status. No trend, keyword or product data is shown until a real provider is connected."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SupabaseStatus compact />
        </div>
        <Card title="Your session" action={<ConnectionBadge state={user ? "connected" : "auth_required"} />}>
          {user ? (
            <p className="text-sm text-zinc-300">
              Signed in as <span className="text-zinc-100">{user.email ?? user.id}</span>.{" "}
              <Link href="/account" className="text-sky-400 hover:text-sky-300">
                Account →
              </Link>
            </p>
          ) : (
            <p className="text-sm text-zinc-400">
              You are browsing anonymously.{" "}
              <Link href="/login" className="text-sky-400 hover:text-sky-300">
                Sign in or create an account →
              </Link>
            </p>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Modules</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-600">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-white">{s.title}</h3>
              <ConnectionBadge state="not_integrated" />
            </div>
            <p className="mt-2 text-xs text-zinc-400">{s.body}</p>
            <p className="mt-3 text-[11px] text-zinc-500">
              {s.ids.length} provider{s.ids.length > 1 ? "s" : ""} planned
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Build status"
          action={
            <Link href="/status" className="text-xs text-sky-400 hover:text-sky-300">
              All features →
            </Link>
          }
        >
          <p className="mb-3 text-xs text-zinc-500">
            {implemented} of {FEATURES.length} tracked features implemented in this repository.
          </p>
          <ul className="divide-y divide-zinc-800">
            {FEATURES.slice(0, 6).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-zinc-300">{f.name}</span>
                <BuildBadge status={f.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Source code">
          <p className="text-sm text-zinc-400">Every verified change is committed to the project repository.</p>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-sm text-sky-400 hover:text-sky-300">
            {REPO_URL} ↗
          </a>
        </Card>
      </div>
    </>
  );
}
