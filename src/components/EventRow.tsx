import type { NewsEvent } from "@/lib/types";
import { impactColor } from "@/lib/labels";
import { nyTime } from "@/lib/clock";
import { DIRECTION_GLYPH, DIRECTION_TR } from "@/lib/labels";
import { instrumentName } from "@/lib/instruments";

/**
 * Tek haber karti.
 *
 * Hiyerarsi: saat -> baslik -> rakamlar -> pariteler -> yorum.
 * Etki tek bir renkli cizgiyle verilir; kategori ve oynaklik etiketleri
 * karttan cikarildi, okumayi zorlastiriyorlardi.
 */
export default function EventRow({ event }: { event: NewsEvent }) {
  const ny = event.utc ? nyTime(event.utc) : null;
  const shown = event.affected.slice(0, 5);
  const rest = event.affected.length - shown.length;

  const numbers = [
    event.actual && `gerçekleşen ${event.actual}`,
    event.forecast && `beklenti ${event.forecast}`,
    event.previous && `önceki ${event.previous}`,
    event.metric && `${event.metric.label} ${event.metric.value}`,
  ].filter(Boolean) as string[];

  return (
    <article
      id={event.id}
      className="group scroll-mt-32 border-l-[3px] pl-3 transition-colors hover:bg-[var(--bg-surface)] sm:pl-4"
      style={{ borderLeftColor: impactColor(event.impact) }}
    >
      <div className="grid grid-cols-[3.5rem_1fr] gap-x-3 border-t border-[var(--hairline)] py-3 sm:grid-cols-[4rem_1fr] sm:gap-x-4">
        <div className="pt-[0.1rem]">
          <div className="t-num text-[1rem] leading-none text-[var(--text)]">
            {event.time ?? "—"}
          </div>
          <div className="t-num mt-1 text-[0.6875rem] leading-none text-[var(--text-faint)]">
            {ny ? `${ny} NY` : event.time ? "" : "gün içi"}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="min-w-0 flex-1 text-[0.9375rem] font-medium leading-snug text-[var(--text)]">
              {event.title}
            </h3>
            <span className="shrink-0 text-[0.75rem] text-[var(--text-faint)]">
              {event.region}
            </span>
          </div>

          {event.also && event.also.length > 0 && (
            <p className="mt-0.5 text-[0.75rem] leading-snug text-[var(--text-faint)]">
              aynı anda: {event.also.join(" · ")}
            </p>
          )}

          {numbers.length > 0 && (
            <p className="t-num mt-1 text-[0.75rem] text-[var(--text-dim)]">
              {numbers.join("  ·  ")}
            </p>
          )}

          {shown.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {shown.map((a) => (
                <span
                  key={a.symbol}
                  title={`${instrumentName(a.symbol)} — ${DIRECTION_TR[a.direction]}`}
                  className={`t-num text-[0.75rem] ${
                    a.strength === 3 ? "text-[var(--text)]" : "text-[var(--text-dim)]"
                  }`}
                >
                  {a.symbol}
                  <span aria-hidden className="ml-0.5 text-[0.625rem] opacity-60">
                    {DIRECTION_GLYPH[a.direction]}
                  </span>
                </span>
              ))}
              {rest > 0 && (
                <span className="t-num text-[0.75rem] text-[var(--text-faint)]">
                  +{rest}
                </span>
              )}
            </div>
          )}

          {event.ai && (
            <p className="mt-2 border-l border-l-[var(--violet)] pl-2.5 text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
              {event.ai}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
