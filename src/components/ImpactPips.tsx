import type { Impact } from "@/lib/types";
import { IMPACT_TR, impactColor } from "@/lib/labels";

/** Etki siddeti: uc kare, dolu olanlar siddeti verir. */
export default function ImpactPips({ impact }: { impact: Impact }) {
  return (
    <span
      className="inline-flex items-center gap-[3px] align-middle"
      style={{ color: impactColor(impact) }}
      title={IMPACT_TR[impact]}
      aria-label={IMPACT_TR[impact]}
    >
      {[1, 2, 3].map((n) => (
        <span key={n} className={`pip${n <= impact ? " pip--on" : ""}`} />
      ))}
    </span>
  );
}
