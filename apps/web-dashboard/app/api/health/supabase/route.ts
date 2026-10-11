import { NextResponse } from "next/server";
import { readSupabaseEnv } from "@/lib/env";
import { diagnoseSupabase, type SessionCheck, type SupabaseDiagnostics } from "@/lib/supabase-diagnostics";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// Project-level diagnostics are identical for every visitor, so a short memo prevents this public
// route from amplifying traffic to Supabase. The per-user session check below is never cached.
const MEMO_MS = 15_000;
let memo: { at: number; value: SupabaseDiagnostics } | undefined;

export async function GET() {
  if (!memo || Date.now() - memo.at > MEMO_MS) {
    memo = { at: Date.now(), value: await diagnoseSupabase({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }) };
  }

  let session: SessionCheck = { state: "unavailable", detail: "Supabase is not configured." };
  if (readSupabaseEnv().ok) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getClaims();
      session = data?.claims
        ? { state: "signed_in", email: typeof data.claims.email === "string" ? data.claims.email : undefined }
        : { state: "signed_out", detail: error?.message };
    } catch (err) {
      session = { state: "unavailable", detail: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ ...memo.value, session }, { headers: { "cache-control": "private, no-store" } });
}
