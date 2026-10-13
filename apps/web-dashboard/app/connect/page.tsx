import type { Metadata } from "next";
import { headers } from "next/headers";
import { PageHeader } from "@/components/card";
import { ConnectCard } from "@/components/connect/connect-card";
import { CONNECT_PLATFORMS } from "@/lib/connect/catalog";
import { isLocalRequest } from "@/lib/connect/env-file";

export const metadata: Metadata = { title: "Connect platforms" };
export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  const local = isLocalRequest(await headers());

  return (
    <>
      <PageHeader
        title="Connect your platform accounts"
        description="Every platform already works with free public data. Adding your own official API keys unlocks richer data such as prices, listing stats and view counts. Log in on the platform's site, create the keys, then paste them here. They're saved only in .env.local on this computer and are never shown again or sent anywhere else."
      />
      {!local && (
        <p className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Keys can only be pasted when you open the dashboard on the computer it runs on (http://localhost:3000). On a hosted copy, add them as environment variables in your hosting settings instead.
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        {CONNECT_PLATFORMS.map((p) => (
          <ConnectCard
            key={p.provider}
            provider={p.provider}
            name={p.name}
            gain={p.gain}
            cost={p.cost}
            loginUrl={p.loginUrl}
            loginLabel={p.loginLabel}
            steps={p.steps}
            enabled={local}
            fields={p.fields.map((f) => ({
              env: f.env,
              label: f.label,
              secret: f.secret,
              hint: f.hint,
              saved: Boolean(process.env[f.env]),
              // Non-secret identifiers (IDs, partner tag) are shown so the user can see what is saved.
              value: !f.secret && local ? process.env[f.env] : undefined,
            }))}
          />
        ))}
      </div>
    </>
  );
}
