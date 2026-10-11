"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readSupabaseEnv } from "@/lib/env";
import { safeNextPath, validateCredentials } from "@/lib/auth-validation";
import { createClient } from "@/utils/supabase/server";

export type AuthFormState = { error?: string; message?: string; email?: string };

async function siteOrigin() {
  // Prefer the configured origin; Supabase also rejects redirect URLs outside its allow-list.
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!readSupabaseEnv().ok) return { error: "Supabase is not configured on this server." };
  const input = validateCredentials(formData);
  if (!input.ok) return { error: input.error, email: input.email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) return { error: error.message, email: input.email };
  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!readSupabaseEnv().ok) return { error: "Supabase is not configured on this server." };
  const input = validateCredentials(formData, { minPasswordLength: 8 });
  if (!input.ok) return { error: input.error, email: input.email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/account` },
  });
  if (error) return { error: error.message, email: input.email };
  if (data.session) redirect("/account");
  return { message: "Check your email to confirm your account, then sign in.", email: input.email };
}

export async function signOut() {
  if (readSupabaseEnv().ok) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
