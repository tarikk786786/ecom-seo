/**
 * Implementation status shown in the dashboard. Keep in sync with FEATURE_STATUS.md.
 * Only mark something implemented when it exists in this repository.
 */
export type BuildStatus = "implemented" | "in_progress" | "planned" | "blocked";

export type Feature = { id: string; name: string; area: string; status: BuildStatus; note: string };

export const FEATURES: Feature[] = [
  { id: "dashboard-shell", name: "Web dashboard foundation", area: "Platform", status: "implemented", note: "Next.js App Router, responsive dark UI." },
  { id: "supabase-clients", name: "Supabase SSR clients & session proxy", area: "Platform", status: "implemented", note: "Browser, server and proxy helpers with getClaims() validation." },
  { id: "supabase-diagnostics", name: "Supabase connection diagnostics", area: "Platform", status: "implemented", note: "Separate checks for config, endpoint, Auth, Data API and tables." },
  { id: "auth", name: "Email sign-in, sign-up and sign-out", area: "Platform", status: "implemented", note: "Server Actions; protected /account page." },
  { id: "google-trends", name: "Google Trends", area: "Google", status: "planned", note: "Official API access is limited; trending RSS planned as the public source." },
  { id: "google-ads", name: "Google Ads Keyword Planner", area: "Google", status: "planned", note: "Needs developer token and user OAuth." },
  { id: "search-console", name: "Google Search Console", area: "Google", status: "planned", note: "Needs OAuth access to a verified property." },
  { id: "youtube", name: "YouTube Data API", area: "Google", status: "planned", note: "Needs API key and quota." },
  { id: "amazon", name: "Amazon (Creators API / SP-API)", area: "Marketplaces", status: "planned", note: "Needs Associates or Seller Central approval." },
  { id: "flipkart", name: "Flipkart (Affiliate / Seller API)", area: "Marketplaces", status: "planned", note: "Needs Flipkart Affiliate or Seller credentials." },
  { id: "keyword-research", name: "Keyword research", area: "Research", status: "planned", note: "Depends on the provider adapters above." },
  { id: "ai-analysis", name: "AI trend analysis (evidence-grounded)", area: "Research", status: "planned", note: "Needs an AI provider key and stored evidence records." },
  { id: "extension", name: "Chrome MV3 extension", area: "Clients", status: "planned", note: "Popup, side panel and options page." },
  { id: "billing", name: "Plans, billing and entitlements", area: "Business", status: "planned", note: "Server-enforced; Stripe/Razorpay adapters." },
];

export const REPO_URL = "https://github.com/tarikk786786/ecom-seo";
