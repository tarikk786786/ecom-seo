#!/usr/bin/env node
// Fails if tracked files (or a built .next bundle, when present) contain privileged credentials.
// Publishable keys (sb_publishable_) are intentionally public and are not flagged.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PATTERNS = [
  { name: "Supabase secret key", re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: "JWT with service_role", re: /eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/, check: (m) => decodeRole(m[1]) === "service_role" },
  { name: "Postgres URL with password", re: /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s]{6,}@/ },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Stripe live secret", re: /sk_live_[A-Za-z0-9]{10,}/ },
];

function decodeRole(part) {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")).role;
  } catch {
    return undefined;
  }
}

const root = path.resolve(import.meta.dirname, "..");
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !f.endsWith("scan-secrets.mjs") && !f.endsWith("package-lock.json"));

const nextDir = path.join(root, "apps/web-dashboard/.next/static");
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(path.join(dir, n)).isDirectory() ? walk(path.join(dir, n)) : [path.join(dir, n)]));
const bundle = existsSync(nextDir) ? walk(nextDir).filter((f) => f.endsWith(".js")) : [];

const findings = [];
for (const file of [...files.map((f) => path.join(root, f)), ...bundle]) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const p of PATTERNS) {
    const m = text.match(p.re);
    if (m && (!p.check || p.check(m))) findings.push(`${path.relative(root, file)}: ${p.name}`);
  }
}

const envTracked = files.filter((f) => /(^|\/)\.env(\..+)?$/.test(f) && !f.endsWith(".env.example"));
for (const f of envTracked) findings.push(`${f}: environment file is not git-ignored`);

if (findings.length) {
  console.error(`Secret scan FAILED:\n  ${findings.join("\n  ")}`);
  process.exit(1);
}
console.log(`Secret scan passed: ${files.length} repository files and ${bundle.length} client bundle files checked.`);
