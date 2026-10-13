/** Pure helpers for editing a dotenv file in place without touching unrelated lines. */

const NAME = /^[A-Z][A-Z0-9_]*$/;

export function validateEnvValue(value: string): string | undefined {
  if (/[\r\n\0]/.test(value)) return "Keys can't contain line breaks.";
  if (value.length > 512) return "That value is too long to be an API key.";
  return undefined;
}

// dotenv has no escape for quotes, so pick a quote character the value doesn't contain.
function quote(value: string): string {
  if (/^[\w.\-/:@+=]*$/.test(value)) return value;
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"') && !value.includes("\\")) return `"${value}"`;
  throw new Error("Keys can't contain both kinds of quote marks.");
}

/**
 * Sets (or with an empty value, removes) each variable. Existing assignments are replaced where they are,
 * new ones are appended under a single header. Comments and other variables are left untouched.
 */
export function upsertEnv(content: string, updates: Record<string, string>): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.length ? content.split(/\r?\n/) : [];
  if (lines[lines.length - 1] === "") lines.pop();
  const pending = new Map(Object.entries(updates));
  for (const name of pending.keys()) if (!NAME.test(name)) throw new Error(`Invalid variable name: ${name}`);

  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
    if (!m || !pending.has(m[1]!)) {
      out.push(line);
      continue;
    }
    const value = pending.get(m[1]!)!;
    pending.delete(m[1]!);
    if (value) out.push(`${m[1]}=${quote(value)}`);
  }
  const added = [...pending].filter(([, v]) => v);
  if (added.length) {
    while (out.length && out[out.length - 1] === "") out.pop();
    if (out.length) out.push("");
    out.push("# Added from the Connect page");
    for (const [k, v] of added) out.push(`${k}=${quote(v)}`);
  }
  return out.join(eol) + (out.length ? eol : "");
}

/** True only for requests that clearly originate from this computer (no proxy, loopback host, same origin). */
export function isLocalRequest(headers: Headers): boolean {
  const host = (headers.get("host") ?? "").toLowerCase();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (!local) return false;
  // Next.js itself sets x-forwarded-* from the socket, so they're allowed only when every hop is loopback.
  const loopback = (ip: string) => /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+|localhost)$/i.test(ip.trim().replace(/^\[|\]$/g, ""));
  const fwd = headers.get("x-forwarded-for");
  if (fwd && !fwd.split(",").every(loopback)) return false;
  const realIp = headers.get("x-real-ip");
  if (realIp && !loopback(realIp)) return false;
  const fwdHost = headers.get("x-forwarded-host");
  if (fwdHost && fwdHost.toLowerCase() !== host) return false;
  if (headers.get("forwarded")) return false;
  const origin = headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host.toLowerCase() !== host) return false;
    } catch {
      return false;
    }
  }
  // "none" = typed into the address bar; anything cross-site is refused.
  const site = headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}
