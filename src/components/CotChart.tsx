"use client";

import { useState } from "react";
import type { CotEntry } from "@/lib/cot";

/**
 * Klasik COT grafigi: uc taraf da ayni panelde, son bir yil.
 *
 * Spekulator ve ticari taraf sifir cizgisinin iki yaninda durur ve
 * genelde birbirinin ayna goruntusudur; ucuncu cizgi kucuk yatirimci.
 * Uc netin toplami her zaman sifirdir — her uzunun karsisinda bir kisa
 * vardir. Ayrismanin nerede basladigi ve ucun ne kadar acildigi tek
 * bakista gorunur.
 *
 * Burada yalnizca CFTC'nin raporladigi pozisyonlar var; hesaplanmis
 * bir gosterge, ortalama ya da fiyat verisi yok.
 */

const W = 420;
const H = 120;
const PAD_T = 6;
const PAD_B = 6;
const PAD_R = 4;
const PAD_L = 4;

const kisa = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${Math.round(v / 1000)}B`;
  return String(v);
};

/**
 * COT haftalik yayinlanir, o yuzden "zaman dilimi" burada mum boyu
 * degil geriye bakis penceresidir: kac haftayi gosterdigimiz.
 */
const WINDOWS: { label: string; weeks: number }[] = [
  { label: "3 ay", weeks: 13 },
  { label: "6 ay", weeks: 26 },
  { label: "1 yıl", weeks: 52 },
  { label: "3 yıl", weeks: 156 },
];

export default function CotChart({ entry }: { entry: CotEntry }) {
  const [weeks, setWeeks] = useState(52);
  const cut = (a: number[] | undefined) => (a ?? []).slice(-weeks);
  const spec = cut(entry.history);
  const comm = cut(entry.commHistory);
  const small = cut(entry.smallHistory);
  if (spec.length < 4) return null;

  const all = [...spec, ...comm, ...small, 0];
  const max = Math.max(...all);
  const min = Math.min(...all);
  const span = max - min || 1;

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (i: number, n: number) => PAD_L + (i / Math.max(n - 1, 1)) * plotW;
  const y = (v: number) => PAD_T + ((max - v) / span) * plotH;
  const zeroY = y(0);

  const path = (data: number[]) =>
    data
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i, data.length).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");

  const specLast = spec[spec.length - 1];
  const specColor = specLast >= 0 ? "var(--sage)" : "var(--verm)";
  const specArea = `${path(spec)} L ${x(spec.length - 1, spec.length).toFixed(1)} ${zeroY.toFixed(1)} L ${x(0, spec.length).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  return (
    <figure className="m-0 mt-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[0.75rem] text-[var(--text-faint)]">
          Net pozisyon, son {spec.length} hafta
        </span>
        <span className="flex items-center gap-0.5">
          {WINDOWS.filter((w) => (entry.history?.length ?? 0) >= w.weeks * 0.6).map((w) => (
            <button
              key={w.weeks}
              type="button"
              onClick={() => setWeeks(w.weeks)}
              aria-pressed={weeks === w.weeks}
              className={[
                "rounded-sm px-1.5 py-0.5 text-[0.625rem] transition-colors",
                weeks === w.weeks
                  ? "bg-[var(--bg-raise)] text-[var(--text)]"
                  : "text-[var(--text-faint)] hover:text-[var(--text-dim)]",
              ].join(" ")}
            >
              {w.label}
            </button>
          ))}
        </span>
        <span className="flex items-center gap-3 text-[0.6875rem]">
          <span className="flex items-center gap-1.5" style={{ color: specColor }}>
            <span className="inline-block h-[2px] w-3.5" style={{ background: specColor }} />
            spekülatör
          </span>
          {comm.length > 0 && (
            <span className="flex items-center gap-1.5 text-[var(--amber)]">
              <span className="inline-block h-[2px] w-3.5 bg-[var(--amber)]" />
              ticari
            </span>
          )}
          {small.length > 0 && (
            <span className="flex items-center gap-1.5 text-[var(--text-dim)]">
              <span className="inline-block h-[2px] w-3.5 bg-[var(--text-dim)]" />
              küçük
            </span>
          )}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1.5 block h-auto w-full"
        role="img"
        aria-label={`${entry.symbol} COT net pozisyonu, son ${spec.length} hafta`}
      >
        <path d={specArea} fill={specColor} opacity={0.14} />

        <line
          x1={0}
          y1={zeroY}
          x2={W}
          y2={zeroY}
          stroke="var(--text-faint)"
          strokeWidth={0.6}
          strokeDasharray="3 3"
        />

        {small.length > 0 && (
          <path
            d={path(small)}
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth={0.9}
            opacity={0.7}
            strokeLinejoin="round"
          />
        )}

        {comm.length > 0 && (
          <path
            d={path(comm)}
            fill="none"
            stroke="var(--amber)"
            strokeWidth={1.1}
            opacity={0.85}
            strokeLinejoin="round"
          />
        )}

        <path
          d={path(spec)}
          fill="none"
          stroke={specColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <circle
          cx={x(spec.length - 1, spec.length)}
          cy={y(specLast)}
          r={2.6}
          fill={specColor}
        />

        <text x={PAD_L} y={PAD_T + 8} fill="var(--text-faint)" fontSize={8.5} fontFamily="var(--font-mono)">
          {kisa(max)}
        </text>
        <text x={PAD_L} y={H - 2} fill="var(--text-faint)" fontSize={8.5} fontFamily="var(--font-mono)">
          {kisa(min)}
        </text>
      </svg>
    </figure>
  );
}
