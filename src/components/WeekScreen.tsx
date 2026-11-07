import Link from "next/link";
import type { WeekData } from "@/lib/types";
import { weekStats } from "@/lib/weeks";
import { instrumentName } from "@/lib/instruments";
import { volatilityColor } from "@/lib/labels";
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
  const [year, weekNo] = week.id.split("-W");

  return (
    <>
      <header className="border-b border-[var(--hairline)] pb-5 pt-8 sm:pt-10">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <p className="t-eyebrow">
            {year} · {Number(weekNo)}. hafta
          </p>
          <nav className="ml-auto flex items-center gap-1">
            {prev ? (
              <Link
                href={`/hafta/${prev.id}`}
                className="t-label rounded px-2 py-1 transition-colors hover:bg-[var(--bg-raise)] hover:text-[var(--text)]"
              >
                ← {prev.label}
              </Link>
            ) : (
              <span className="t-label px-2 py-1 opacity-40">← önceki yok</span>
            )}
            {next ? (
              <Link
                href={`/hafta/${next.id}`}
                className="t-label rounded px-2 py-1 transition-colors hover:bg-[var(--bg-raise)] hover:text-[var(--text)]"
              >
                {next.label} →
              </Link>
            ) : (
              <span className="t-label px-2 py-1 opacity-40">sonraki yok</span>
            )}
          </nav>
        </div>

        <h1 className="t-display mt-1.5 text-[clamp(1.75rem,6vw,3rem)] text-[var(--text)]">
          {week.label}
        </h1>

        <dl className="t-num mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[0.8125rem] text-[var(--text-dim)]">
          <div className="flex items-baseline gap-1.5">
            <dt className="t-label">haber</dt>
            <dd className="text-[var(--text)]">{stats.total}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="t-label">yüksek etki</dt>
            <dd style={{ color: "var(--verm)" }}>{stats.high}</dd>
          </div>
          {stats.peak && (
            <div className="flex items-baseline gap-1.5">
              <dt className="t-label">en yoğun gün</dt>
              <dd className="text-[var(--text)]">
                {stats.peak.label}
                <span
                  className="ml-1.5 inline-block h-2.5 w-[3px] align-middle"
                  style={{ background: volatilityColor(stats.peak.score) }}
                  aria-hidden
                />
              </dd>
            </div>
          )}
          <div className="flex min-w-0 items-baseline gap-2">
            <dt className="t-label shrink-0">en sıcak</dt>
            <dd className="flex flex-wrap gap-1">
              {stats.hottest.map((h) => (
                <span
                  key={h.symbol}
                  title={`${instrumentName(h.symbol)} — hafta boyu etki skoru ${h.score}`}
                  className="rounded-sm border border-[var(--hairline)] px-1.5 py-0.5 text-[0.6875rem] text-[var(--text)]"
                >
                  {h.symbol}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </header>

      <div className="pt-6">
        <WeekView week={week} />
      </div>
    </>
  );
}
