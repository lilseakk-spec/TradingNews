import type { NewsEvent } from "@/lib/types";
import { DIRECTION_GLYPH, impactColor } from "@/lib/labels";
import { nyTime } from "@/lib/clock";
import { surpriseLabel } from "@/lib/outcomes";

/**
 * Listedeki tek satir — olcum seridinin bir tiki.
 *
 * Sol sutun saat, ortada surekli bir zaman rayi, rayin uzerinde o olayin
 * genligi: tik ne kadar uzunsa beklenen oynaklik o kadar yuksek. Gunun
 * sekli listeyi okumadan, yalnizca tiklere bakarak cikar.
 *
 * Gecmis olaylar soner, sonucu gelenler satirda gelen degeri tasir —
 * "ne oldu" sorusunun cevabi detayi acmadan gorunur.
 */

/**
 * Tik genisligi. Oynaklik 0–100, genislik 12–52 piksel: gunun sekli
 * tiklere bakarak cikacaksa aradaki fark gozle secilebilmeli.
 */
const tickWidth = (volatility: number) => 12 + Math.round((volatility / 100) * 40);

export default function EventRow({
  event,
  selected,
  past = false,
  onSelect,
}: {
  event: NewsEvent;
  selected: boolean;
  /** Zamani gecmis olaylar soner. */
  past?: boolean;
  onSelect: () => void;
}) {
  const ny = event.utc ? nyTime(event.utc) : null;
  const shown = event.affected.slice(0, 3);
  const rest = event.affected.length - shown.length;
  const color = impactColor(event.impact);
  const primary = event.results?.[0];
  const yon = primary ? surpriseLabel(primary) : null;

  return (
    <button
      type="button"
      id={event.id}
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "group relative block w-full scroll-mt-28 cursor-pointer py-2.5 pr-3 pl-0 text-left",
        "transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2",
        "focus-visible:outline-[var(--amber)] sm:pr-4",
        selected ? "bg-[var(--bg-raise)]" : "hover:bg-[var(--bg-surface)]",
      ].join(" ")}
      style={{ opacity: past && !selected ? 0.52 : 1 }}
    >
      <div className="grid grid-cols-[3.25rem_3.5rem_1fr] items-start gap-x-2 sm:grid-cols-[3.75rem_4rem_1fr] sm:gap-x-3">
        {/* Saat */}
        <div className="pl-3 sm:pl-4">
          <div className="t-num text-[0.9375rem] leading-none text-[var(--text)]">
            {event.time ?? "—"}
          </div>
          <div className="t-num mt-1 text-[0.6875rem] leading-none text-[var(--text-faint)]">
            {ny ?? "gün içi"}
          </div>
        </div>

        {/* Zaman rayi ve genlik tiki */}
        <div aria-hidden className="relative h-full">
          <span className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-[var(--hairline)]" />
          <span
            className="absolute top-[6px] left-1/2 h-[2.5px] -translate-x-1/2 rounded-full transition-[width] duration-300"
            style={{
              width: `${tickWidth(event.volatility)}px`,
              background: color,
              opacity: selected ? 1 : 0.82,
            }}
          />
          <span
            className="absolute top-[3px] left-1/2 h-[8px] w-[8px] -translate-x-1/2 rounded-full border-2"
            style={{
              borderColor: color,
              background: selected ? color : "var(--bg)",
            }}
          />
        </div>

        {/* Icerik */}
        <div className="min-w-0 pt-px">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-[var(--text)]">
              {event.title}
            </span>
            {primary ? (
              <span
                className="t-num shrink-0 text-[0.75rem]"
                style={{
                  color:
                    yon === "üstünde"
                      ? "var(--amber)"
                      : yon === "altında"
                        ? "var(--sage)"
                        : "var(--text-dim)",
                }}
                title={`${primary.name}: ${primary.actual}${
                  primary.forecast ? ` (beklenti ${primary.forecast})` : ""
                }`}
              >
                {primary.actual}
              </span>
            ) : (
              <span className="shrink-0 text-[0.6875rem] text-[var(--text-faint)]">
                {event.region}
              </span>
            )}
          </div>

          {shown.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {shown.map((a) => (
                <span key={a.symbol} className="t-num text-[0.6875rem] text-[var(--text-dim)]">
                  {a.symbol}
                  <span aria-hidden className="ml-0.5 opacity-60">
                    {DIRECTION_GLYPH[a.direction]}
                  </span>
                </span>
              ))}
              {rest > 0 && (
                <span className="t-num text-[0.6875rem] text-[var(--text-faint)]">+{rest}</span>
              )}
              {primary && (
                <span className="t-num text-[0.6875rem] text-[var(--text-faint)]">
                  · açıklandı
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
