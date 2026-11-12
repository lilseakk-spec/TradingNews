"use client";

import { useMemo, useState } from "react";
import type { CotEntry, CotReport, CotSide } from "@/lib/cot";
import { instrumentBias, stance } from "@/lib/cot";
import { GROUPS, INSTRUMENTS, instrumentName } from "@/lib/instruments";

/**
 * COT ekrani.
 *
 * Solda takip evrenindeki butun pariteler; CFTC'de karsiligi olmayanlar
 * sonuk ve tiklanamaz. Sagda secilen paritenin pozisyonlanmasi.
 *
 * Yapay zeka yorumu yalnizca izleme listesindeki pariteler icin uretilir
 * — butun pariteleri her hafta yorumlatmak gereksiz maliyet olurdu.
 */

const tr = new Intl.NumberFormat("tr-TR");

function signed(v: number): string {
  return `${v > 0 ? "+" : ""}${tr.format(v)}`;
}

function toneColor(tone: "uzun" | "kisa" | "notr"): string {
  return tone === "uzun"
    ? "var(--sage)"
    : tone === "kisa"
      ? "var(--verm)"
      : "var(--text-dim)";
}

function SideBlock({
  title, side, hint,
}: {
  title: string;
  side: CotSide;
  hint: string;
}) {
  const total = side.long + side.short;
  const longPct = total > 0 ? (side.long / total) * 100 : 50;

  return (
    <div className="border-t border-[var(--hairline)] py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[0.8125rem] font-medium text-[var(--text)]">{title}</h4>
        <span
          className="t-num text-[0.875rem]"
          style={{ color: side.net > 0 ? "var(--sage)" : "var(--verm)" }}
        >
          {signed(side.net)}
        </span>
      </div>
      <p className="mt-0.5 text-[0.6875rem] text-[var(--text-faint)]">{hint}</p>

      <div className="mt-2 flex h-[6px] overflow-hidden rounded-full bg-[var(--hairline)]">
        <div style={{ width: `${longPct}%`, background: "var(--sage)" }} />
        <div style={{ width: `${100 - longPct}%`, background: "var(--verm)" }} />
      </div>

      <dl className="t-num mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.75rem] text-[var(--text-dim)]">
        <div className="flex gap-1.5">
          <dt className="text-[var(--text-faint)]">uzun</dt>
          <dd>{tr.format(side.long)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-[var(--text-faint)]">kısa</dt>
          <dd>{tr.format(side.short)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-[var(--text-faint)]">haftalık</dt>
          <dd style={{ color: side.change > 0 ? "var(--sage)" : "var(--verm)" }}>
            {signed(side.change)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Detail({ entry }: { entry: CotEntry }) {
  const raw = stance(entry);
  const bias = instrumentBias(entry);

  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="t-display text-[1.375rem] text-[var(--text)]">{entry.symbol}</h2>
        <span className="text-[0.8125rem] text-[var(--text-dim)]">
          {instrumentName(entry.symbol)}
        </span>
      </div>
      <p className="mt-0.5 text-[0.6875rem] text-[var(--text-faint)]">{entry.market}</p>

      <div className="mt-3 rounded-sm bg-[var(--bg-raise)] px-3 py-2.5">
        <p className="text-[0.75rem] text-[var(--text-faint)]">
          Büyük spekülatörlerin duruşu
        </p>
        <p className="mt-0.5 text-[0.9375rem] font-medium" style={{ color: toneColor(bias.tone) }}>
          {entry.symbol} için {bias.label}
        </p>
        {entry.inverse && (
          <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--text-dim)]">
            Vadeli işlemde {raw.label}. {entry.inverseNote}.
          </p>
        )}
      </div>

      {entry.index !== null && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[0.75rem] text-[var(--text-faint)]">
              {Math.round(entry.weeks / 52)} yıllık aralıktaki yeri
            </span>
            <span className="t-num text-[0.8125rem] text-[var(--text)]">{entry.index}</span>
          </div>
          <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--hairline)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${entry.index}%`,
                background:
                  entry.index > 85 || entry.index < 15 ? "var(--amber)" : "var(--text-dim)",
              }}
            />
          </div>
          <p className="mt-1 text-[0.6875rem] text-[var(--text-faint)]">
            0 = dönemin en kısa pozisyonu, 100 = en uzunu
            {(entry.index > 85 || entry.index < 15) && " · uç bölgede"}
          </p>
        </div>
      )}

      <div className="mt-4">
        <SideBlock
          title="Büyük spekülatörler"
          side={entry.noncomm}
          hint="Ticari olmayan: fonlar, trend takipçileri"
        />
        <SideBlock
          title="Ticari (hedge eden)"
          side={entry.comm}
          hint="Üretici ve kurumlar; genelde trendin tersinde durur"
        />
        <SideBlock
          title="Küçük yatırımcı"
          side={entry.small}
          hint="Raporlanmayan küçük hesaplar"
        />
      </div>

      <p className="t-num mt-3 text-[0.75rem] text-[var(--text-dim)]">
        <span className="text-[var(--text-faint)]">açık pozisyon</span>{" "}
        {tr.format(entry.openInterest)}{" "}
        <span style={{ color: entry.openInterestChange > 0 ? "var(--sage)" : "var(--verm)" }}>
          {signed(entry.openInterestChange)}
        </span>
      </p>

      {entry.ai ? (
        <section className="mt-4 border-l-2 border-l-[var(--violet)] pl-3">
          <h3 className="text-[0.6875rem]" style={{ color: "var(--violet)" }}>
            Yapay zeka yorumu
          </h3>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
            {entry.ai}
          </p>
        </section>
      ) : (
        <p className="mt-4 text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
          Bu parite yorum listesinde değil. Yorum almak için
          <code className="t-num mx-1">src/data/cot-watch.json</code>
          dosyasına sembolü ekle.
        </p>
      )}
    </div>
  );
}

export default function CotView({ report }: { report: CotReport }) {
  const bySymbol = useMemo(
    () => new Map(report.entries.map((e) => [e.symbol, e])),
    [report.entries],
  );
  const first = report.entries[0]?.symbol ?? "";
  const [selected, setSelected] = useState(first);
  const entry = bySymbol.get(selected) ?? report.entries[0];

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <nav className="space-y-4">
        {GROUPS.map((group) => {
          const list = INSTRUMENTS.filter((i) => i.group === group.id);
          return (
            <div key={group.id}>
              <h3 className="t-label">{group.label}</h3>
              <ul className="mt-1.5 flex flex-wrap gap-1 lg:block lg:space-y-px">
                {list.map((ins) => {
                  const has = bySymbol.has(ins.symbol);
                  const on = selected === ins.symbol;
                  const e = bySymbol.get(ins.symbol);
                  return (
                    <li key={ins.symbol}>
                      <button
                        type="button"
                        disabled={!has}
                        onClick={() => setSelected(ins.symbol)}
                        aria-pressed={on}
                        className={[
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[0.8125rem] transition-colors",
                          !has
                            ? "cursor-not-allowed text-[var(--text-faint)] opacity-50"
                            : on
                              ? "bg-[var(--bg-raise)] text-[var(--text)]"
                              : "text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text)]",
                        ].join(" ")}
                      >
                        <span className="t-num">{ins.symbol}</span>
                        {e?.ai && (
                          <span
                            title="yapay zeka yorumu var"
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: "var(--violet)" }}
                          />
                        )}
                        {!has && (
                          <span className="ml-auto text-[0.625rem]">veri yok</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="mt-6 rounded-sm border border-[var(--hairline)] bg-[var(--bg-surface)] lg:mt-0">
        {entry ? (
          <Detail entry={entry} />
        ) : (
          <p className="px-4 py-8 text-[0.875rem] text-[var(--text-dim)]">
            Henüz COT verisi yok.
          </p>
        )}
      </div>
    </div>
  );
}
