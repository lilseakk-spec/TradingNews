import { loadCot } from "@/lib/store";
import { longDate } from "@/lib/weeks";
import CotView from "@/components/CotView";

export const metadata = { title: "COT — Sismograf" };

export default function CotPage() {
  const report = loadCot();

  return (
    <section className="pt-8 sm:pt-10">
      <p className="t-eyebrow">kurumsal pozisyonlanma</p>
      <h1 className="t-display mt-1.5 text-[clamp(1.75rem,6vw,3rem)] text-[var(--text)]">
        COT
      </h1>

      {report ? (
        <>
          <p className="mt-3 max-w-[72ch] text-[0.875rem] leading-relaxed text-[var(--text-dim)]">
            CFTC her cuma 23:30 TRT&apos;de, o haftanın <strong className="font-medium text-[var(--text)]">salı kapanışındaki</strong>{" "}
            pozisyonları yayınlar. Elimizdeki rapor{" "}
            <strong className="font-medium text-[var(--text)]">{longDate(report.date)}</strong>{" "}
            tarihli. Üç günlük gecikme raporun doğasıdır.
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-faint)]">
            {report.source.label}
            {report.aiGeneratedBy ? ` · yorum: ${report.aiGeneratedBy}` : ""}
          </p>

          <div className="mt-8">
            <CotView report={report} />
          </div>
        </>
      ) : (
        <div className="mt-6">
          <p className="max-w-[60ch] text-[0.9375rem] leading-relaxed text-[var(--text-dim)]">
            COT verisi henüz çekilmedi.
          </p>
          <code className="t-num mt-3 block text-[0.875rem] text-[var(--text)]">
            npm run cot
          </code>
        </div>
      )}
    </section>
  );
}
