export type SupabaseEnv = { url: string; publishableKey: string };

export type EnvIssue = {
  variable: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
  problem: "missing" | "placeholder" | "invalid" | "privileged_key";
  message: string;
};

export type EnvCheck = { ok: true; env: SupabaseEnv; keyKind: "publishable" | "legacy_anon" } | { ok: false; issues: EnvIssue[]; url?: string };

export class SupabaseConfigError extends Error {
  constructor(readonly issues: EnvIssue[]) {
    super(`Supabase is not configured: ${issues.map((i) => `${i.variable} ${i.problem}`).join(", ")}. Copy .env.example to .env.local and set the values.`);
    this.name = "SupabaseConfigError";
  }
}

const PLACEHOLDER = /^(replace_with|your[-_]|<|changeme|xxx)/i;

function decodeJwtRole(token: string): string | undefined {
  const part = token.split(".")[1];
  if (!part) return undefined;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: unknown };
    return typeof json.role === "string" ? json.role : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validates the public Supabase configuration. Pure function so it can be unit tested and
 * used identically on the server and in the browser.
 */
export function checkSupabaseEnv(raw: { url?: string; key?: string }): EnvCheck {
  const issues: EnvIssue[] = [];
  const url = raw.url?.trim();
  const key = raw.key?.trim();

  if (!url) {
    issues.push({ variable: "NEXT_PUBLIC_SUPABASE_URL", problem: "missing", message: "Set NEXT_PUBLIC_SUPABASE_URL to your project URL (https://<project-ref>.supabase.co)." });
  } else if (PLACEHOLDER.test(url)) {
    issues.push({ variable: "NEXT_PUBLIC_SUPABASE_URL", problem: "placeholder", message: "NEXT_PUBLIC_SUPABASE_URL still contains the template placeholder." });
  } else {
    let parsed: URL | undefined;
    try {
      parsed = new URL(url);
    } catch {
      parsed = undefined;
    }
    const localDev = parsed && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    if (!parsed || (parsed.protocol !== "https:" && !(localDev && parsed.protocol === "http:")) || parsed.pathname.length > 1 || parsed.search) {
      issues.push({ variable: "NEXT_PUBLIC_SUPABASE_URL", problem: "invalid", message: "NEXT_PUBLIC_SUPABASE_URL must be an https origin with no path, e.g. https://<project-ref>.supabase.co." });
    }
  }

  let keyKind: "publishable" | "legacy_anon" | undefined;
  if (!key) {
    issues.push({ variable: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", problem: "missing", message: "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the project's publishable key (sb_publishable_…)." });
  } else if (PLACEHOLDER.test(key)) {
    issues.push({ variable: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", problem: "placeholder", message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY still contains the template placeholder." });
  } else if (key.startsWith("sb_secret_") || decodeJwtRole(key) === "service_role") {
    issues.push({
      variable: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      problem: "privileged_key",
      message: "This is a secret/service-role key. It bypasses Row Level Security and must never be exposed to browsers. Rotate it in the Supabase dashboard and use the publishable key instead.",
    });
  } else if (key.startsWith("sb_publishable_")) {
    keyKind = "publishable";
  } else if (decodeJwtRole(key) === "anon") {
    keyKind = "legacy_anon";
  } else {
    issues.push({ variable: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", problem: "invalid", message: "Key is not a recognised Supabase publishable key (sb_publishable_…) or legacy anon key." });
  }

  if (issues.length || !keyKind) return { ok: false, issues, url: url && !issues.some((i) => i.variable === "NEXT_PUBLIC_SUPABASE_URL") ? url.replace(/\/$/, "") : undefined };
  return { ok: true, env: { url: url!.replace(/\/$/, ""), publishableKey: key! }, keyKind };
}

/** Reads the public env. `process.env.NEXT_PUBLIC_*` must be referenced literally so Next.js inlines it for the browser. */
export function readSupabaseEnv(): EnvCheck {
  return checkSupabaseEnv({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
}

export function requireSupabaseEnv(): SupabaseEnv {
  const check = readSupabaseEnv();
  if (!check.ok) throw new SupabaseConfigError(check.issues);
  return check.env;
}

/** Project ref from a hosted Supabase URL, used only for display. */
export function projectRef(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".supabase.co") ? host.split(".")[0] : undefined;
  } catch {
    return undefined;
  }
}
