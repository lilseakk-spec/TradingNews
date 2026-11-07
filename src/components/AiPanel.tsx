import type { AiCommentary } from "@/lib/types";
import { REGIME_TR } from "@/lib/labels";
import { instrumentName } from "@/lib/instruments";

const BIAS_GLYPH = { yukari: "▲", asagi: "▼", notr: "●" } as const;

export default function AiPanel({ ai }: { ai: AiCommentary }) {
  const generated = ai.generatedAt?.slice(0, 10) ?? "";

  return (
    <section
      aria-labelledby="ai-yorum"
      className="rounded-sm border border-[var(--hairline)] border-l-2 bg-[var(--bg-surface)] p-4 sm:p-6"
      style={{ borderLeftColor: "var(--violet)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="ai-yorum" className="t-eyebrow" style={{ color: "var(--violet)" }}>
          Yapay zeka hafta yorumu
        </h2>
        <span className="t-label ml-auto">
          {ai.generatedBy}
          {generated ? ` · ${generated}` : ""}
        </span>
      </div>

      <p className="t-display mt-3 max-w-[48ch] text-[1.375rem] text-[var(--text)] sm:text-[1.75rem]">
        {ai.headline}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="t-label">rejim</span>
        <span className="t-num rounded-sm border border-[var(--hairline)] bg-[var(--bg-raise)] px-2 py-1 text-[0.6875rem] uppercase tracking-wider text-[var(--text)]">
          {REGIME_TR[ai.regime.tone]}
        </span>
        <span className="text-[0.8125rem] text-[var(--text-dim)]">{ai.regime.label}</span>
      </div>

      <p className="mt-4 max-w-[70ch] text-[0.9375rem] leading-relaxed text-[var(--text-dim)]">
        {ai.thesis}
      </p>

      {ai.scenarios.length > 0 && (
        <div className="mt-6">
          <h3 className="t-label">Senaryolar</h3>
          <ul className="mt-2 grid gap-px overflow-hidden rounded-sm border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-3">
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
                <p className="t-label mt-2 normal-case tracking-normal">
                  <span className="t-label">tetik</span>{" "}
                  <span className="text-[0.8125rem] normal-case text-[var(--text-dim)]">
                    {s.trigger}
                  </span>
                </p>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
                  {s.reaction}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {ai.watchlist.length > 0 && (
          <div>
            <h3 className="t-label">Haftanın izleme listesi</h3>
            <ul className="mt-2 flex flex-wrap gap-1">
              {ai.watchlist.map((symbol) => (
                <li
                  key={symbol}
                  title={instrumentName(symbol)}
                  className="t-num rounded-sm border border-[var(--hairline)] bg-[var(--bg-raise)] px-2 py-1 text-[0.6875rem] text-[var(--text)]"
                >
                  {symbol}
                </li>
              ))}
            </ul>
          </div>
        )}

        {ai.risks.length > 0 && (
          <div>
            <h3 className="t-label">Tezi bozacak riskler</h3>
            <ul className="mt-2 space-y-1.5">
              {ai.risks.map((r) => (
                <li
                  key={r}
                  className="flex gap-2 text-[0.8125rem] leading-relaxed text-[var(--text-dim)]"
                >
                  <span aria-hidden className="mt-[0.35rem] shrink-0 text-[0.5rem] text-[var(--text-faint)]">
                    ◇
                  </span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
