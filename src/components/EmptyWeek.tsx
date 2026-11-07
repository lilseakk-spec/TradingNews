import { activeWeekRange } from "@/lib/weeks";

export default function EmptyWeek({ today }: { today: string }) {
  const range = activeWeekRange(today);

  return (
    <section className="pt-16">
      <p className="t-eyebrow">henüz veri yok</p>
      <h1 className="t-display mt-2 text-[clamp(1.75rem,6vw,3rem)] text-[var(--text)]">
        Takvim boş
      </h1>
      <p className="mt-4 max-w-[60ch] text-[0.9375rem] leading-relaxed text-[var(--text-dim)]">
        {range.label} haftası için bir veri dosyası yok. Takvimi çek, haftayı
        oluştur, sonra yorumu ekle.
      </p>
      <ol className="mt-6 space-y-3">
        {[
          ["npm run new-week", "Takvimi çeker, haberleri pariteleriyle eşler, hafta dosyasını yazar."],
          ["npm run ai", "Yapay zeka yorumunu üretip aynı dosyaya işler."],
        ].map(([cmd, desc]) => (
          <li key={cmd} className="border-l-2 border-l-[var(--hairline)] pl-4">
            <code className="t-num text-[0.875rem] text-[var(--text)]">{cmd}</code>
            <p className="mt-1 text-[0.8125rem] text-[var(--text-dim)]">{desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
