import type { Metadata } from "next";
import { KeywordWorkspace } from "@/components/keywords/workspace";

export const metadata: Metadata = { title: "Keyword research" };

export default function KeywordResearchPage() {
  return <KeywordWorkspace />;
}
