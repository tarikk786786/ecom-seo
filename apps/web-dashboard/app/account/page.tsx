import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/card";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "../login/actions";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  // Server-side check on every render; the proxy only refreshes sessions and is not an authorization layer.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  return (
    <>
      <PageHeader title="Account" description="Your profile and sign-in details." />
      <Card title="Profile">
        <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-zinc-500">Email</dt>
          <dd className="break-all text-zinc-100">{user.email ?? "—"}</dd>
          <dt className="text-zinc-500">User ID</dt>
          <dd className="break-all font-mono text-xs text-zinc-300">{user.id}</dd>
        </dl>
        <form action={signOut} className="mt-5">
          <button type="submit" className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-rose-500 hover:text-rose-200">
            Sign out
          </button>
        </form>
      </Card>
    </>
  );
}
