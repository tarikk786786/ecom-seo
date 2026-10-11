import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/card";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth-validation";
import { readSupabaseEnv } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(next);
  const configured = readSupabaseEnv().ok;

  return (
    <div className="mx-auto max-w-sm pt-4 sm:pt-12">
      <Card title="Sign in to Ecom SEO">
        {params.error && (
          <p role="alert" className="mb-4 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {params.error === "confirm_failed" ? "That confirmation link is invalid or has expired. Request a new one by signing up again." : "Sign-in failed."}
          </p>
        )}
        {!configured && <p className="mb-4 text-sm text-orange-300">Sign-in is disabled until Supabase is configured.</p>}
        <LoginForm next={next} disabled={!configured} />
        <p className="mt-4 text-[11px] text-zinc-500">Authentication is handled by Supabase Auth. Passwords are never stored by this application.</p>
      </Card>
    </div>
  );
}
