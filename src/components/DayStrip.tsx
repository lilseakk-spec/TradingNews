"use client";

import type { DayBlock } from "@/lib/types";
import { impactColor } from "@/lib/labels";
import { dayMetaFor, parseISO } from "@/lib/weeks";

/**
 * Haftanin tek bakista ozeti.
 *
 * Her gun bir kolon: gun adi, tarih, olay basina bir nokta (rengi etki
 * siddeti) ve toplam. Aciklama gerektirmez — nokta sayisi yogunlugu,
 * kirmizi nokta yuksek etkiyi gosterir.
 */
export default function DayStrip({
  days,
  todayISO,
  selected,
  onSelect,
}: {
  days: DayBlock[];
  todayISO: string;
  selected?: string;
  onSelect?: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-sm border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-7">
      {days.map((day) => {
        const meta = dayMetaFor(day.key);
        const isToday = day.date === todayISO;
        const isSelected = selected === day.key;
        const high = day.events.filter((e) => e.impact === 3).length;

        return (
          <button
            key={day.key}
            type="button"
            onClick={() => onSelect?.(day.key)}
            aria-pressed={isSelected}
            className={[
              "flex min-h-[5.5rem] flex-col items-start gap-1.5 p-2.5 text-left transition-colors",
              isSelected ? "bg-[var(--bg-raise)]" : "bg-[var(--bg-surface)]",
              onSelect ? "hover:bg-[var(--bg-raise)]" : "cursor-default",
            ].join(" ")}
          >
            <div className="flex w-full items-baseline justify-between gap-1">
              <span
                className={`t-num text-[0.6875rem] tracking-wider ${
                  isToday ? "text-[var(--amber)]" : "text-[var(--text-faint)]"
                }`}
              >
                {meta?.short ?? day.key.slice(0, 3).toUpperCase()}
              </span>
              <span
                className={`t-num text-[0.8125rem] ${
                  isToday ? "text-[var(--amber)]" : "text-[var(--text-dim)]"
                }`}
              >
                {parseISO(day.date).d}
              </span>
            </div>

            <div className="flex min-h-[0.75rem] flex-wrap items-center gap-[3px]">
              {day.events.slice(0, 12).map((e) => (
                <span
                  key={e.id}
                  title={`${e.time ?? "gün içi"} ${e.title}`}
                  className="inline-block h-[7px] w-[7px] rounded-full"
                  style={{ background: impactColor(e.impact) }}
                />
              ))}
            </div>

            <span className="mt-auto text-[0.6875rem] leading-none text-[var(--text-faint)]">
              {day.events.length === 0 ? (
                "sakin"
              ) : (
                <>
                  {day.events.length} haber
                  {high > 0 && (
                    <span style={{ color: "var(--verm)" }}> · {high} yüksek</span>
                  )}
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
