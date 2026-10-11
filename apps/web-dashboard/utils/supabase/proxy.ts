import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session for the incoming request.
 * Returns the response that carries any refreshed auth cookies and the no-cache headers
 * supplied by @supabase/ssr. Callers that need a different response must copy both
 * (see `copySessionState`).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const config = readSupabaseEnv();
  // Without configuration there is no session to refresh; pages render a setup message instead.
  if (!config.ok) return supabaseResponse;

  const supabase = createServerClient(config.env.url, config.env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it validates the JWT
  // (signature checked locally or by the Auth server) and refreshes an expired session.
  try {
    await supabase.auth.getClaims();
  } catch {
    // Network failure reaching Supabase must not take the whole site down; pages report it.
  }

  return supabaseResponse;
}

/** Copies refreshed cookies and cache headers onto a different response (e.g. a redirect). */
export function copySessionState(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  }
  return to;
}
