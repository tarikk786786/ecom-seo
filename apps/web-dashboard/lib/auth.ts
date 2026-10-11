import "server-only";
import { connection } from "next/server";
import { readSupabaseEnv } from "./env";
import { createClient } from "@/utils/supabase/server";

export type CurrentUser = { id: string; email?: string };

/**
 * Returns the verified user for this request, or null. Uses getClaims(), which validates the
 * JWT signature, never getSession(), which trusts the cookie as-is.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Identity is per request: opt out of prerendering even when Supabase is unconfigured.
  await connection();
  if (!readSupabaseEnv().ok) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) return null;
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
  } catch {
    return null;
  }
}
