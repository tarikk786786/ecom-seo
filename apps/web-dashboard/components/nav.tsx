"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Keyword research" },
  { href: "/integrations", label: "Data sources" },
  { href: "/connect", label: "Connect accounts" },
  { href: "/account", label: "Account" },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 text-sm font-bold text-zinc-950">ES</span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-zinc-50">Ecom SEO</span>
        <span className="block text-[11px] text-zinc-500">Ecommerce keyword research</span>
      </span>
    </Link>
  );
}

export function Nav({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const links = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOpen(false)}
          aria-current={isActive(l.href) ? "page" : undefined}
          className={`rounded-md px-3 py-2 text-sm transition ${isActive(l.href) ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="space-y-2 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
      {userEmail ? (
        <p className="truncate">Signed in: {userEmail}</p>
      ) : (
        <Link href="/login" className="block text-sky-400 hover:text-sky-300">
          Sign in
        </Link>
      )}
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-zinc-800 bg-zinc-950 p-4 lg:flex">
        <div className="space-y-6">
          <Brand />
          {links}
        </div>
        {footer}
      </aside>

      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="space-y-4 border-b border-zinc-800 bg-zinc-950 p-4 lg:hidden">
          {links}
          {footer}
        </div>
      )}
    </>
  );
}
