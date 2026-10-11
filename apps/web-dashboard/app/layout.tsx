import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/nav";
import { SetupBanner } from "@/components/setup-banner";
import { getCurrentUser } from "@/lib/auth";
import { readSupabaseEnv } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ecom SEO — Trend Intelligence AI", template: "%s · Ecom SEO" },
  description: "Verified trend discovery, SEO keyword research and e-commerce product intelligence.",
};

export const viewport: Viewport = { themeColor: "#09090b" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const env = readSupabaseEnv();
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="lg:flex">
          <Nav userEmail={user?.email} />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            {!env.ok && <SetupBanner issues={env.issues} />}
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
