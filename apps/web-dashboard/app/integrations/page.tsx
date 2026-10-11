import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/card";
import { ConnectionBadge } from "@/components/status-badge";
import { SupabaseStatus } from "@/components/supabase-status";

export const metadata: Metadata = { title: "Integrations" };

type Planned = { name: string; access: string; provides: string; docs: string };

const GOOGLE: Planned[] = [
  { name: "Google Trends", access: "Official Trends API is in limited alpha; the public daily trending RSS feed needs no credentials.", provides: "Relative interest (0–100 index) and trending searches. Relative values are never converted into search counts.", docs: "https://developers.google.com/search/apis/trends" },
  { name: "Google Ads Keyword Planner", access: "Google Ads developer token plus OAuth consent from an Ads account.", provides: "Keyword ideas and average monthly search ranges.", docs: "https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas" },
  { name: "Google Search Console", access: "OAuth consent for a verified property.", provides: "Clicks, impressions, CTR and position for your own site.", docs: "https://developers.google.com/webmaster-tools/v1/searchanalytics/query" },
  { name: "YouTube Data API", access: "API key with daily quota (search costs 100 units per call).", provides: "Video counts and public engagement statistics.", docs: "https://developers.google.com/youtube/v3/docs/search/list" },
];

const MARKETPLACES: Planned[] = [
  { name: "Amazon Creators API", access: "Amazon Associates account with API access for each marketplace (e.g. amazon.in).", provides: "Product search, offers and prices from Amazon's catalog.", docs: "https://affiliate-program.amazon.com/" },
  { name: "Amazon Selling Partner API", access: "Seller Central developer registration and seller authorization.", provides: "Your own listings, orders and inventory only (not general market data).", docs: "https://developer-docs.amazon.com/sp-api" },
  { name: "Flipkart Affiliate API", access: "Flipkart Affiliate ID and token.", provides: "Product search and offers from Flipkart's affiliate catalog.", docs: "https://affiliate.flipkart.com" },
  { name: "Flipkart Seller API", access: "Approved Flipkart seller account and app credentials.", provides: "Your own listings and orders only.", docs: "https://seller.flipkart.com" },
];

function PlannedList({ items }: { items: Planned[] }) {
  return (
    <ul className="divide-y divide-zinc-800">
      {items.map((p) => (
        <li key={p.name} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200">{p.name}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{p.provides}</p>
            <p className="mt-1 text-xs text-zinc-500">Requires: {p.access}</p>
            <a href={p.docs} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-sky-400 hover:text-sky-300">
              Provider documentation ↗
            </a>
          </div>
          <ConnectionBadge state="not_integrated" />
        </li>
      ))}
    </ul>
  );
}

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Supabase status comes from live, read-only checks run by the server. Provider integrations below are not yet implemented in this repository, so they show their real status rather than sample data."
      />
      <div className="space-y-6">
        <SupabaseStatus />
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Google integrations">
            <PlannedList items={GOOGLE} />
          </Card>
          <div id="marketplaces">
            <Card title="Marketplace integrations">
              <PlannedList items={MARKETPLACES} />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
