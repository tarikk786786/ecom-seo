import type { EnvIssue } from "@/lib/env";

export function SetupBanner({ issues }: { issues: EnvIssue[] }) {
  return (
    <div role="alert" className="mb-6 rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 text-sm">
      <p className="font-semibold text-orange-200">Supabase setup required</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-orange-100/90">
        {issues.map((i) => (
          <li key={i.variable + i.problem}>{i.message}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-orange-200/80">
        Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code> in the repository root, set the values, then restart{" "}
        <code className="font-mono">npm run dev</code>. Sign-in and database checks stay disabled until then.
      </p>
    </div>
  );
}
