"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssetGroup, DayBlock, Impact } from "@/lib/types";
import { GROUPS, groupOf, instrumentName } from "@/lib/instruments";
import { volatilityColor } from "@/lib/labels";
import { dayMetaFor, shortDate } from "@/lib/weeks";

/**
 * Haftanin sismografi.
 *
 * x ekseni zaman: gun kolonlari, kolon icinde olayin TRT saati.
 * y ekseni dort serit: her varlik grubu kendi seridinde.
 * Tik yuksekligi beklenen oynaklik, rengi etki siddeti.
 */

const VB_W = 1200;
const GUTTER = 48;
const PAD_R = 10;
const TOP = 22;
const LANE_H = 32;
const BOTTOM = 20;
const VB_H = TOP + GROUPS.length * LANE_H + BOTTOM;

interface Tick {
  key: string;
  x: number;
  lane: number;
  h: number;
  color: string;
  href: string;
  title: string;
  unscheduled: boolean;
  dim: boolean;
}

function minutesOf(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

export default function VolatilityRibbon({
  days,
  activeGroups,
  todayISO,
}: {
  days: DayBlock[];
  activeGroups: AssetGroup[];
  todayISO: string;
}) {
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const hhmm = new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
      setNowMinutes(minutesOf(hhmm));
    };
    read();
    const id = setInterval(read, 60_000);
    return () => clearInterval(id);
  }, []);

  const colW = (VB_W - GUTTER - PAD_R) / Math.max(days.length, 1);

  const ticks = useMemo<Tick[]>(() => {
    const out: Tick[] = [];
    days.forEach((day, di) => {
      for (const event of day.events) {
        const mins = minutesOf(event.time);
        const frac = mins === null ? 0.5 : mins / 1440;
        const x = GUTTER + di * colW + colW * (0.06 + 0.88 * frac);

        // Olayin dokundugu her grupta en guclu etkiyi bul.
        const byGroup = new Map<AssetGroup, Impact>();
        for (const a of event.affected) {
          const g = groupOf(a.symbol);
          if (!g) continue;
          const prev = byGroup.get(g);
          if (!prev || a.strength > prev) byGroup.set(g, a.strength);
        }

        for (const [group, strength] of byGroup) {
          const lane = GROUPS.findIndex((g) => g.id === group);
          if (lane < 0) continue;
          const scale = (event.volatility / 100) * (0.6 + (strength / 3) * 0.4);
          const h = Math.max(3, Math.min(LANE_H - 4, (LANE_H - 4) * scale));
          const strongest = event.affected
            .filter((a) => groupOf(a.symbol) === group)
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 3)
            .map((a) => instrumentName(a.symbol));

          out.push({
            key: `${event.id}-${group}`,
            x,
            lane,
            h,
            color: volatilityColor(event.volatility),
            href: `#${event.id}`,
            title: `${day.label} ${event.time ?? "gün içi"} — ${event.title}\n${strongest.join(", ")}`,
            unscheduled: mins === null,
            dim: !activeGroups.includes(group),
          });
        }
      }
    });
    return out;
  }, [days, colW, activeGroups]);

  const todayIndex = days.findIndex((d) => d.date === todayISO);
  const nowX =
    todayIndex >= 0 && nowMinutes !== null
      ? GUTTER + todayIndex * colW + colW * (0.06 + 0.88 * (nowMinutes / 1440))
      : null;

  const summary = `Hafta sismografı: ${ticks.length} etki noktası, ${days.length} işlem günü.`;

  return (
    <figure className="m-0">
      {/* Dar ekranda sikismasin diye taban genislik verilir, serit kaydirilir. */}
      <div className="overflow-x-auto rounded-sm border border-[var(--hairline)] bg-[var(--bg-surface)]">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="ribbon block h-auto w-full min-w-[680px]"
          role="img"
          aria-label={summary}
        >
          {/* Gun kolonlari */}
          {days.map((day, di) => {
            const x = GUTTER + di * colW;
            const meta = dayMetaFor(day.key);
            const isToday = day.date === todayISO;
            return (
              <g key={day.key}>
                {di > 0 && (
                  <line
                    x1={x}
                    y1={6}
                    x2={x}
                    y2={VB_H - BOTTOM + 4}
                    stroke="var(--hairline)"
                    strokeWidth={1}
                  />
                )}
                {isToday && (
                  <rect
                    x={x}
                    y={TOP - 6}
                    width={colW}
                    height={GROUPS.length * LANE_H + 6}
                    fill="var(--amber)"
                    opacity={0.045}
                  />
                )}
                <text
                  x={x + 8}
                  y={14}
                  fill={isToday ? "var(--text)" : "var(--text-faint)"}
                  fontSize={9.5}
                  letterSpacing={2}
                  fontFamily="var(--font-mono)"
                >
                  {meta?.short ?? day.label.slice(0, 3)}
                </text>
                <text
                  x={x + 8}
                  y={VB_H - 6}
                  fill="var(--text-faint)"
                  fontSize={9}
                  fontFamily="var(--font-mono)"
                >
                  {shortDate(day.date)}
                </text>
              </g>
            );
          })}

          {/* Serit tabanlari ve etiketleri */}
          {GROUPS.map((group, lane) => {
            const baseY = TOP + (lane + 1) * LANE_H;
            return (
              <g key={group.id}>
                <line
                  x1={GUTTER}
                  y1={baseY}
                  x2={VB_W - PAD_R}
                  y2={baseY}
                  stroke="var(--hairline)"
                  strokeWidth={1}
                  opacity={0.7}
                />
                <text
                  x={8}
                  y={baseY - 3}
                  fill={
                    activeGroups.includes(group.id)
                      ? "var(--text-dim)"
                      : "var(--text-faint)"
                  }
                  fontSize={9.5}
                  letterSpacing={1.5}
                  fontFamily="var(--font-mono)"
                  opacity={activeGroups.includes(group.id) ? 1 : 0.45}
                >
                  {group.code}
                </text>
              </g>
            );
          })}

          {/* Etki tikleri */}
          {ticks.map((t) => {
            const baseY = TOP + (t.lane + 1) * LANE_H;
            return (
              <a key={t.key} href={t.href} className="ribbon-tick">
                <title>{t.title}</title>
                <rect
                  x={t.x - 1.5}
                  y={baseY - t.h}
                  width={3}
                  height={t.h}
                  fill={t.color}
                  opacity={t.dim ? 0.14 : t.unscheduled ? 0.45 : 0.9}
                  rx={0.5}
                />
              </a>
            );
          })}

          {/* Su an */}
          {nowX !== null && (
            <g>
              <line
                x1={nowX}
                y1={TOP - 8}
                x2={nowX}
                y2={TOP + GROUPS.length * LANE_H + 2}
                stroke="var(--text)"
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.65}
              />
              <path
                d={`M ${nowX - 3.5} ${TOP - 10} L ${nowX + 3.5} ${TOP - 10} L ${nowX} ${TOP - 4} Z`}
                fill="var(--text)"
                opacity={0.8}
              />
            </g>
          )}
        </svg>
      </div>
      <figcaption className="t-label mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>tik yüksekliği = beklenen oynaklık</span>
        <span className="flex items-center gap-1.5">
          renk = etki
          <span className="inline-flex items-center gap-1">
            {(
              [
                ["var(--sage)", "düşük"],
                ["var(--amber)", "orta"],
                ["var(--verm)", "yüksek"],
              ] as const
            ).map(([c, l]) => (
              <span key={l} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-[3px]"
                  style={{ background: c }}
                  aria-hidden
                />
                {l}
              </span>
            ))}
          </span>
        </span>
        <span>şerit = varlık grubu</span>
        <span className="text-[var(--text-faint)]">tike tıkla, habere gider</span>
      </figcaption>
    </figure>
  );
}
