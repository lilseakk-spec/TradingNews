import type { NewsEvent } from "@/lib/types";
import { volatilityLabel } from "@/lib/types";
import { CATEGORY_TR, impactColor } from "@/lib/labels";
import ImpactPips from "./ImpactPips";
import PairChip from "./PairChip";

export default function EventRow({ event }: { event: NewsEvent }) {
  return (
    <article
      id={event.id}
      className="scroll-mt-28 border-l-2 border-t border-t-[var(--hairline)] pl-3 transition-colors hover:bg-[var(--bg-surface)] sm:pl-4"
      style={{ borderLeftColor: impactColor(event.impact) }}
    >
      <div className="grid grid-cols-[3.25rem_1fr] gap-x-3 py-3.5 sm:grid-cols-[4.25rem_1fr] sm:gap-x-5">
        <div className="flex flex-col gap-1.5">
          <time className="t-num text-[0.9375rem] leading-none text-[var(--text)]">
            {event.time ?? "—"}
          </time>
          <ImpactPips impact={event.impact} />
          {!event.time && <span className="t-eyebrow leading-none">gün içi</span>}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-[0.9375rem] font-medium leading-snug text-[var(--text)]">
              {event.title}
            </h3>
            <span className="t-label">
              {event.region}
              {event.currency ? ` · ${event.currency}` : ""}
            </span>
            <span className="t-label ml-auto shrink-0">
              {CATEGORY_TR[event.category]}
              <span className="mx-1.5 text-[var(--text-faint)]">/</span>
              <span style={{ color: impactColor(event.impact) }}>
                {volatilityLabel(event.volatility)} oynaklık
              </span>
            </span>
          </div>

          {event.also && event.also.length > 0 && (
            <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
              <span className="t-label">aynı anda</span> {event.also.join(" · ")}
            </p>
          )}

          {(event.forecast || event.previous || event.actual) && (
            <dl className="t-num mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[0.75rem] text-[var(--text-dim)]">
              {event.actual && (
                <div className="flex items-baseline gap-1.5">
                  <dt className="t-label">gerçekleşen</dt>
                  <dd className="font-medium text-[var(--text)]">{event.actual}</dd>
                </div>
              )}
              {event.forecast && (
                <div className="flex items-baseline gap-1.5">
                  <dt className="t-label">beklenti</dt>
                  <dd>{event.forecast}</dd>
                </div>
              )}
              {event.previous && (
                <div className="flex items-baseline gap-1.5">
                  <dt className="t-label">önceki</dt>
                  <dd>{event.previous}</dd>
                </div>
              )}
            </dl>
          )}

          {event.affected.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="t-label mr-1">etkiler</span>
              {event.affected.map((a) => (
                <PairChip key={a.symbol} item={a} />
              ))}
            </div>
          )}

          {event.ai && (
            <p className="mt-2.5 flex gap-2 text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
              <span
                aria-hidden
                className="mt-[0.2rem] shrink-0 text-[0.625rem]"
                style={{ color: "var(--violet)" }}
              >
                ⟡
              </span>
              <span>{event.ai}</span>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
