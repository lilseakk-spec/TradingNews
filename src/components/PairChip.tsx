import type { AffectedInstrument } from "@/lib/types";
import { DIRECTION_GLYPH, DIRECTION_TR } from "@/lib/labels";
import { instrumentName } from "@/lib/instruments";

/**
 * Etkilenen parite. Yonu simge tasir, etkinin siddetini yazi agirligi
 * tasir. Renk burada yok: renk rampasi etkiye ayrilmistir.
 */
export default function PairChip({ item }: { item: AffectedInstrument }) {
  const strong = item.strength === 3;
  const faint = item.strength === 1;

  return (
    <span
      title={`${instrumentName(item.symbol)} — ${DIRECTION_TR[item.direction]}${
        item.note ? ` · ${item.note}` : ""
      }`}
      className={[
        "t-num inline-flex items-center gap-1 rounded-sm border px-1.5 py-[3px] text-[0.6875rem] leading-none",
        strong
          ? "border-[var(--hairline)] bg-[var(--bg-raise)] text-[var(--text)]"
          : "border-transparent",
        !strong && !faint ? "text-[var(--text-dim)]" : "",
        faint ? "text-[var(--text-faint)]" : "",
      ].join(" ")}
    >
      <span aria-hidden className="text-[0.5625rem] opacity-70">
        {DIRECTION_GLYPH[item.direction]}
      </span>
      {item.symbol}
    </span>
  );
}
