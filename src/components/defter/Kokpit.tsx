"use client";

/**
 * Kokpit — gune buradan bakilir.
 *
 * Sirasi bilincli: once gercek para, sonra bu haftaki disiplin, sonra
 * egri, en sonda ham kayitlar. Once "ne kadar param var", sonra
 * "kurallarima uydum mu".
 */

import Link from "next/link";
import { useMemo } from "react";
import {
  accountState,
  disciplineScore,
  equityCurve,
  mistakeStats,
  money,
  monthIdOf,
  net,
  rStats,
  signedMoney,
  signedR,
  todayLocal,
  weekIdOf,
  weekQuota,
} from "@/lib/defter/calc";
import { useDefter } from "@/lib/defter/store";
import { MARKETS, modelLabel } from "@/lib/defter/taxonomy";
import { shortDate } from "@/lib/weeks";
import { Bars, CostBars, EquityChart } from "./charts";
import { Empty, Meter, Panel, RBar, Ring, Stat, levelColor } from "./ui";
import { useQuickAdd } from "./Shell";

export interface WeekBrief {
  id: string;
  label: string;
  preliminary: boolean;
  thesis: string;
  events: { id: string; date: string; time: string; title: string; region: string }[];
}

export default function Kokpit({ brief }: { brief: WeekBrief | null }) {
  const { accounts, trades, flows, settings, reports } = useDefter();
  const { openTrade } = useQuickAdd();

  const today = todayLocal();
  const weekId = weekIdOf(today);
  const monthId = monthIdOf(today);

  const live = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);

  const states = useMemo(
    () => live.map((account) => accountState(account, trades, flows, today)),
    [live, trades, flows, today],
  );

  const weekTrades = useMemo(
    () => trades.filter((t) => weekIdOf(t.date) === weekId),
    [trades, weekId],
  );
  const monthTrades = useMemo(
    () => trades.filter((t) => monthIdOf(t.date) === monthId),
    [trades, monthId],
  );

  const equity = states.reduce((total, state) => total + state.balance, 0);
  const startTotal = live.reduce((total, account) => total + account.startBalance, 0);
  const realCash = states.reduce((total, state) => total + state.realCash, 0);
  const weekPnl = weekTrades.reduce((total, trade) => total + net(trade), 0);
  const monthPnl = monthTrades.reduce((total, trade) => total + net(trade), 0);

  const quota = useMemo(() => weekQuota(trades, settings, weekId), [trades, settings, weekId]);
  const discipline = useMemo(
    () => disciplineScore(weekTrades, settings),
    [weekTrades, settings],
  );
  const curve = useMemo(() => equityCurve(live, trades, flows), [live, trades, flows]);
  const mistakes = useMemo(() => mistakeStats(trades).slice(0, 6), [trades]);
  const monthStats = rStats(monthTrades);

  const riskRoom = states
    .map((state) => state.openRiskRoom)
    .filter((value): value is number => value !== null);
  const tightest = riskRoom.length ? Math.min(...riskRoom) : null;

  const recent = useMemo(
    () => [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [trades],
  );

  const lastReport = useMemo(
    () => [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [reports],
  );

  if (accounts.length === 0) {
    return (
      <Panel>
        <Empty
          title="Defter boş"
          hint="Önce bir hesap ekle — challenge, funded ya da kişisel. Kâr/zarar, fon kuralları ve kasa muhasebesi hesabın üstünden işler."
          action={
            <Link href="/defter/hesaplar" className="btn btn-primary">
              Hesap ekle
            </Link>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Para */}
      <section className="panel">
        <div className="grid grid-cols-2 gap-5 p-4 sm:grid-cols-4 sm:p-5">
          <Stat
            label="Toplam özkaynak"
            value={money(equity, settings.baseCurrency)}
            size="lg"
            sub={`${live.length} aktif hesap · başlangıç ${money(startTotal, settings.baseCurrency)}`}
          />
          <Stat
            label="Bu ay"
            value={signedMoney(monthPnl, settings.baseCurrency)}
            size="lg"
            tone={monthPnl > 0 ? "up" : monthPnl < 0 ? "down" : "neutral"}
            sub={`${monthTrades.length} işlem · ${signedR(monthStats.totalR)}`}
          />
          <Stat
            label="Bu hafta"
            value={signedMoney(weekPnl, settings.baseCurrency)}
            size="lg"
            tone={weekPnl > 0 ? "up" : weekPnl < 0 ? "down" : "neutral"}
            sub={`${weekTrades.length} işlem`}
          />
          <Stat
            label="Cebe giren net"
            value={signedMoney(realCash, settings.baseCurrency)}
            size="lg"
            tone={realCash > 0 ? "up" : realCash < 0 ? "down" : "neutral"}
            sub="çekimler eksi ücretler — kâğıt değil, gerçek"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* Disiplin */}
        <Panel
          eyebrow={`hafta ${weekId.split("-W")[1]}`}
          title="Haftalık kota"
          action={
            <button type="button" className="btn" onClick={() => openTrade(null)}>
              Kaydet (Y)
            </button>
          }
        >
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex gap-5">
              {quota.length === 0 ? (
                <p className="t-label">kota tanımlı değil — Ayarlar&apos;dan sınır koy</p>
              ) : (
                quota.map((row) => (
                  <Ring
                    key={row.market}
                    used={row.used}
                    limit={row.limit}
                    label={MARKETS.find((m) => m.id === row.market)?.label ?? row.market}
                  />
                ))
              )}
            </div>

            <div className="min-w-[200px] flex-1">
              <div className="flex items-baseline justify-between">
                <span className="t-label">Disiplin skoru</span>
                <span
                  className="stat-num text-[1.5rem]"
                  style={{
                    color:
                      discipline.total >= 85
                        ? "var(--sage)"
                        : discipline.total >= 60
                          ? "var(--amber)"
                          : "var(--verm)",
                  }}
                >
                  {discipline.total}
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {discipline.components.map((item) => (
                  <div key={item.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="t-eyebrow normal-case tracking-[0.08em]">{item.label}</span>
                      <span className="t-num text-[0.6875rem] text-[var(--text-faint)]">
                        {item.score}/{item.max}
                      </span>
                    </div>
                    <Meter
                      ratio={item.score / item.max}
                      level={
                        item.score === item.max
                          ? "tamam"
                          : item.score >= item.max / 2
                            ? "uyari"
                            : "ihlal"
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* Hesap durumu */}
        <Panel
          title="Hesaplar"
          action={
            <Link href="/defter/hesaplar" className="btn">
              Tümü
            </Link>
          }
          bodyClass="p-0"
        >
          <div className="divide-y divide-[var(--hairline)]">
            {states.map((state) => (
              <Link
                key={state.account.id}
                href="/defter/hesaplar"
                className="edge block px-4 py-3 transition-colors hover:bg-[var(--bg-raise)]"
                style={{ "--edge": state.account.accent } as React.CSSProperties}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[0.875rem] font-medium text-[var(--text)]">
                    {state.account.name}
                  </span>
                  <span className="t-num shrink-0 text-[0.875rem]">
                    {money(state.balance, state.account.currency)}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="t-eyebrow normal-case tracking-[0.08em]">
                    {state.account.firm || state.account.kind} · {state.account.phase}
                  </span>
                  <span
                    className="t-num text-[0.6875rem]"
                    style={{
                      color:
                        state.netPnl > 0
                          ? "var(--sage)"
                          : state.netPnl < 0
                            ? "var(--verm)"
                            : "var(--text-faint)",
                    }}
                  >
                    {signedMoney(state.netPnl, state.account.currency)}
                  </span>
                </div>
                {state.gauges.length > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    {state.gauges.map((gauge) => (
                      <span
                        key={gauge.id}
                        title={`${gauge.label}: ${gauge.value}`}
                        className="h-1 flex-1 rounded-sm"
                        style={{
                          background: `color-mix(in srgb, ${levelColor(gauge.level)} ${
                            30 + Math.min(70, gauge.ratio * 70)
                          }%, var(--bg-raise))`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>

          {tightest !== null && (
            <div className="border-t border-[var(--hairline)] px-4 py-3">
              <span className="t-label">Bugün riske atılabilecek azami</span>
              <div className="stat-num mt-1 text-[1.25rem]" style={{ color: "var(--amber)" }}>
                {money(tightest, settings.baseCurrency)}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Egri */}
      <Panel
        eyebrow="tüm hesaplar"
        title="Özkaynak eğrisi"
        action={
          <span className="t-num text-[0.75rem] text-[var(--text-dim)]">
            {curve.length ? signedMoney(equity - startTotal, settings.baseCurrency) : "—"}
          </span>
        }
      >
        <EquityChart points={curve} currency={settings.baseCurrency} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Son islemler */}
        <Panel
          title="Son işlemler"
          action={
            <Link href="/defter/islemler" className="btn">
              Tümü
            </Link>
          }
          bodyClass="p-0"
        >
          {recent.length === 0 ? (
            <Empty
              title="Henüz işlem yok"
              hint="İlk kaydı gir: Y tuşu ya da üstteki düğme."
            />
          ) : (
            <div className="divide-y divide-[var(--hairline)]">
              {recent.map((trade) => (
                <button
                  key={trade.id}
                  type="button"
                  onClick={() => openTrade(trade)}
                  className="grid w-full grid-cols-[3.5rem_1fr_5rem_4.5rem] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-raise)]"
                >
                  <span className="t-num text-[0.6875rem] text-[var(--text-faint)]">
                    {shortDate(trade.date)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.8125rem] text-[var(--text)]">
                      {trade.symbol || "—"}{" "}
                      <span className="text-[var(--text-faint)]">{modelLabel(trade.model)}</span>
                    </span>
                  </span>
                  <RBar value={trade.rResult} />
                  <span
                    className="t-num text-right text-[0.8125rem]"
                    style={{ color: trade.rResult >= 0 ? "var(--sage)" : "var(--verm)" }}
                  >
                    {signedR(trade.rResult)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {/* Hata maliyeti */}
        <Panel
          eyebrow="tüm zamanlar"
          title="En pahalı alışkanlıklar"
          action={
            <Link href="/defter/analiz" className="btn">
              Analiz
            </Link>
          }
        >
          <CostBars data={mistakes} currency={settings.baseCurrency} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Takvim koprusu */}
        <Panel
          eyebrow={brief ? brief.label : "takvim"}
          title="Bu haftanın risk penceresi"
          action={
            <Link href="/" className="btn">
              Takvim
            </Link>
          }
          bodyClass="p-0"
        >
          {!brief || brief.events.length === 0 ? (
            <Empty title="Yüksek etkili veri yok" hint="Takvimde bu hafta 3. seviye haber görünmüyor." />
          ) : (
            <div className="divide-y divide-[var(--hairline)]">
              {brief.events.map((event) => (
                <div key={event.id} className="flex items-baseline gap-3 px-4 py-2.5">
                  <span className="t-num w-[4.5rem] shrink-0 text-[0.6875rem] text-[var(--text-faint)]">
                    {shortDate(event.date)} {event.time}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-[var(--text)]">
                    {event.title}
                  </span>
                  <span className="t-eyebrow shrink-0">{event.region}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Son AI raporu */}
        <Panel
          eyebrow="yapay zeka"
          title="Son analiz"
          action={
            <Link href="/defter/analiz" className="btn">
              Yeni analiz
            </Link>
          }
        >
          {lastReport ? (
            <div>
              <div className="t-eyebrow mb-2">
                {lastReport.label} · {lastReport.model}
              </div>
              <p className="line-clamp-[8] whitespace-pre-wrap text-[0.875rem] leading-relaxed text-[var(--text-dim)]">
                {lastReport.content.replace(/^#+ /gm, "").slice(0, 620)}
              </p>
            </div>
          ) : (
            <Empty
              title="Henüz analiz yok"
              hint="Hafta kapanınca analize gir: dışarıdan bir göz, hatalarını yüzüne söyler."
            />
          )}
        </Panel>
      </div>

      {/* Aylik ozet */}
      <Panel eyebrow="son aylar" title="Aylık kâr/zarar">
        <MonthBars />
      </Panel>
    </div>
  );
}

function MonthBars() {
  const { trades, settings } = useDefter();
  const rows = useMemo(() => {
    const groups = new Map<string, number>();
    for (const trade of trades) {
      const id = monthIdOf(trade.date);
      groups.set(id, (groups.get(id) ?? 0) + net(trade));
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([id, value]) => ({ id, label: id, value }));
  }, [trades]);

  return <Bars data={rows} currency={settings.baseCurrency} />;
}
