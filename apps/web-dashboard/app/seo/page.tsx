import type { Metadata } from "next";
import { SeoIntelligenceWorkspace } from "@/components/seo/workspace";
import { getGscStatus } from "@/lib/gsc/client";

export const metadata: Metadata = { title: "SEO intelligence" };
export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const initialGsc = await getGscStatus(process.env);
  return <SeoIntelligenceWorkspace initialGsc={initialGsc} />;
}
