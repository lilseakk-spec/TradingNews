/**
 * Gunun yapay zeka yorumu.
 *
 * Hafta listesinde sessiz bir satir olarak duruyordu ve gozden
 * kaciyordu. Gun gorunumlerinde o gunun tek konusu bu oldugu icin
 * kendi karti olarak one cikariliyor.
 */
export default function DayNote({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  return (
    <section
      className="mb-3 rounded-sm border border-[var(--hairline)] border-l-[3px] bg-[var(--bg-surface)] px-3.5 py-3"
      style={{ borderLeftColor: "var(--violet)" }}
    >
      <h3 className="t-label" style={{ color: "var(--violet)" }}>
        {label}
      </h3>
      <p className="mt-1.5 max-w-[78ch] text-[0.875rem] leading-relaxed text-[var(--text-dim)]">
        {text}
      </p>
    </section>
  );
}
