import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "@/lib/env";

/**
 * Browser client for Client Components. `createBrowserClient` is a singleton in the browser,
 * so calling this repeatedly reuses one instance. Uses only the public publishable key.
 */
export function createClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
