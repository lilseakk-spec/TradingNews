"use client";

/**
 * Grafikler elde cizilmis SVG. Harici kutuphane yok: dosya kucuk kalsin,
 * renkler tema degiskenlerinden gelsin, ciktida fazlalik olmasin.
 */

import { money, round, type EquityPoint } from "@/lib/defter/calc";
import { shortDate } from "@/lib/weeks";

const W = 840;
const H = 240;
const PAD = { top: 16, right: 12, bottom: 24, left: 56 };

export function EquityChart({
  points,
  currency = "USD",
}: {
  points: EquityPoint[];
  currency?: string;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="t-label">eğri için en az iki kayıt gerekir</p>
      </div>
    );
  }

  const values = points.map((p) => p.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, Math.abs(max) * 0.02);
  const low = min - span * 0.12;
  const high = max + span * 0.12;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - ((v - low) / (high - low)) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${round(x(i), 1)},${round(y(p.equity), 1)}`).join(" ");
  const area = `${line} L${round(x(points.length - 1), 1)},${PAD.top + innerH} L${round(
    x(0),
    1,
  )},${PAD.top + innerH} Z`;

  const start = points[0].equity;
  const end = points[points.length - 1].equity;
  const up = end >= start;
  const stroke = up ? "var(--sage)" : "var(--verm)";

  const ticks = [low, low + (high - low) / 2, high];
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Özkaynak eğrisi">
      <defs>
        <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((value) => (
        <g key={value}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(value)}
            y2={y(value)}
            stroke="var(--hairline)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={PAD.left - 8}
            y={y(value)}
            textAnchor="end"
            dominantBaseline="central"
            fontSize="10"
            className="t-num"
            fill="var(--text-faint)"
          >
            {money(value, currency)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#equity-fill)" />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {points.map((point, i) =>
        i % labelEvery === 0 || i === points.length - 1 ? (
          <text
            key={point.date}
            x={x(i)}
            y={H - 6}
            textAnchor={i === points.length - 1 ? "end" : i === 0 ? "start" : "middle"}
            fontSize="9.5"
            className="t-num"
            fill="var(--text-faint)"
          >
            {shortDate(point.date)}
          </text>
        ) : null,
      )}

      <circle cx={x(points.length - 1)} cy={y(end)} r="3" fill={stroke} />
    </svg>
  );
}

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  hint?: string;
}

/** Donem cubuklari: ay ya da hafta bazinda kar/zarar. */
export function Bars({
  data,
  currency = "USD",
  unit = "money",
}: {
  data: BarDatum[];
  currency?: string;
  unit?: "money" | "r";
}) {
  if (data.length === 0) {
    return <p className="t-label py-6 text-center">veri yok</p>;
  }
  const peak = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((row) => {
        const ratio = Math.abs(row.value) / peak;
        const positive = row.value >= 0;
        return (
          <div key={row.id} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
            <span className="t-label truncate">{row.label}</span>
            <div className="relative h-4">
              <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--hairline)]" />
              <div
                className="absolute top-1/2 h-2.5 -translate-y-1/2"
                style={{
                  left: positive ? "50%" : `${50 - ratio * 50}%`,
                  width: `${ratio * 50}%`,
                  background: positive ? "var(--sage)" : "var(--verm)",
                  opacity: 0.85,
                }}
              />
            </div>
            <span
              className="t-num w-[5.5rem] text-right text-[0.8125rem]"
              style={{ color: positive ? "var(--sage)" : "var(--verm)" }}
            >
              {unit === "money"
                ? money(row.value, currency)
                : `${row.value > 0 ? "+" : ""}${row.value}R`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Yatay maliyet cubuklari — hata etiketleri icin. */
export function CostBars({
  data,
  currency = "USD",
}: {
  data: { id: string; label: string; count: number; rCost: number; moneyCost: number }[];
  currency?: string;
}) {
  if (data.length === 0) {
    return <p className="t-label py-6 text-center">etiketlenmiş hata yok — ya kusursuzsun ya kayıt tutmuyorsun</p>;
  }
  const peak = Math.max(...data.map((d) => d.rCost), 0.5);

  return (
    <div className="flex flex-col gap-2">
      {data.map((row) => (
        <div key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[0.8125rem] text-[var(--text)]">{row.label}</span>
              <span className="t-num shrink-0 text-[0.6875rem] text-[var(--text-faint)]">
                {row.count}×
              </span>
            </div>
            <div className="meter mt-1.5">
              <span
                style={{
                  width: `${(row.rCost / peak) * 100}%`,
                  background: "var(--verm)",
                }}
              />
            </div>
          </div>
          <div className="w-[5.5rem] text-right">
            <div className="t-num text-[0.8125rem] text-[var(--verm)]">−{round(row.rCost, 1)}R</div>
            <div className="t-num text-[0.625rem] text-[var(--text-faint)]">
              {money(row.moneyCost, currency)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** R dagilimi histogrami: -3R'den +4R'ye kovalar. */
export function RHistogram({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <p className="t-label py-6 text-center">veri yok</p>;
  }
  const buckets = [
    { id: "a", label: "≤ −2R", test: (v: number) => v <= -2 },
    { id: "b", label: "−2 / −1", test: (v: number) => v > -2 && v <= -1 },
    { id: "c", label: "−1 / 0", test: (v: number) => v > -1 && v < -0.05 },
    { id: "d", label: "BE", test: (v: number) => v >= -0.05 && v <= 0.05 },
    { id: "e", label: "0 / 1R", test: (v: number) => v > 0.05 && v <= 1 },
    { id: "f", label: "1 / 2R", test: (v: number) => v > 1 && v <= 2 },
    { id: "g", label: "2 / 3R", test: (v: number) => v > 2 && v <= 3 },
    { id: "h", label: "≥ 3R", test: (v: number) => v > 3 },
  ].map((bucket) => ({ ...bucket, count: values.filter(bucket.test).length }));

  const peak = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="flex items-end gap-1.5" style={{ height: 132 }}>
      {buckets.map((bucket) => {
        const height = (bucket.count / peak) * 100;
        const negative = ["a", "b", "c"].includes(bucket.id);
        const flat = bucket.id === "d";
        return (
          <div key={bucket.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="t-num text-[0.625rem] text-[var(--text-faint)]">
              {bucket.count || ""}
            </span>
            <div
              className="w-full"
              style={{
                height: `${Math.max(bucket.count ? 4 : 1, height)}%`,
                background: flat
                  ? "var(--text-faint)"
                  : negative
                    ? "var(--verm)"
                    : "var(--sage)",
                opacity: bucket.count ? 0.85 : 0.22,
              }}
            />
            <span className="t-label whitespace-nowrap text-[0.5625rem] tracking-[0.06em]">
              {bucket.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
