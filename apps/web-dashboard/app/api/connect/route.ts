import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { CONNECT_PLATFORMS } from "@/lib/connect/catalog";
import { isLocalRequest, upsertEnv, validateEnvValue } from "@/lib/connect/env-file";
import { ProviderHttpError, redactSecrets } from "@/lib/keywords/http";
import { invalidateProviderStatuses } from "@/lib/keywords/provider-status";
import { PROVIDERS } from "@/lib/keywords/registry";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
// Same file next.config.ts loads: the repository root .env.local.
const ENV_FILE = path.resolve(process.cwd(), "../..", ".env.local");

const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

/** Saves official API keys for one platform to .env.local on this computer, then runs a live check. */
export async function POST(request: NextRequest) {
  if (!isLocalRequest(request.headers)) return fail("Keys can only be added from the dashboard running on this computer (http://localhost).", 403);

  let body: { platform?: unknown; values?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Request body must be JSON.", 400);
  }
  const platform = CONNECT_PLATFORMS.find((p) => p.provider === body.platform);
  if (!platform) return fail("Unknown platform.", 400);
  const values = body.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : {};
  const remove = values.__remove === true;

  const updates: Record<string, string> = {};
  for (const f of platform.fields) {
    const raw = values[f.env];
    const v = remove ? "" : typeof raw === "string" ? raw.trim() : "";
    // A blank secret on an already-connected platform means "keep the saved one".
    if (!remove && !v) {
      if (process.env[f.env]) continue;
      return fail(`${f.label} is required.`, 400);
    }
    const bad = v ? validateEnvValue(v) : undefined;
    if (bad) return fail(`${f.label}: ${bad}`, 400);
    if (v && f.pattern && !f.pattern.test(v)) return fail(`${f.label} doesn't look right.${f.hint ? ` ${f.hint}` : ""} Check you copied the whole value.`, 400);
    updates[f.env] = v;
  }

  let current = "";
  try {
    current = await readFile(ENV_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") return fail("Couldn't read .env.local.", 500);
  }
  let next: string;
  try {
    next = upsertEnv(current, updates);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Invalid key.", 400);
  }
  try {
    await writeFile(ENV_FILE, next, { encoding: "utf8", mode: 0o600 });
  } catch {
    return fail("Couldn't write .env.local. Is the file read-only?", 500);
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v) process.env[k] = v;
    else delete process.env[k];
  }
  invalidateProviderStatuses();

  if (remove) return NextResponse.json({ ok: true, removed: true, message: `${platform.name} keys removed. The free public source is used again.` }, { headers: noStore });

  const provider = PROVIDERS.find((p) => p.id === platform.provider);
  const started = Date.now();
  try {
    await provider?.liveCheck?.({ env: process.env, now: new Date() });
    return NextResponse.json({ ok: true, live: true, latencyMs: Date.now() - started, message: `Saved. ${platform.name} answered a live test in ${Date.now() - started} ms.` }, { headers: noStore });
  } catch (err) {
    const detail = redactSecrets(err instanceof Error ? err.message : String(err), process.env);
    const auth = err instanceof ProviderHttpError && err.category === "auth";
    return NextResponse.json(
      { ok: true, live: false, message: auth ? `Saved, but ${platform.name} rejected these keys: ${detail}. Double-check them, or wait if the app is still being reviewed.` : `Saved, but the live test failed: ${detail}` },
      { headers: noStore },
    );
  }
}
