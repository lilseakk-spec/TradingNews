import { loadUsage } from "@/lib/store";
import { JOB_LABEL, PRICES, summarize } from "@/lib/usage";

export const metadata = { title: "Maliyet — Sismograf" };

const usd = (v: number) => `${v.toFixed(v < 1 ? 3 : 2)} $`;
const tr = new Intl.NumberFormat("tr-TR");

export default function CostPage() {
  const log = loadUsage();
  const s = summarize(log);
  const recent = [...log.entries].reverse().slice(0, 20);

  return (
    <section className="pt-8 sm:pt-10">
      <p className="t-eyebrow">yapay zeka gideri</p>
      <h1 className="t-display mt-1.5 text-[clamp(1.75rem,6vw,3rem)] text-[var(--text)]">
        Maliyet
      </h1>
      <p className="mt-3 max-w-[72ch] text-[0.875rem] leading-relaxed text-[var(--text-dim)]">
        Her çağrıdan sonra gerçek token sayısı kaydedilir; aşağıdaki rakamlar
        tahmin değil ölçümdür. Düşünme tokenleri çıkış olarak faturalanır, bu
        yüzden çıkış sayısı görünen metinden büyüktür.
      </p>

      {s.runs === 0 ? (
        <div className="mt-8 rounded-sm border border-[var(--hairline)] bg-[var(--bg-surface)] p-5">
          <p className="text-[0.875rem] leading-relaxed text-[var(--text-dim)]">
            Henüz kayıt yok — ilk yapay zeka çağrısından sonra burası dolar.
          </p>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--text-faint)]">
            Beklenen: haftada üç çağrı (pazar hafta yorumu, cuma ön izleme,
            cumartesi COT), toplam 0,25–0,46 $. Yılda 13–24 $ bandı.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-px overflow-hidden rounded-sm border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-3">
            {[
              ["Toplam harcanan", usd(s.total), `${s.runs} çağrı`],
              ["Haftalık ortalama", s.perWeek === null ? "—" : usd(s.perWeek), "ölçülen süreye göre"],
              ["Yıllık izdüşüm", s.perYear === null ? "—" : usd(s.perYear), "bu hız sürerse"],
            ].map(([k, v, hint]) => (
              <div key={k} className="bg-[var(--bg-surface)] p-4">
                <p className="text-[0.75rem] text-[var(--text-faint)]">{k}</p>
                <p className="t-num mt-1 text-[1.5rem] text-[var(--text)]">{v}</p>
                <p className="mt-0.5 text-[0.6875rem] text-[var(--text-faint)]">{hint}</p>
              </div>
            ))}
          </div>

          <h2 className="t-label mt-8">İşe göre</h2>
          <ul className="mt-2">
            {s.byJob.map((j) => (
              <li
                key={j.job}
                className="flex items-baseline justify-between gap-3 border-t border-[var(--hairline)] py-2.5"
              >
                <span className="text-[0.875rem] text-[var(--text)]">
                  {JOB_LABEL[j.job] ?? j.job}
                </span>
                <span className="t-num text-[0.8125rem] text-[var(--text-dim)]">
                  {j.runs} çağrı
                  <span className="mx-2 text-[var(--text-faint)]">·</span>
                  <span className="text-[var(--text)]">{usd(j.cost)}</span>
                </span>
              </li>
            ))}
          </ul>

          <h2 className="t-label mt-8">Son çağrılar</h2>
          <ul className="mt-2">
            {recent.map((e) => (
              <li
                key={e.at}
                className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 border-t border-[var(--hairline)] py-2"
              >
                <span className="t-num text-[0.75rem] text-[var(--text-faint)]">
                  {e.at.slice(5, 16).replace("T", " ")}
                </span>
                <span className="min-w-0 truncate text-[0.8125rem] text-[var(--text)]">
                  {JOB_LABEL[e.job] ?? e.job}
                  {e.items ? (
                    <span className="text-[var(--text-faint)]"> · {e.items} kalem</span>
                  ) : null}
                </span>
                <span className="t-num text-[0.75rem] text-[var(--text-dim)]">
                  {tr.format(e.inputTokens)} / {tr.format(e.outputTokens)}
                  <span className="mx-2 text-[var(--text-faint)]">·</span>
                  <span className="text-[var(--text)]">{usd(e.cost)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="t-label mt-8">Fiyat listesi</h2>
      <p className="mt-1.5 text-[0.75rem] text-[var(--text-faint)]">
        dolar / milyon token
      </p>
      <ul className="mt-2">
        {Object.entries(PRICES).map(([model, p]) => (
          <li
            key={model}
            className="flex items-baseline justify-between gap-3 border-t border-[var(--hairline)] py-2"
          >
            <span className="t-num text-[0.8125rem] text-[var(--text-dim)]">{model}</span>
            <span className="t-num text-[0.8125rem] text-[var(--text)]">
              giriş {p.input} · çıkış {p.output}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
