"use client";

import { useEffect, useState } from "react";
import type { AffectedInstrument, Direction, NewsEvent } from "@/lib/types";
import { volatilityLabel } from "@/lib/types";
import { CATEGORY_TR, DIRECTION_GLYPH, impactColor } from "@/lib/labels";
import { instrumentName } from "@/lib/instruments";
import { surpriseLabel } from "@/lib/outcomes";
import { formatCountdown, nyTime } from "@/lib/clock";
import { longDate } from "@/lib/weeks";

/**
 * Secili haberin detayi.
 *
 * Listede yalnizca tarama icin gereken alanlar duruyor; derinlik buraya
 * tasindi. Boylece satirlar hafif kaliyor ama bilgi kaybolmuyor.
 */

const DIRECTION_HEAD: Record<Direction, string> = {
  yukari: "Yukarı yönlü",
  asagi: "Aşağı yönlü",
  volatil: "İki yönlü oynak",
};

const ORDER: Direction[] = ["yukari", "asagi", "volatil"];

function Strength({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-[2px]" aria-label={`etki ${value}/3`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className="inline-block h-[3px] w-[5px] rounded-[1px]"
          style={{
            background: n <= value ? "var(--text-dim)" : "var(--hairline)",
          }}
        />
      ))}
    </span>
  );
}

export default function EventDetail({
  event,
  onClose,
}: {
  event: NewsEvent;
  onClose: () => void;
}) {
  const [left, setLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!event.utc) {
      setLeft(null);
      return;
    }
    const at = new Date(event.utc).getTime();
    const tick = () => setLeft(formatCountdown(at - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event.utc]);

  const ny = event.utc ? nyTime(event.utc) : null;
  const color = impactColor(event.impact);

  const grouped = ORDER.map((dir) => ({
    dir,
    items: event.affected
      .filter((a) => a.direction === dir)
      .sort((a, b) => b.strength - a.strength),
  })).filter((g) => g.items.length > 0);

  const numbers: [string, string][] = [];
  if (event.forecast) numbers.push(["beklenti", event.forecast]);
  if (event.previous) numbers.push(["önceki", event.previous]);
  if (event.metric) numbers.push([event.metric.label, event.metric.value]);

  return (
    <article>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--hairline)] bg-[var(--bg-surface)] px-4 py-3">
        <span className="t-label">{event.date ? longDate(event.date) : "—"}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Detayı kapat"
          className="-mt-1 -mr-1 px-1.5 text-[1.125rem] leading-none text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
        >
          ×
        </button>
      </header>

      <div className="px-4 py-4">
        <div className="flex items-baseline gap-2.5">
          <span className="t-num text-[2rem] leading-none text-[var(--text)]">
            {event.time ?? "—"}
          </span>
          <span className="t-num text-[0.8125rem] text-[var(--text-dim)]">
            {ny ? `${ny} NY` : "gün içi"}
          </span>
        </div>
        {left && (
          <p className="t-num mt-1.5 text-[0.8125rem]" style={{ color }}>
            {left} kaldı
          </p>
        )}

        <h2 className="t-display mt-3 text-[1.25rem] leading-tight text-[var(--text)]">
          {event.title}
        </h2>
        <p className="mt-1 text-[0.8125rem] text-[var(--text-dim)]">
          {event.region}
          {event.currency ? ` · ${event.currency}` : ""} ·{" "}
          {CATEGORY_TR[event.category]}
        </p>

        <div className="mt-3">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--hairline)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${event.volatility}%`, background: color }}
            />
          </div>
          <p className="mt-1.5 text-[0.75rem]" style={{ color }}>
            {volatilityLabel(event.volatility)} oynaklık beklentisi
          </p>
        </div>

        {numbers.length > 0 && (
          <dl className="mt-4 space-y-1">
            {numbers.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="text-[0.75rem] text-[var(--text-faint)]">{k}</dt>
                <dd className="t-num text-right text-[0.8125rem] text-[var(--text)]">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {event.results && event.results.length > 0 && (
          <section className="mt-5">
            <h3 className="text-[0.75rem] text-[var(--text-faint)]">Ne geldi</h3>
            <ul className="mt-1.5 space-y-2">
              {event.results.map((r) => {
                const yon = surpriseLabel(r);
                const renk =
                  yon === "üstünde"
                    ? "var(--sage)"
                    : yon === "altında"
                      ? "var(--verm)"
                      : "var(--text-dim)";
                return (
                  <li key={r.name} className="leading-snug">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-[0.8125rem] text-[var(--text-dim)]">
                        {r.name}
                      </span>
                      <span className="t-num shrink-0 text-[0.9375rem]" style={{ color: renk }}>
                        {r.actual}
                      </span>
                    </div>
                    {(r.forecast || r.previous) && (
                      <div className="t-num mt-0.5 text-[0.6875rem] text-[var(--text-faint)]">
                        {r.forecast ? `beklenti ${r.forecast}` : null}
                        {r.forecast && yon ? ` · ${yon}` : null}
                        {r.previous ? `${r.forecast ? " · " : ""}önceki ${r.previous}` : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {event.also && event.also.length > 0 && (
          <section className="mt-5">
            <h3 className="text-[0.75rem] text-[var(--text-faint)]">Aynı anda</h3>
            <ul className="mt-1.5 space-y-1">
              {event.also.map((t) => (
                <li key={t} className="text-[0.8125rem] leading-snug text-[var(--text-dim)]">
                  {t}
                </li>
              ))}
            </ul>
          </section>
        )}

        {grouped.length > 0 && (
          <section className="mt-5">
            <h3 className="text-[0.75rem] text-[var(--text-faint)]">
              Etkilenen pariteler
            </h3>
            <div className="mt-2 space-y-3">
              {grouped.map((g) => (
                <div key={g.dir}>
                  <p className="text-[0.6875rem] text-[var(--text-faint)]">
                    <span aria-hidden className="mr-1">
                      {DIRECTION_GLYPH[g.dir]}
                    </span>
                    {DIRECTION_HEAD[g.dir]}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {g.items.map((a: AffectedInstrument) => (
                      <li
                        key={a.symbol}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0">
                          <span className="t-num text-[0.8125rem] text-[var(--text)]">
                            {a.symbol}
                          </span>
                          <span className="ml-2 text-[0.75rem] text-[var(--text-faint)]">
                            {instrumentName(a.symbol)}
                          </span>
                        </span>
                        <Strength value={a.strength} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {event.aiResult && (
          <section className="mt-5 border-l-2 border-l-[var(--violet)] pl-3">
            <h3 className="text-[0.6875rem]" style={{ color: "var(--violet)" }}>
              Ne oldu
            </h3>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
              {event.aiResult}
            </p>
          </section>
        )}

        {event.ai && (
          <section className="mt-5 border-l-2 border-l-[var(--hairline)] pl-3">
            <h3 className="text-[0.6875rem] text-[var(--text-faint)]">
              {event.aiResult ? "Öncesinde beklenen" : "Yapay zeka yorumu"}
            </h3>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
              {event.ai}
            </p>
          </section>
        )}

        {event.source && (
          <p className="mt-5 text-[0.6875rem] text-[var(--text-faint)]">
            kaynak: {event.source.label}
          </p>
        )}
      </div>
    </article>
  );
}
