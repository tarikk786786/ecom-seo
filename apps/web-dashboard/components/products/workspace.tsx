"use client";

import { useState, useTransition } from "react";
import { Card, PageHeader } from "@/components/card";
import { MARKETPLACES, type ProductListResult, type ProductRecord } from "@/lib/products/types";

type ImportSummary = {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  duplicateGroups: { key: string; productIds: string[] }[];
};

const emptyForm = {
  title: "",
  sku: "",
  marketplace: "other",
  country: "IN",
  url: "",
  brand: "",
  category: "",
  primaryKeyword: "",
  secondaryKeywords: "",
  price: "",
  currency: "INR",
};

export function ProductsWorkspace({ initial }: { initial: ProductListResult }) {
  const [data, setData] = useState<ProductListResult>(initial);
  const [q, setQ] = useState("");
  const [marketplace, setMarketplace] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();

  async function fetchList(next: { q?: string; marketplace?: string; page?: number }) {
    const params = new URLSearchParams({ page: String(next.page ?? page), pageSize: "25" });
    const query = next.q ?? q;
    const market = next.marketplace ?? marketplace;
    if (query.trim()) params.set("q", query.trim());
    if (market) params.set("marketplace", market);
    const res = await fetch(`/api/products?${params}`, { cache: "no-store" });
    const json = (await res.json()) as ProductListResult & { error?: string };
    if (!res.ok) throw new Error(json.error ?? `Failed to load products (${res.status})`);
    return json;
  }

  function refresh(next: { q?: string; marketplace?: string; page?: number } = {}) {
    startTransition(async () => {
      setError(null);
      try {
        const json = await fetchList(next);
        setData(json);
        if (next.page !== undefined) setPage(next.page);
        if (next.q !== undefined) setQ(next.q);
        if (next.marketplace !== undefined) setMarketplace(next.marketplace);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load products");
      }
    });
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body = {
        title: form.title,
        sku: form.sku || null,
        marketplace: form.marketplace,
        country: form.country || null,
        url: form.url || null,
        brand: form.brand || null,
        category: form.category || null,
        primaryKeyword: form.primaryKeyword || null,
        secondaryKeywords: form.secondaryKeywords,
        price: form.price === "" ? null : form.price,
        currency: form.currency || null,
      };
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      setForm(emptyForm);
      refresh({ page: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this product from the local store?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function onImport(file: File | null) {
    if (!file) return;
    setImportSummary(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/products/import", { method: "POST", body: formData });
      const json = (await res.json()) as ImportSummary & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setImportSummary(json);
      refresh({ page: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage your product portfolio for ranking intelligence. Import CSV catalogs, map keywords, and export with provenance. Ranking positions and search volume are not invented—those arrive only from authorized Phase 2+ connectors."
      />

      <p className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90" role="status">
        Persistence: <strong className="font-medium text-amber-100">{data.persistence}</strong> — {data.persistenceNote}
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      )}

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card
          title="Portfolio"
          action={
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/products/export?format=csv${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${marketplace ? `&marketplace=${marketplace}` : ""}`}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Export CSV
              </a>
              <a
                href={`/api/products/export?format=json${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${marketplace ? `&marketplace=${marketplace}` : ""}`}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Export JSON
              </a>
            </div>
          }
        >
          <form
            className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              refresh({ page: 1, q, marketplace });
            }}
          >
            <label className="flex-1 text-xs text-zinc-400">
              Search
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="Title, SKU, brand, keyword…"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Marketplace
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:w-40"
              >
                <option value="">All</option>
                {MARKETPLACES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={pending} className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">
              Apply
            </button>
          </form>

          {pending && <p className="mb-2 text-sm text-zinc-400">Updating…</p>}
          {data.total === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-700 px-4 py-8 text-center text-sm text-zinc-400">
              <p>No products yet.</p>
              <p className="mt-1">
                Import a CSV with a <code className="text-zinc-300">title</code> column, or add one manually.
              </p>
            </div>
          )}
          {data.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">Product</th>
                    <th className="pb-2 pr-3 font-medium">Marketplace</th>
                    <th className="pb-2 pr-3 font-medium">Keywords</th>
                    <th className="pb-2 pr-3 font-medium">Price</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <ProductRow key={p.id} product={p} onDelete={() => void onDelete(p.id)} disabled={pending} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.total > data.pageSize && (
            <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
              <span>
                {data.total} products · page {data.page} / {totalPages}
              </span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1 || pending} onClick={() => refresh({ page: Math.max(1, page - 1) })} className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40">
                  Previous
                </button>
                <button type="button" disabled={page >= totalPages || pending} onClick={() => refresh({ page: page + 1 })} className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Import CSV">
            <p className="mb-3 text-xs text-zinc-400">
              Required: <code className="text-zinc-300">title</code>. Optional: sku, url, brand, category, marketplace, country, language, currency, price, availability, primary_keyword, secondary_keywords, tags. Sample: <code className="text-zinc-300">docs/sample-products.csv</code>.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={pending}
              onChange={(e) => void onImport(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-sky-500"
            />
            {importSummary && (
              <div className="mt-3 space-y-1 text-xs text-zinc-300">
                <p>
                  Imported {importSummary.imported}, updated {importSummary.updated}, row errors {importSummary.errors.length}.
                </p>
                {importSummary.errors.slice(0, 5).map((err) => (
                  <p key={`${err.row}-${err.message}`} className="text-rose-300">
                    Row {err.row}: {err.message}
                  </p>
                ))}
                {importSummary.duplicateGroups.length > 0 && (
                  <p className="text-amber-200">{importSummary.duplicateGroups.length} duplicate group(s) detected after import (SKU/URL).</p>
                )}
              </div>
            )}
          </Card>

          <Card title="Add product">
            <form onSubmit={(e) => void onCreate(e)} className="space-y-3">
              <Field label="Title *" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU" value={form.sku} onChange={(v) => setForm((f) => ({ ...f, sku: v }))} />
                <label className="block text-xs text-zinc-400">
                  Marketplace
                  <select value={form.marketplace} onChange={(e) => setForm((f) => ({ ...f, marketplace: e.target.value }))} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
                    {MARKETPLACES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} />
                <Field label="Brand" value={form.brand} onChange={(v) => setForm((f) => ({ ...f, brand: v }))} />
              </div>
              <Field label="URL" value={form.url} onChange={(v) => setForm((f) => ({ ...f, url: v }))} />
              <Field label="Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
              <Field label="Primary keyword" value={form.primaryKeyword} onChange={(v) => setForm((f) => ({ ...f, primaryKeyword: v }))} />
              <Field label="Secondary keywords (comma-separated)" value={form.secondaryKeywords} onChange={(v) => setForm((f) => ({ ...f, secondaryKeywords: v }))} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (leave empty if unknown)" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} />
                <Field label="Currency" value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v }))} />
              </div>
              <button type="submit" disabled={pending || !form.title.trim()} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40">
                Save product
              </button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block text-xs text-zinc-400">
      {label}
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
      />
    </label>
  );
}

function ProductRow({ product: p, onDelete, disabled }: { product: ProductRecord; onDelete: () => void; disabled: boolean }) {
  return (
    <tr className="border-t border-zinc-800 align-top">
      <td className="py-3 pr-3">
        <p className="font-medium text-zinc-100">{p.title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {p.sku ? `SKU ${p.sku}` : "No SKU"} · {p.source} · updated {new Date(p.updatedAt).toLocaleString()}
        </p>
        {p.url && (
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block text-xs text-sky-400 hover:text-sky-300">
            Listing URL ↗
          </a>
        )}
      </td>
      <td className="py-3 pr-3 text-zinc-300">
        {p.marketplace}
        {p.country ? ` · ${p.country}` : ""}
      </td>
      <td className="py-3 pr-3 text-xs text-zinc-400">
        {p.primaryKeyword ? <span className="text-zinc-200">{p.primaryKeyword}</span> : <span className="italic">Not mapped</span>}
        {p.secondaryKeywords.length > 0 && <p className="mt-1">{p.secondaryKeywords.slice(0, 4).join(", ")}</p>}
      </td>
      <td className="py-3 pr-3 text-zinc-300">
        {p.price == null ? <span className="text-zinc-500">Not provided</span> : `${p.currency ? `${p.currency} ` : ""}${p.price}`}
      </td>
      <td className="py-3">
        <button type="button" disabled={disabled} onClick={onDelete} className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40">
          Delete
        </button>
      </td>
    </tr>
  );
}
