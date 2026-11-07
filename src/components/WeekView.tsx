"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssetGroup, DayBlock, WeekData } from "@/lib/types";
import { GROUPS, groupOf } from "@/lib/instruments";
import { impactColor } from "@/lib/labels";
import { addDays, longDate, trTodayISO } from "@/lib/weeks";
import DayStrip from "./DayStrip";
import UpcomingAlerts from "./UpcomingAlerts";
import AiPanel from "./AiPanel";
import EventRow from "./EventRow";

const ALL_GROUPS = GROUPS.map((g) => g.id);

type View = "bugun" | "yarin" | "hafta";

export default function WeekView({ week }: { week: WeekData }) {
  const [active, setActive] = useState<AssetGroup[]>(ALL_GROUPS);
  const [onlyHigh, setOnlyHigh] = useState(false);
  const [view, setView] = useState<View>("hafta");
  const [todayISO, setTodayISO] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  // Statik site: "bugun" tarayicida belirlenir.
  useEffect(() => {
    const today = trTodayISO();
    setTodayISO(today);
    if (today >= week.start && today <= week.end) setView("bugun");
    const id = setInterval(() => setTodayISO(trTodayISO()), 10 * 60_000);
    return () => clearInterval(id);
  }, [week.start, week.end]);

  const inWeek = todayISO >= week.start && todayISO <= week.end;
  const tomorrowISO = todayISO ? addDays(todayISO, 1) : "";

  const filtered = useMemo<DayBlock[]>(
    () =>
      week.days.map((day) => ({
        ...day,
        events: day.events.filter((e) => {
          if (onlyHigh && e.impact !== 3) return false;
          const groups = e.affected
            .map((a) => groupOf(a.symbol))
            .filter((g): g is AssetGroup => g !== undefined);
          if (groups.length === 0) return true;
          return groups.some((g) => active.includes(g));
        }),
      })),
    [week.days, active, onlyHigh],
  );

  const visible = useMemo<DayBlock[]>(() => {
    if (view === "bugun") return filtered.filter((d) => d.date === todayISO);
    if (view === "yarin") return filtered.filter((d) => d.date === tomorrowISO);
    if (picked) return filtered.filter((d) => d.key === picked);
    return filtered;
  }, [filtered, view, todayISO, tomorrowISO, picked]);

  const shown = visible.reduce((n, d) => n + d.events.length, 0);
  const weekTotal = week.days.reduce((n, d) => n + d.events.length, 0);

  const upcoming = useMemo(
    () => week.days.flatMap((d) => d.events),
    [week.days],
  );

  function toggleGroup(id: AssetGroup) {
    setActive((prev) =>
      prev.includes(id)
        ? prev.length === 1
          ? prev
          : prev.filter((g) => g !== id)
        : [...prev, id],
    );
  }

  const tabs: { id: View; label: string; show: boolean }[] = [
    { id: "bugun", label: "Bugün", show: inWeek },
    { id: "yarin", label: "Yarın", show: inWeek && tomorrowISO <= week.end },
    { id: "hafta", label: "Hafta", show: true },
  ];

  return (
    <div className="space-y-6">
      <UpcomingAlerts events={upcoming} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--hairline)] pb-3">
        <div className="flex items-center gap-1">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setView(t.id);
                  setPicked(null);
                }}
                aria-pressed={view === t.id}
                className={[
                  "rounded-sm px-3 py-1.5 text-[0.875rem] transition-colors",
                  view === t.id
                    ? "bg-[var(--bg-raise)] font-medium text-[var(--text)]"
                    : "text-[var(--text-faint)] hover:text-[var(--text-dim)]",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1">
            {GROUPS.map((g) => {
              const on = active.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  aria-pressed={on}
                  title={g.label}
                  className={[
                    "t-num rounded-sm px-1.5 py-1 text-[0.6875rem] transition-colors",
                    on
                      ? "bg-[var(--bg-raise)] text-[var(--text)]"
                      : "text-[var(--text-faint)] hover:text-[var(--text-dim)]",
                  ].join(" ")}
                >
                  {g.code}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setOnlyHigh((v) => !v)}
            aria-pressed={onlyHigh}
            className={[
              "rounded-sm px-2 py-1 text-[0.75rem] transition-colors",
              onlyHigh
                ? "text-[var(--verm)]"
                : "text-[var(--text-faint)] hover:text-[var(--text-dim)]",
            ].join(" ")}
          >
            sadece yüksek etki
          </button>
        </div>
      </div>

      {view === "hafta" && (
        <>
          <DayStrip
            days={filtered}
            todayISO={todayISO}
            selected={picked ?? undefined}
            onSelect={(key) => setPicked((p) => (p === key ? null : key))}
          />
          {picked && (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-[0.75rem] text-[var(--text-faint)] underline-offset-2 hover:text-[var(--text-dim)] hover:underline"
            >
              tüm haftayı göster
            </button>
          )}
          <AiPanel ai={week.ai} />
        </>
      )}

      <div>
        {visible.map((day) => (
          <DaySection key={day.key} day={day} isToday={day.date === todayISO} />
        ))}

        {shown === 0 && (
          <p className="border-t border-[var(--hairline)] py-12 text-center text-[0.875rem] text-[var(--text-dim)]">
            {view === "bugun" && "Bugün takvimde haber yok. Sakin bir gün."}
            {view === "yarin" && "Yarın takvimde haber yok."}
            {view === "hafta" &&
              (weekTotal === 0
                ? "Bu hafta için veri yok."
                : "Bu filtrede haber yok. Bir grup ekle ya da yüksek etki filtresini kaldır.")}
          </p>
        )}
      </div>
    </div>
  );
}

function DaySection({ day, isToday }: { day: DayBlock; isToday: boolean }) {
  if (day.events.length === 0) return null;
  const high = day.events.filter((e) => e.impact === 3).length;

  return (
    <section className="tape-in mb-7">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-1.5">
        <h2 className="text-[0.9375rem] font-medium text-[var(--text)]">
          {longDate(day.date)}
        </h2>
        {isToday && (
          <span
            className="rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium"
            style={{ background: "var(--amber)", color: "#0f1626" }}
          >
            bugün
          </span>
        )}
        <span className="ml-auto text-[0.75rem] text-[var(--text-faint)]">
          {day.events.length} haber
          {high > 0 && (
            <span style={{ color: impactColor(3) }}> · {high} yüksek etki</span>
          )}
        </span>
      </header>

      {day.focus && (
        <p className="mb-1.5 max-w-[80ch] text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
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
