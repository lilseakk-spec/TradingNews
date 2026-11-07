"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssetGroup, DayBlock, NewsEvent, WeekData } from "@/lib/types";
import { GROUPS, groupOf } from "@/lib/instruments";
import { impactColor } from "@/lib/labels";
import { addDays, longDate, trTodayISO } from "@/lib/weeks";
import DayStrip from "./DayStrip";
import BreakingWatch from "./BreakingWatch";
import UpcomingAlerts from "./UpcomingAlerts";
import AiPanel from "./AiPanel";
import EventRow from "./EventRow";
import EventDetail from "./EventDetail";
import DayNote from "./DayNote";

const ALL_GROUPS = GROUPS.map((g) => g.id);

type View = "bugun" | "yarin" | "hafta";

export default function WeekView({ week }: { week: WeekData }) {
  const [active, setActive] = useState<AssetGroup[]>(ALL_GROUPS);
  const [onlyHigh, setOnlyHigh] = useState(false);
  const [view, setView] = useState<View>("hafta");
  const [todayISO, setTodayISO] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  /** Klavye gezintisi icin duz liste. */
  const flat = useMemo(() => visible.flatMap((d) => d.events), [visible]);
  const shown = flat.length;
  const weekTotal = week.days.reduce((n, d) => n + d.events.length, 0);
  const allEvents = useMemo(() => week.days.flatMap((d) => d.events), [week.days]);

  const selected: NewsEvent | null =
    allEvents.find((e) => e.id === selectedId) ?? null;

  const move = useCallback(
    (step: number) => {
      if (flat.length === 0) return;
      const at = flat.findIndex((e) => e.id === selectedId);
      const next = at < 0 ? 0 : Math.min(flat.length - 1, Math.max(0, at + step));
      const target = flat[next];
      setSelectedId(target.id);
      document.getElementById(target.id)?.scrollIntoView({ block: "nearest" });
    },
    [flat, selectedId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  // Filtre degisince secili haber listeden dusmus olabilir.
  useEffect(() => {
    if (selectedId && !flat.some((e) => e.id === selectedId)) setSelectedId(null);
  }, [flat, selectedId]);

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
      <BreakingWatch />

      <UpcomingAlerts events={allEvents} onOpen={setSelectedId} />

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

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
        <div ref={listRef}>
          {visible.map((day) => (
            <DaySection
              key={day.key}
              day={day}
              isToday={day.date === todayISO}
              noteLabel={
                view === "bugun"
                  ? "Bugünün odağı"
                  : view === "yarin"
                    ? "Yarının odağı"
                    : null
              }
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
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

        <aside className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-sm border border-[var(--hairline)] bg-[var(--bg-surface)] lg:block">
          {selected ? (
            <EventDetail event={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="px-4 py-8">
              <p className="text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
                Bir habere tıkla, detayı burada açılsın: tüm etkilenen pariteler,
                beklenti ve önceki değerler, yapay zeka yorumu.
              </p>
              <p className="mt-3 text-[0.75rem] text-[var(--text-faint)]">
                Klavyeyle de gezebilirsin: ↑ ↓ ile haberler arasında, Esc ile kapat.
              </p>
            </div>
          )}
        </aside>
      </div>

      {selected && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Detayı kapat"
            onClick={() => setSelectedId(null)}
            className="absolute inset-0 bg-black/55"
          />
          <div className="absolute inset-x-0 bottom-0 h-[82dvh] overflow-y-auto rounded-t-lg border-t border-[var(--hairline)] bg-[var(--bg-surface)]">
            <EventDetail event={selected} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function DaySection({
  day,
  isToday,
  noteLabel,
  selectedId,
  onSelect,
}: {
  day: DayBlock;
  isToday: boolean;
  /** Gun gorunumlerinde odak kendi karti olur; hafta listesinde sessiz satir. */
  noteLabel: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (day.events.length === 0) return null;
  const high = day.events.filter((e) => e.impact === 3).length;

  return (
    <section className="tape-in mb-6">
      <header className="sticky top-0 z-10 flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-[var(--bg)]/92 py-1.5 backdrop-blur">
        <h2 className="text-[0.875rem] font-medium text-[var(--text)]">
          {longDate(day.date)}
        </h2>
        {isToday && (
          <span
            className="rounded-sm px-1.5 py-0.5 text-[0.625rem] font-medium"
            style={{ background: "var(--amber)", color: "#0f1626" }}
          >
            bugün
          </span>
        )}
        <span className="ml-auto text-[0.6875rem] text-[var(--text-faint)]">
          {day.events.length} haber
          {high > 0 && (
            <span style={{ color: impactColor(3) }}> · {high} yüksek</span>
          )}
        </span>
      </header>

      {day.focus &&
        (noteLabel ? (
          <DayNote text={day.focus} label={noteLabel} />
        ) : (
          <p className="mb-1 max-w-[80ch] text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
            {day.focus}
          </p>
        ))}

      <div>
        {day.events.map((e) => (
          <EventRow
            key={e.id}
            event={e}
            selected={selectedId === e.id}
            onSelect={() => onSelect(e.id)}
          />
        ))}
      </div>
    </section>
  );
}
