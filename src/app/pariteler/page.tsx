import { GROUPS, instrumentsByGroup } from "@/lib/instruments";
import { currentWeek, todayISO } from "@/lib/store";
import { volatilityColor } from "@/lib/labels";

export const metadata = { title: "Pariteler — Sismograf" };

export default function PairsPage() {
  const week = currentWeek(todayISO());

  /** Bu hafta her enstrumana degen olay sayisi ve en yuksek oynaklik. */
  const touch = new Map<string, { count: number; peak: number }>();
  for (const day of week?.days ?? []) {
    for (const event of day.events) {
      for (const a of event.affected) {
        const prev = touch.get(a.symbol) ?? { count: 0, peak: 0 };
        touch.set(a.symbol, {
          count: prev.count + 1,
          peak: Math.max(prev.peak, event.volatility),
        });
      }
    }
  }

  return (
    <section className="pt-8 sm:pt-10">
      <p className="t-eyebrow">takip evreni</p>
      <h1 className="t-display mt-1.5 text-[clamp(1.75rem,6vw,3rem)] text-[var(--text)]">
        Pariteler
      </h1>
      <p className="mt-3 max-w-[66ch] text-[0.9375rem] leading-relaxed text-[var(--text-dim)]">
        Haberler bu listedeki enstrümanlara eşlenir. Sağdaki sayı, gösterilen
        haftada o enstrümana değen haber sayısıdır. Listeyi{" "}
        <code className="t-num text-[0.8125rem]">src/lib/instruments.ts</code>{" "}
        dosyasından daraltabilir ya da genişletebilirsin.
      </p>

      <div className="mt-10 space-y-10">
        {GROUPS.map((group) => {
          const list = instrumentsByGroup(group.id);
          return (
            <div key={group.id}>
              <header className="flex items-baseline gap-3 border-b border-[var(--hairline)] pb-2">
                <h2 className="t-display text-[1.125rem] text-[var(--text)]">
                  {group.label}
                </h2>
                <span className="t-label">{group.code}</span>
                <span className="t-label ml-auto">{list.length} enstrüman</span>
              </header>
              <ul className="grid sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
                {list.map((ins) => {
                  const t = touch.get(ins.symbol);
                  return (
                    <li
                      key={ins.symbol}
                      className="flex items-baseline gap-3 border-b border-[var(--hairline)] py-2.5"
                    >
                      <span className="t-num w-[5.5rem] shrink-0 text-[0.8125rem] text-[var(--text)]">
                        {ins.symbol}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-[var(--text-dim)]">
                        {ins.name}
                      </span>
                      {t ? (
                        <span className="t-num flex shrink-0 items-center gap-1.5 text-[0.75rem] text-[var(--text)]">
                          {t.count}
                          <span
                            className="inline-block h-2.5 w-[3px]"
                            style={{ background: volatilityColor(t.peak) }}
                            aria-hidden
                            title={`en yüksek oynaklık ${t.peak}`}
                          />
                        </span>
                      ) : (
                        <span className="t-num shrink-0 text-[0.75rem] text-[var(--text-faint)]">
                          —
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
