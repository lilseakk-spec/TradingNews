import type { AiCommentary } from "@/lib/types";
import { REGIME_TR } from "@/lib/labels";

const BIAS_GLYPH = { yukari: "▲", asagi: "▼", notr: "●" } as const;

/**
 * Haftanin yapay zeka yorumu.
 *
 * Manset, rejim ve tez her zaman acik; senaryolar, izleme listesi ve
 * riskler katlanmis halde durur. Haberlerin onunde dort paragraf metin
 * olmasin diye.
 */
export default function AiPanel({ ai }: { ai: AiCommentary }) {
  const detail =
    ai.scenarios.length > 0 || ai.watchlist.length > 0 || ai.risks.length > 0;

  return (
    <section
      aria-labelledby="ai-yorum"
      className="rounded-sm border border-[var(--hairline)] border-l-[3px] bg-[var(--bg-surface)] p-4 sm:p-5"
      style={{ borderLeftColor: "var(--violet)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="ai-yorum" className="t-label" style={{ color: "var(--violet)" }}>
          Hafta yorumu
        </h2>
        <span className="ml-auto text-[0.6875rem] text-[var(--text-faint)]">
          {ai.generatedBy}
        </span>
      </div>

      <p className="t-display mt-2 max-w-[44ch] text-[1.25rem] text-[var(--text)] sm:text-[1.5rem]">
        {ai.headline}
      </p>

      <p className="mt-2 text-[0.8125rem] text-[var(--text-dim)]">
        <span className="text-[var(--text)]">{REGIME_TR[ai.regime.tone]}</span>
        {" — "}
        {ai.regime.label}
      </p>

      <p className="mt-3 max-w-[72ch] text-[0.875rem] leading-relaxed text-[var(--text-dim)]">
        {ai.thesis}
      </p>

      {detail && (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-[0.75rem] text-[var(--text-faint)] transition-colors hover:text-[var(--text-dim)]">
            <span className="group-open:hidden">senaryolar ve riskler ▾</span>
            <span className="hidden group-open:inline">kapat ▴</span>
          </summary>

          {ai.scenarios.length > 0 && (
            <ul className="mt-3 grid gap-px overflow-hidden rounded-sm border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-3">
              {ai.scenarios.map((s) => (
                <li key={s.name} className="bg-[var(--bg-raise)] p-3">
                  <div className="flex items-baseline gap-2">
                    <span aria-hidden className="text-[0.625rem] text-[var(--text-faint)]">
                      {BIAS_GLYPH[s.bias]}
                    </span>
                    <span className="text-[0.875rem] font-medium text-[var(--text)]">
                      {s.name}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
                    {s.trigger}
                  </p>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-faint)]">
                    {s.reaction}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {ai.watchlist.length > 0 && (
              <div>
                <h3 className="text-[0.75rem] text-[var(--text-faint)]">İzleme listesi</h3>
                <p className="t-num mt-1.5 text-[0.8125rem] text-[var(--text)]">
                  {ai.watchlist.join("  ·  ")}
                </p>
              </div>
            )}
            {ai.risks.length > 0 && (
              <div>
                <h3 className="text-[0.75rem] text-[var(--text-faint)]">
                  Tezi bozacak riskler
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {ai.risks.map((r) => (
                    <li
                      key={r}
                      className="text-[0.8125rem] leading-relaxed text-[var(--text-dim)]"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
