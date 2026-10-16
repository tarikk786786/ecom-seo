import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata"]);

/** Reject non-http(s), credentials, and private/link-local/metadata targets. DNS is re-checked by the fetcher. */
export function assertPublicHttpUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "URL is not valid." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs can be audited." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "URLs must not include credentials." };
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, error: "That host is not allowed for remote audits." };
  }
  if (host === "[::1]" || host === "::1") {
    return { ok: false, error: "Loopback addresses are not allowed." };
  }
  const ipVersion = isIP(host.replace(/^\[|\]$/g, ""));
  if (ipVersion && isPrivateOrSpecialIp(host.replace(/^\[|\]$/g, ""))) {
    return { ok: false, error: "Private or special-use IP addresses are not allowed." };
  }
  return { ok: true, url };
}

export function isPrivateOrSpecialIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
    if (normalized.startsWith("fe80")) return true;
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice(7);
      if (isIP(mapped) === 4) return isPrivateOrSpecialIp(mapped);
    }
    return false;
  }
  return true;
}
