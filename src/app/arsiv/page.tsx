import Link from "next/link";
import { weekIndex } from "@/lib/store";
import CurrentWeekBadge from "@/components/CurrentWeekBadge";

export const metadata = { title: "Arşiv — Sismograf" };

export default function ArchivePage() {
  const weeks = weekIndex();

  return (
    <section className="pt-8 sm:pt-10">
      <p className="t-eyebrow">haftalık arşiv</p>
      <h1 className="t-display mt-1.5 text-[clamp(1.75rem,6vw,3rem)] text-[var(--text)]">
        Geçmiş haftalar
      </h1>
      <p className="mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-[var(--text-dim)]">
        Her hafta kendi dosyasında durur. Yeni hafta eklendiğinde bu liste
        kendiliğinden büyür.
      </p>

      {weeks.length === 0 ? (
        <p className="mt-10 border-t border-[var(--hairline)] py-10 text-[0.875rem] text-[var(--text-dim)]">
          Arşivde hafta yok. <code className="t-num">npm run new-week</code> ile ilk
          haftayı oluştur.
        </p>
      ) : (
        <ul className="mt-8">
          {weeks.map((w) => {
            return (
              <li key={w.id}>
                <Link
                  href={`/hafta/${w.id}`}
                  className="group grid grid-cols-[4.5rem_1fr] items-baseline gap-x-4 border-t border-[var(--hairline)] py-4 transition-colors hover:bg-[var(--bg-surface)]"
                >
                  <span className="t-num text-[0.8125rem] text-[var(--text-faint)]">
                    {w.id.replace("-W", " · ")}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[0.9375rem] font-medium text-[var(--text)]">
                        {w.label}
                      </span>
                      <CurrentWeekBadge start={w.start} end={w.end} />
                      <span className="t-label ml-auto">
                        {w.eventCount} haber
                        <span className="mx-1.5 text-[var(--text-faint)]">/</span>
                        <span style={{ color: "var(--verm)" }}>
                          {w.highImpact} yüksek etki
                        </span>
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
