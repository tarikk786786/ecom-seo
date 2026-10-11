import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/card";
import { ConnectionBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "AI trend analysis" };

const RULES = [
  "Every factual claim must cite the IDs of stored evidence records; uncited claims are removed.",
  "Numbers that do not appear in the evidence are rejected.",
  "Relative indices (such as Google Trends 0–100) are never converted into absolute search volumes.",
  "Instructions found inside fetched web content are treated as data, not commands.",
  "Output can be requested in English, Hindi or Hinglish.",
];

export default function AiPage() {
  return (
    <>
      <PageHeader title="AI trend analysis" description="Evidence-grounded summaries of trend and keyword data." />
      <Card title="Status" action={<ConnectionBadge state="not_integrated" />}>
        <p className="text-sm text-zinc-300">
          AI analysis is not available yet. It needs a configured AI provider on the server and stored evidence from connected data providers. No AI output is
          generated or simulated on this page.
        </p>
      </Card>
      <Card title="Grounding rules the analysis will enforce" className="mt-4">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-400">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
