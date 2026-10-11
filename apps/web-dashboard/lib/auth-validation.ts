const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CredentialsResult = { ok: true; email: string; password: string } | { ok: false; error: string; email?: string };

export function validateCredentials(form: FormData, opts: { minPasswordLength?: number } = {}): CredentialsResult {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: "Enter a valid email address.", email };
  const min = opts.minPasswordLength ?? 1;
  if (password.length < min) return { ok: false, error: min > 1 ? `Password must be at least ${min} characters.` : "Enter your password.", email };
  if (password.length > 72) return { ok: false, error: "Password must be at most 72 characters.", email };
  return { ok: true, email, password };
}

/** Only same-site relative paths are allowed as post-login destinations (prevents open redirects). */
export function safeNextPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
