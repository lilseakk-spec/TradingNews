"use client";

/**
 * Analiz: haftanin ya da ayin tam dokumu, traderin kendi degerlendirmesi
 * ve disaridan bakan yapay zeka raporu.
 *
 * Rapor uretimi her zaman elle tetiklenir — hem maliyet kullanicinin
 * kontrolunde kalsin hem de "analiz" bir karar ani olsun.
 */

import { useMemo, useState } from "react";
import {
  bucketBy,
  byWeekday,
  disciplineScore,
  mistakeStats,
  money,
  monthIdOf,
  monthLabel,
  net,
  rStats,
  signedMoney,
  signedR,
  todayLocal,
  weekIdOf,
  weekLabel,
} from "@/lib/defter/calc";
import {
  AiError,
  askClaude,
  makeReport,
  monthlyPayload,
  weeklyPayload,
  weekTitle,
} from "@/lib/defter/ai";
import { blankReview } from "@/lib/defter/defaults";
import { useDefter } from "@/lib/defter/store";
import { MARKETS, SESSIONS, modelLabel } from "@/lib/defter/taxonomy";
import type { WeeklyReview } from "@/lib/defter/types";
import { Bars, CostBars, RHistogram } from "./charts";
import { Markdown } from "./Report";
import { Banner, Empty, Field, Meter, Panel, Stat } from "./ui";

type Scope = "hafta" | "ay";

export default function Analiz() {
  const { trades, accounts, flows, notes, playbook, reviews, reports, settings, saveReview, saveReport, removeReport } =
    useDefter();

  const today = todayLocal();
  const [scope, setScope] = useState<Scope>("hafta");
  const [periodId, setPeriodId] = useState<string>(weekIdOf(today));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periods = useMemo(() => {
    const ids = new Set<string>(
      trades.map((trade) => (scope === "hafta" ? weekIdOf(trade.date) : monthIdOf(trade.date))),
    );
    ids.add(scope === "hafta" ? weekIdOf(today) : monthIdOf(today));
    return [...ids].sort((a, b) => b.localeCompare(a));
  }, [trades, scope, today]);

  const current = periods.includes(periodId)
    ? periodId
    : (periods[0] ?? (scope === "hafta" ? weekIdOf(today) : monthIdOf(today)));

  const inPeriod = useMemo(
    () =>
      trades.filter((trade) =>
        scope === "hafta" ? weekIdOf(trade.date) === current : monthIdOf(trade.date) === current,
      ),
    [trades, scope, current],
  );

  const stats = rStats(inPeriod);
  const discipline = disciplineScore(inPeriod, settings);
  const mistakes = mistakeStats(inPeriod);

  const periodReports = useMemo(
    () =>
      [...reports]
        .filter((report) => report.scope === scope && report.refId === current)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reports, scope, current],
  );
  const latest = periodReports[0];

  const label = scope === "hafta" ? weekTitle(current) : monthLabel(current);

  async function analyse() {
    setBusy(true);
    setError(null);
    try {
      const ctx = { accounts, trades, flows, notes, playbook, reviews, settings };
      const prompt =
        scope === "hafta" ? weeklyPayload(ctx, current) : monthlyPayload(ctx, current);
      const result = await askClaude({
        settings,
        prompt,
        maxTokens: scope === "hafta" ? 3000 : 4000,
      });
      await saveReport(
        makeReport(scope, current, label, settings.model, result.text, result.usage),
      );
    } catch (err) {
      setError(err instanceof AiError ? err.message : "Analiz başarısız.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel bodyClass="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {(["hafta", "ay"] as Scope[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`chip ${scope === item ? "chip-on" : ""}`}
                onClick={() => {
                  setScope(item);
                  setPeriodId(item === "hafta" ? weekIdOf(today) : monthIdOf(today));
                }}
              >
                {item === "hafta" ? "Haftalık" : "Aylık"}
              </button>
            ))}
          </div>

          <select
            className="select max-w-[260px]"
            value={current}
            onChange={(event) => setPeriodId(event.target.value)}
          >
            {periods.map((id) => (
              <option key={id} value={id}>
                {scope === "hafta" ? `${weekLabel(id)} (${id})` : monthLabel(id)}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-primary ml-auto"
            disabled={busy || inPeriod.length === 0}
            onClick={analyse}
          >
            {busy ? "Analiz ediliyor…" : latest ? "Yeniden analiz et" : "Yapay zeka analizi"}
          </button>
        </div>

        {!settings.apiKey && (
          <div className="mt-3">
            <Banner tone="warn">
              Analiz için Anthropic API anahtarı gerekir. Ayarlar ekranından gir — anahtar
              yalnızca bu tarayıcıda saklanır, istek doğrudan Anthropic&apos;e gider.
            </Banner>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <Banner tone="error">{error}</Banner>
          </div>
        )}
      </Panel>

      <section className="panel">
        <div className="grid grid-cols-2 gap-5 p-4 sm:grid-cols-6 sm:p-5">
          <Stat label="İşlem" value={stats.count} sub={label} />
          <Stat
            label="Sonuç"
            value={signedR(stats.totalR)}
            tone={stats.totalR > 0 ? "up" : stats.totalR < 0 ? "down" : "neutral"}
            sub={signedMoney(stats.netPnl, settings.baseCurrency)}
          />
          <Stat label="Kazanma" value={`%${Math.round(stats.winRate * 100)}`} sub={`${stats.wins}K / ${stats.losses}Z`} />
          <Stat
            label="Beklenti"
            value={signedR(stats.expectancy)}
            tone={stats.expectancy > 0 ? "up" : stats.expectancy < 0 ? "down" : "neutral"}
          />
          <Stat label="Profit factor" value={stats.profitFactor ?? "—"} />
          <Stat
            label="Disiplin"
            value={`${discipline.total}`}
            tone={discipline.total >= 85 ? "up" : discipline.total >= 60 ? "warn" : "down"}
            sub="100 üzerinden"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-4">
          <Panel
            eyebrow={latest ? `${latest.model} · ${new Date(latest.createdAt).toLocaleString("tr-TR")}` : "henüz yok"}
            title="Dış göz"
            action={
              latest ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    if (confirm("Bu rapor silinsin mi?")) void removeReport(latest.id);
                  }}
                >
                  Sil
                </button>
              ) : undefined
            }
          >
            {latest ? (
              <Markdown text={latest.content} />
            ) : (
              <Empty
                title="Analiz üretilmedi"
                hint={
                  inPeriod.length === 0
                    ? "Bu dönemde işlem yok. Önce kayıt gir."
                    : "Dönem kapandığında analiz et. Rapor övmek için değil, hatayı göstermek için yazılır."
                }
              />
            )}
          </Panel>

          {periodReports.length > 1 && (
            <Panel eyebrow="geçmiş" title="Önceki raporlar" bodyClass="p-0">
              <div className="divide-y divide-[var(--hairline)]">
                {periodReports.slice(1).map((report) => (
                  <details key={report.id} className="px-4 py-3">
                    <summary className="t-label cursor-pointer">
                      {new Date(report.createdAt).toLocaleString("tr-TR")} · {report.model}
                    </summary>
                    <div className="mt-3">
                      <Markdown text={report.content} />
                    </div>
                  </details>
                ))}
              </div>
            </Panel>
          )}

          {scope === "hafta" && <ReviewForm weekId={current} />}
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Disiplin kırılımı">
            <div className="flex flex-col gap-2.5">
              {discipline.components.map((item) => (
                <div key={item.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="t-label">{item.label}</span>
                    <span className="t-num text-[0.6875rem] text-[var(--text-faint)]">
                      {item.score}/{item.max}
                    </span>
                  </div>
                  <Meter
                    ratio={item.score / item.max}
                    level={
                      item.score === item.max ? "tamam" : item.score >= item.max / 2 ? "uyari" : "ihlal"
                    }
                  />
                  <div className="t-eyebrow mt-1 normal-case tracking-[0.08em]">{item.detail}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Hata maliyeti">
            <CostBars data={mistakes} currency={settings.baseCurrency} />
          </Panel>

          <Panel title="Modele göre">
            <Bars
              data={bucketBy(inPeriod, (t) => t.model, modelLabel).map((b) => ({
                id: b.key,
                label: b.label,
                value: b.stats.totalR,
                hint: `${b.stats.count} işlem`,
              }))}
              unit="r"
            />
          </Panel>

          <Panel title="Seansa göre">
            <Bars
              data={bucketBy(
                inPeriod,
                (t) => t.session,
                (key) => SESSIONS.find((s) => s.id === key)?.label ?? key,
              ).map((b) => ({ id: b.key, label: b.label, value: b.stats.totalR }))}
              unit="r"
            />
          </Panel>

          <Panel title="Güne göre">
            <Bars
              data={byWeekday(inPeriod).map((b) => ({
                id: b.key,
                label: b.label,
                value: b.stats.totalR,
              }))}
              unit="r"
            />
          </Panel>

          <Panel title="Piyasaya göre">
            <Bars
              data={bucketBy(
                inPeriod,
                (t) => t.market,
                (key) => MARKETS.find((m) => m.id === key)?.label ?? key,
              ).map((b) => ({ id: b.key, label: b.label, value: b.stats.netPnl }))}
              currency={settings.baseCurrency}
            />
          </Panel>

          <Panel title="R dağılımı">
            <RHistogram values={inPeriod.map((t) => t.rResult)} />
          </Panel>

          <Panel title="Gün gün">
            <Bars
              data={Object.entries(
                inPeriod.reduce<Record<string, number>>((acc, trade) => {
                  acc[trade.date] = (acc[trade.date] ?? 0) + net(trade);
                  return acc;
                }, {}),
              )
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, value]) => ({ id: date, label: date.slice(5), value }))}
              currency={settings.baseCurrency}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ReviewForm({ weekId }: { weekId: string }) {
  const { reviews, saveReview } = useDefter();
  const existing = reviews.find((review) => review.id === weekId);
  const [draft, setDraft] = useState<WeeklyReview>(() => existing ?? blankReview(weekId));
  const [key, setKey] = useState(weekId);
  const [saved, setSaved] = useState(false);

  if (key !== weekId) {
    setKey(weekId);
    setDraft(existing ?? blankReview(weekId));
    setSaved(false);
  }

  const patch = (next: Partial<WeeklyReview>) => {
    setDraft((prev) => ({ ...prev, ...next }));
    setSaved(false);
  };

  return (
    <Panel
      eyebrow="kendi değerlendirmen"
      title="Hafta kapanışı"
      action={
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            await saveReview(draft);
            setSaved(true);
          }}
        >
          {saved ? "Kaydedildi" : "Kaydet"}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="t-eyebrow normal-case tracking-[0.08em]">
          Önce sen yaz, sonra analiz ettir. Yapay zeka senin yazdığını da okur — kendi
          gördüğünle dışarıdan görünen arasındaki fark, asıl ders.
        </p>
        <Field label="İyi gideni">
          <textarea
            className="textarea"
            value={draft.wins}
            onChange={(e) => patch({ wins: e.target.value })}
          />
        </Field>
        <Field label="Hatalar">
          <textarea
            className="textarea"
            value={draft.mistakes}
            onChange={(e) => patch({ mistakes: e.target.value })}
          />
        </Field>
        <Field label="Ders">
          <textarea
            className="textarea"
            value={draft.lesson}
            onChange={(e) => patch({ lesson: e.target.value })}
          />
        </Field>
        <Field label="Gelecek hafta odağı">
          <textarea
            className="textarea"
            value={draft.focus}
            onChange={(e) => patch({ focus: e.target.value })}
          />
        </Field>
        <Field label={`Kendine notun: ${draft.selfGrade}/10`}>
          <input
            type="range"
            min={1}
            max={10}
            value={draft.selfGrade}
            onChange={(e) => patch({ selfGrade: Number(e.target.value) })}
            className="w-full accent-[var(--amber)]"
          />
        </Field>
      </div>
    </Panel>
  );
}
