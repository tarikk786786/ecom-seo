"use client";

import { useId, useState } from "react";
import { formatNumber } from "@/lib/keywords/view";
import type { DeviceDistribution, History } from "@/lib/keywords/types";

const W = 640;
const H = 200;
const PAD = { l: 48, r: 12, t: 12, b: 26 };

export function HistoryChart({ history, providerName }: { history: History; providerName: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const gradId = useId();
  const pts = history.points;
  if (!pts.length) return null;

  const max = Math.max(...pts.map((p) => p.value), 1);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const step = pts.length > 1 ? iw / (pts.length - 1) : 0;
  const x = (i: number) => PAD.l + i * step;
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${PAD.t + ih} L${PAD.l},${PAD.t + ih} Z`;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.ceil(pts.length / 6);
  const h = hover !== null ? pts[hover] : undefined;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-zinc-400">
          {history.label} · {history.granularity}
        </p>
        <button type="button" onClick={() => setAsTable((v) => !v)} className="text-xs text-sky-400 hover:text-sky-300">
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-56 overflow-auto rounded border border-zinc-800">
          <table className="w-full text-xs">
            <caption className="sr-only">{history.label}</caption>
            <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Date</th>
                <th className="px-2 py-1 text-right font-medium">{history.unit}</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.date} className="border-t border-zinc-800/60">
                  <td className="px-2 py-1 text-zinc-400">{p.date}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-zinc-200">{p.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${history.label}, ${pts.length} ${history.granularity} points, max ${max.toLocaleString()} ${history.unit}`} onMouseLeave={() => setHover(null)}>
            <defs>
              <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#38bdf8" stopOpacity="0.35" />
                <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#27272a" />
                <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" className="fill-zinc-500 text-[10px]">
                  {formatNumber(t)}
                </text>
              </g>
            ))}
            {pts.map((p, i) =>
              i % labelEvery === 0 ? (
                <text key={p.date} x={x(i)} y={H - 8} textAnchor="middle" className="fill-zinc-500 text-[10px]">
                  {history.granularity === "monthly" ? p.date.slice(0, 7) : p.date.slice(5)}
                </text>
              ) : null,
            )}
            <path d={area} fill={`url(#${gradId})`} />
            <path d={line} fill="none" stroke="#38bdf8" strokeWidth="1.8" />
            {pts.map((p, i) => (
              <rect key={p.date} x={x(i) - Math.max(step, 4) / 2} y={PAD.t} width={Math.max(step, 4)} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
            ))}
            {h && hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="#52525b" />
                <circle cx={x(hover)} cy={y(h.value)} r="3.5" fill="#38bdf8" />
              </g>
            )}
          </svg>
          {h && (
            <div className="pointer-events-none absolute right-2 top-1 rounded border border-zinc-700 bg-zinc-950/95 px-2 py-1 text-[11px]">
              <p className="text-zinc-400">{h.date}</p>
              <p className="tabular-nums text-zinc-100">
                {h.value.toLocaleString()} {history.unit}
              </p>
              <p className="text-zinc-500">{providerName}</p>
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-[11px] text-zinc-500">
        {history.definition}
        {history.missing?.length ? ` ${history.missing.length} period(s) had no data and are shown as gaps, not zeros.` : ""}{" "}
        {history.sourceUrl && (
          <a href={history.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">
            Source ↗
          </a>
        )}
      </p>
    </div>
  );
}

const DEVICE_COLORS = ["#38bdf8", "#34d399", "#a78bfa", "#fbbf24"];

export function DeviceChart({ data }: { data: DeviceDistribution }) {
  const C = 2 * Math.PI * 36;
  const offsets = data.items.map((_, i) => data.items.slice(0, i).reduce((s, it) => s + (it.share / 100) * C, 0));
  return (
    <div>
      <p className="mb-2 text-xs text-zinc-400">{data.label}</p>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" role="img" aria-label={data.items.map((i) => `${i.device} ${i.share}%`).join(", ")}>
          <circle cx="50" cy="50" r="36" fill="none" stroke="#27272a" strokeWidth="14" />
          {data.items.map((it, i) => {
            const len = (it.share / 100) * C;
            return <circle key={it.device} cx="50" cy="50" r="36" fill="none" stroke={DEVICE_COLORS[i % 4]} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offsets[i]!} />;
          })}
        </svg>
        <ul className="space-y-1 text-xs">
          {data.items.map((it, i) => (
            <li key={it.device} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ background: DEVICE_COLORS[i % 4] }} />
              <span className="w-20 text-zinc-300">{it.device}</span>
              <span className="tabular-nums text-zinc-100">{it.share}%</span>
              <span className="tabular-nums text-zinc-500">({it.value.toLocaleString()})</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        {data.definition} Period: {data.period}.{" "}
        {data.sourceUrl && (
          <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">
            Source ↗
          </a>
        )}
      </p>
    </div>
  );
}

export function Sparkline({ history }: { history?: History }) {
  const pts = history?.points ?? [];
  if (pts.length < 2) return <span className="text-zinc-600" title="No history from this source">—</span>;
  const max = Math.max(...pts.map((p) => p.value), 1);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * 80).toFixed(1)},${(22 - (p.value / max) * 20).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20" role="img" aria-label={`${history!.label}: ${pts.length} points`}>
      <path d={d} fill="none" stroke="#38bdf8" strokeWidth="1.3" />
    </svg>
  );
}
