import type { NewsEvent } from "@/lib/types";
import { DIRECTION_GLYPH, impactColor } from "@/lib/labels";
import { nyTime } from "@/lib/clock";

/**
 * Listedeki tek satir.
 *
 * Yalnizca taramak icin gerekenler: saat, baslik, bolge ve en guclu uc
 * parite. Rakamlar, tum pariteler ve yorum detay panelinde — satirlarin
 * hafif kalmasi icin.
 */
export default function EventRow({
  event,
  selected,
  onSelect,
}: {
  event: NewsEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const ny = event.utc ? nyTime(event.utc) : null;
  const shown = event.affected.slice(0, 3);
  const rest = event.affected.length - shown.length;
  const color = impactColor(event.impact);

  return (
    <button
      type="button"
      id={event.id}
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "block w-full scroll-mt-28 border-l-[3px] border-t border-t-[var(--hairline)] px-3 py-2.5 text-left transition-colors sm:px-4",
        selected ? "bg-[var(--bg-raise)]" : "hover:bg-[var(--bg-surface)]",
      ].join(" ")}
      style={{ borderLeftColor: selected ? color : `color-mix(in srgb, ${color} 45%, transparent)` }}
    >
      <div className="grid grid-cols-[3.25rem_1fr] gap-x-3 sm:grid-cols-[3.75rem_1fr]">
        <div>
          <div className="t-num text-[0.9375rem] leading-none text-[var(--text)]">
            {event.time ?? "—"}
          </div>
          <div className="t-num mt-1 text-[0.6875rem] leading-none text-[var(--text-faint)]">
            {ny ?? "gün içi"}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-[var(--text)]">
              {event.title}
            </span>
            <span className="shrink-0 text-[0.6875rem] text-[var(--text-faint)]">
              {event.region}
            </span>
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
                <span className="t-num text-[0.6875rem] text-[var(--text-faint)]">
                  +{rest}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
