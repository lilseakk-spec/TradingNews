import Link from "next/link";
import type { WeekData } from "@/lib/types";
import { weekStats } from "@/lib/weeks";
import { impactColor } from "@/lib/labels";
import WeekView from "./WeekView";

export default function WeekScreen({
  week,
  prev,
  next,
}: {
  week: WeekData;
  prev?: { id: string; label: string };
  next?: { id: string; label: string };
}) {
  const stats = weekStats(week);

  return (
    <>
      <header className="pb-5 pt-7 sm:pt-9">
        <div className="flex items-center justify-between gap-4">
          <h1 className="t-display text-[clamp(1.5rem,5vw,2.5rem)] text-[var(--text)]">
            {week.label}
          </h1>
          <nav className="flex shrink-0 items-center gap-1 text-[0.75rem]">
            {prev ? (
              <Link
                href={`/hafta/${prev.id}`}
                className="rounded px-2 py-1 text-[var(--text-faint)] transition-colors hover:bg-[var(--bg-raise)] hover:text-[var(--text)]"
              >
                ← {prev.label}
              </Link>
            ) : null}
            {next ? (
              <Link
                href={`/hafta/${next.id}`}
                className="rounded px-2 py-1 text-[var(--text-faint)] transition-colors hover:bg-[var(--bg-raise)] hover:text-[var(--text)]"
              >
                {next.label} →
              </Link>
            ) : null}
          </nav>
        </div>

        {week.preliminary && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-[var(--text-dim)]">
            <span
              className="rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium"
              style={{ background: "var(--violet)", color: "#0f1626" }}
            >
              ön izleme
            </span>
            Takvim henüz kesinleşmedi: saatler kayabilir, haber eklenip
            çıkabilir. Pazar sabahı kesin haliyle yenilenir.
          </p>
        )}

        <p className="mt-1.5 text-[0.8125rem] text-[var(--text-dim)]">
          <span className="t-num text-[var(--text)]">{stats.total}</span> haber
          {stats.high > 0 && (
            <>
              {" · "}
              <span className="t-num" style={{ color: impactColor(3) }}>
                {stats.high}
              </span>{" "}
              yüksek etki
            </>
          )}
          {stats.peak && stats.peak.count > 0 && (
            <>
              {" · en yoğun gün "}
              <span className="text-[var(--text)]">
                {stats.peak.label.charAt(0) +
                  stats.peak.label.slice(1).toLocaleLowerCase("tr")}
              </span>
            </>
          )}
        </p>

        {stats.hottest.length > 0 && (
          <p className="t-num mt-1 text-[0.75rem] text-[var(--text-faint)]">
            en çok dokunulan: {stats.hottest.map((h) => h.symbol).join("  ")}
          </p>
        )}
      </header>

      <WeekView week={week} />
    </>
  );
}
