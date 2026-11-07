"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssetGroup, DayBlock, WeekData } from "@/lib/types";
import { volatilityLabel } from "@/lib/types";
import { GROUPS, groupOf } from "@/lib/instruments";
import { volatilityColor } from "@/lib/labels";
import { shortDate, trTodayISO } from "@/lib/weeks";
import VolatilityRibbon from "./VolatilityRibbon";
import AiPanel from "./AiPanel";
import EventRow from "./EventRow";

const ALL_GROUPS = GROUPS.map((g) => g.id);

export default function WeekView({ week }: { week: WeekData }) {
  const [active, setActive] = useState<AssetGroup[]>(ALL_GROUPS);
  const [onlyHigh, setOnlyHigh] = useState(false);
  // Site statik kuruldugu icin "bugun" tarayicida belirlenir; ilk boyamada
  // bos kalir, sunucu ciktisiyla ayni olur, sonra yerine oturur.
  const [todayISO, setTodayISO] = useState("");

  useEffect(() => {
    setTodayISO(trTodayISO());
    const id = setInterval(() => setTodayISO(trTodayISO()), 10 * 60_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo<DayBlock[]>(() => {
    return week.days.map((day) => ({
      ...day,
      events: day.events.filter((e) => {
        if (onlyHigh && e.impact !== 3) return false;
        const groups = e.affected
          .map((a) => groupOf(a.symbol))
          .filter((g): g is AssetGroup => g !== undefined);
        // Takip evrenine denk gelen paritesi kalmamis bir olay hicbir
        // filtrede gizlenmesin; gorunur kalsin ki sessizce kaybolmasin.
        if (groups.length === 0) return true;
        return groups.some((g) => active.includes(g));
      }),
    }));
  }, [week.days, active, onlyHigh]);

  const shown = filtered.reduce((n, d) => n + d.events.length, 0);
  const total = week.days.reduce((n, d) => n + d.events.length, 0);

  function toggleGroup(id: AssetGroup) {
    setActive((prev) =>
      prev.includes(id)
        ? prev.length === 1
          ? prev
          : prev.filter((g) => g !== id)
        : [...prev, id],
    );
  }

  return (
    <div className="space-y-8">
      <VolatilityRibbon days={week.days} activeGroups={active} todayISO={todayISO} />

      <AiPanel ai={week.ai} />

      <div className="sticky top-0 z-20 -mx-4 border-b border-[var(--hairline)] bg-[var(--bg)]/92 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1">
            <span className="t-label mr-1">grup</span>
            {GROUPS.map((g) => {
              const on = active.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  aria-pressed={on}
                  className={[
                    "t-num rounded-sm border px-2 py-1 text-[0.6875rem] transition-colors",
                    on
                      ? "border-[var(--hairline)] bg-[var(--bg-raise)] text-[var(--text)]"
                      : "border-transparent text-[var(--text-faint)] hover:text-[var(--text-dim)]",
                  ].join(" ")}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setOnlyHigh((v) => !v)}
            aria-pressed={onlyHigh}
            className={[
              "t-num rounded-sm border px-2 py-1 text-[0.6875rem] transition-colors",
              onlyHigh
                ? "border-[var(--verm)] text-[var(--verm)]"
                : "border-transparent text-[var(--text-faint)] hover:text-[var(--text-dim)]",
            ].join(" ")}
          >
            sadece yüksek etki
          </button>

          <span className="t-label ml-auto">
            {shown === total ? `${total} haber` : `${shown} / ${total} haber`}
          </span>
        </div>
      </div>

      <div>
        {filtered.map((day) => (
          <DaySection key={day.key} day={day} isToday={day.date === todayISO} />
        ))}

        {shown === 0 && (
          <p className="border-t border-[var(--hairline)] py-10 text-center text-[0.875rem] text-[var(--text-dim)]">
            Bu filtrede haber yok. Bir grup ekle ya da yüksek etki filtresini kaldır.
          </p>
        )}
      </div>
    </div>
  );
}

function DaySection({ day, isToday }: { day: DayBlock; isToday: boolean }) {
  if (day.events.length === 0) return null;
  const peak = day.events.reduce((m, e) => Math.max(m, e.volatility), 0);

  return (
    <section className="tape-in mb-8">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-2">
        <h2 className="t-display text-[1.125rem] text-[var(--text)]">{day.label}</h2>
        <span className="t-num text-[0.75rem] text-[var(--text-faint)]">
          {shortDate(day.date)}
        </span>
        {isToday && (
          <span
            className="t-label rounded-sm px-1.5 py-0.5"
            style={{ background: "var(--amber)", color: "#0f1626" }}
          >
            bugün
          </span>
        )}
        <span className="t-label ml-auto flex items-center gap-2">
          <span>{day.events.length} haber</span>
          <span className="flex items-center gap-1">
            zirve
            <span
              className="inline-block h-2.5 w-[3px]"
              style={{ background: volatilityColor(peak) }}
              aria-hidden
            />
            <span style={{ color: volatilityColor(peak) }}>{volatilityLabel(peak)}</span>
          </span>
        </span>
      </header>

      {day.focus && (
        <p className="mb-1 max-w-[80ch] border-l-2 border-l-[var(--hairline)] pl-3 text-[0.8125rem] leading-relaxed text-[var(--text-dim)] sm:pl-4">
          {day.focus}
        </p>
      )}

      <div>
        {day.events.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}
