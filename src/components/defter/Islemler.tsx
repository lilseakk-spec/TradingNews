"use client";

/**
 * Islem defteri: suzgecler, ozet ve satir satir kayit.
 * Her satirdan tek islem incelemesi acilabilir — grafigiyle birlikte.
 */

import { useMemo, useState } from "react";
import {
  money,
  net,
  rStats,
  signedMoney,
  signedR,
  todayLocal,
  weekIdOf,
} from "@/lib/defter/calc";
import { askClaude, makeReport, tradePayload, AiError } from "@/lib/defter/ai";
import { useDefter } from "@/lib/defter/store";
import {
  MARKETS,
  MISTAKES,
  MODELS,
  OUTCOMES,
  mistakeLabel,
  modelLabel,
} from "@/lib/defter/taxonomy";
import type { Trade } from "@/lib/defter/types";
import { addDays, shortDate } from "@/lib/weeks";
import { RHistogram } from "./charts";
import { Markdown } from "./Report";
import { Lightbox, Thumb } from "./media";
import { Banner, Empty, Modal, Panel, RBar, Stat } from "./ui";
import { useQuickAdd } from "./Shell";

type Range = "7" | "30" | "90" | "hepsi";

export default function Islemler() {
  const { accounts, trades, settings } = useDefter();
  const { openTrade } = useQuickAdd();

  const [range, setRange] = useState<Range>("30");
  const [accountId, setAccountId] = useState("hepsi");
  const [market, setMarket] = useState("hepsi");
  const [model, setModel] = useState("hepsi");
  const [outcome, setOutcome] = useState("hepsi");
  const [query, setQuery] = useState("");
  const [critique, setCritique] = useState<Trade | null>(null);

  const filtered = useMemo(() => {
    const from = range === "hepsi" ? "0000-00-00" : addDays(todayLocal(), -Number(range));
    const needle = query.trim().toLocaleLowerCase("tr");
    return trades
      .filter((trade) => trade.date >= from)
      .filter((trade) => accountId === "hepsi" || trade.accountId === accountId)
      .filter((trade) => market === "hepsi" || trade.market === market)
      .filter((trade) => model === "hepsi" || trade.model === model)
      .filter((trade) => outcome === "hepsi" || trade.outcome === outcome)
      .filter((trade) =>
        needle
          ? `${trade.symbol} ${trade.note ?? ""} ${trade.emotion ?? ""}`
              .toLocaleLowerCase("tr")
              .includes(needle)
          : true,
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [trades, range, accountId, market, model, outcome, query]);

  const stats = rStats(filtered);

  return (
    <div className="flex flex-col gap-4">
      <section className="panel">
        <div className="grid grid-cols-2 gap-5 p-4 sm:grid-cols-6 sm:p-5">
          <Stat label="İşlem" value={stats.count} />
          <Stat
            label="Toplam"
            value={signedR(stats.totalR)}
            tone={stats.totalR > 0 ? "up" : stats.totalR < 0 ? "down" : "neutral"}
            sub={signedMoney(stats.netPnl, settings.baseCurrency)}
          />
          <Stat label="Kazanma" value={`%${Math.round(stats.winRate * 100)}`} sub={`${stats.wins}K / ${stats.losses}Z`} />
          <Stat
            label="Beklenti"
            value={signedR(stats.expectancy)}
            tone={stats.expectancy > 0 ? "up" : stats.expectancy < 0 ? "down" : "neutral"}
            sub="işlem başına"
          />
          <Stat label="Profit factor" value={stats.profitFactor ?? "—"} sub={`PF > 1,5 iyi`} />
          <Stat
            label="Üst üste kayıp"
            value={stats.maxLossStreak}
            tone={stats.maxLossStreak >= 3 ? "warn" : "neutral"}
            sub={`en iyi ${signedR(stats.bestR)} · en kötü ${signedR(stats.worstR)}`}
          />
        </div>
      </section>

      <Panel title="Filtre" bodyClass="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <select className="select" value={range} onChange={(e) => setRange(e.target.value as Range)}>
            <option value="7">Son 7 gün</option>
            <option value="30">Son 30 gün</option>
            <option value="90">Son 90 gün</option>
            <option value="hepsi">Tümü</option>
          </select>
          <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="hepsi">Tüm hesaplar</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select className="select" value={market} onChange={(e) => setMarket(e.target.value)}>
            <option value="hepsi">Tüm piyasalar</option>
            {MARKETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="hepsi">Tüm modeller</option>
            {MODELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <select className="select" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="hepsi">Tüm sonuçlar</option>
            {OUTCOMES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Sembol ya da not ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel
          title="Kayıtlar"
          eyebrow={`${filtered.length} işlem`}
          action={
            <button type="button" className="btn" onClick={() => openTrade(null)}>
              + Yeni
            </button>
          }
          bodyClass="p-0"
        >
          {filtered.length === 0 ? (
            <Empty title="Kayıt yok" hint="Filtreyi gevşet ya da ilk işlemini gir." />
          ) : (
            <div className="divide-y divide-[var(--hairline)]">
              {filtered.map((trade) => (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  currency={
                    accounts.find((a) => a.id === trade.accountId)?.currency ??
                    settings.baseCurrency
                  }
                  onOpen={() => openTrade(trade)}
                  onCritique={() => setCritique(trade)}
                />
              ))}
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="R dağılımı" eyebrow="filtrelenmiş küme">
            <RHistogram values={filtered.map((t) => t.rResult)} />
            <p className="t-eyebrow mt-3 normal-case tracking-[0.08em]">
              Sağ taraf solu taşıyor mu? Taşımıyorsa sorun kazanma oranında değil, hedef
              disiplininde.
            </p>
          </Panel>

          <Panel title="Hafta" eyebrow={weekIdOf(todayLocal())}>
            <WeekSummary />
          </Panel>
        </div>
      </div>

      <CritiqueModal trade={critique} onClose={() => setCritique(null)} />
    </div>
  );
}

function TradeRow({
  trade,
  currency,
  onOpen,
  onCritique,
}: {
  trade: Trade;
  currency: string;
  onOpen: () => void;
  onCritique: () => void;
}) {
  const [lightbox, setLightbox] = useState(-1);
  const value = net(trade);

  return (
    <div className="px-4 py-3 transition-colors hover:bg-[var(--bg-raise)]">
      <div className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 sm:grid-cols-[3.75rem_1fr_7rem_6rem_auto]">
        <button type="button" onClick={onOpen} className="text-left">
          <span className="t-num block text-[0.75rem] text-[var(--text)]">
            {shortDate(trade.date)}
          </span>
          <span className="t-num block text-[0.625rem] text-[var(--text-faint)]">
            {trade.time || trade.session}
          </span>
        </button>

        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[0.875rem] font-medium text-[var(--text)]">
              {trade.symbol || "—"}
            </span>
            <span className="t-eyebrow shrink-0">
              {trade.direction === "long" ? "AL" : "SAT"}
            </span>
            <span className="truncate text-[0.75rem] text-[var(--text-faint)]">
              {modelLabel(trade.model)}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {!trade.planned && (
              <span className="chip" style={{ borderColor: "var(--verm)", color: "var(--verm)" }}>
                plan dışı
              </span>
            )}
            {trade.mistakes.slice(0, 3).map((id) => (
              <span key={id} className="chip">
                {mistakeLabel(id)}
              </span>
            ))}
            {trade.mistakes.length > 3 && (
              <span className="t-eyebrow">+{trade.mistakes.length - 3}</span>
            )}
          </span>
        </button>

        <div className="hidden sm:block">
          <RBar value={trade.rResult} />
          <div className="t-eyebrow mt-1 text-center normal-case tracking-[0.08em]">
            hedef {trade.rTarget}R
          </div>
        </div>

        <button type="button" onClick={onOpen} className="text-right">
          <span
            className="t-num block text-[0.9375rem]"
            style={{ color: trade.rResult >= 0 ? "var(--sage)" : "var(--verm)" }}
          >
            {signedR(trade.rResult)}
          </span>
          <span className="t-num block text-[0.6875rem] text-[var(--text-dim)]">
            {money(value, currency)}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          {trade.imageIds.length > 0 && (
            <button
              type="button"
              className="h-9 w-12 shrink-0 overflow-hidden border border-[var(--hairline)]"
              onClick={() => setLightbox(0)}
              aria-label="Görseli aç"
            >
              <Thumb id={trade.imageIds[0]} className="h-full w-full object-cover" />
            </button>
          )}
          <button type="button" className="btn hidden sm:inline-block" onClick={onCritique}>
            AI
          </button>
        </div>
      </div>

      {lightbox >= 0 && (
        <Lightbox
          ids={trade.imageIds}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(-1)}
          caption={`${trade.symbol} · ${trade.date} · ${modelLabel(trade.model)}`}
        />
      )}
    </div>
  );
}

function WeekSummary() {
  const { trades, settings } = useDefter();
  const weekId = weekIdOf(todayLocal());
  const week = trades.filter((t) => weekIdOf(t.date) === weekId);
  const stats = rStats(week);

  if (week.length === 0) {
    return <p className="t-label">bu hafta henüz işlem yok</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {week.map((trade) => (
        <div key={trade.id} className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[0.8125rem] text-[var(--text-dim)]">
            {trade.symbol} · {modelLabel(trade.model)}
          </span>
          <span
            className="t-num shrink-0 text-[0.8125rem]"
            style={{ color: trade.rResult >= 0 ? "var(--sage)" : "var(--verm)" }}
          >
            {signedR(trade.rResult)}
          </span>
        </div>
      ))}
      <div className="flex items-baseline justify-between border-t border-[var(--hairline)] pt-2">
        <span className="t-label">toplam</span>
        <span className="t-num text-[0.9375rem]">
          {signedR(stats.totalR)} · {signedMoney(stats.netPnl, settings.baseCurrency)}
        </span>
      </div>
    </div>
  );
}

function CritiqueModal({ trade, onClose }: { trade: Trade | null; onClose: () => void }) {
  const { accounts, settings, saveReport, reports } = useDefter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  const existing = useMemo(
    () =>
      trade
        ? [...reports]
            .filter((r) => r.scope === "islem" && r.refId === trade.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        : undefined,
    [reports, trade],
  );

  if (!trade) return null;

  async function run() {
    if (!trade) return;
    setBusy(true);
    setError(null);
    try {
      const result = await askClaude({
        settings,
        prompt: tradePayload(trade, accounts),
        imageIds: trade.imageIds,
        maxTokens: 1600,
      });
      setText(result.text);
      await saveReport(
        makeReport(
          "islem",
          trade.id,
          `${trade.symbol || "İşlem"} · ${trade.date}`,
          settings.model,
          result.text,
          result.usage,
        ),
      );
    } catch (err) {
      setError(err instanceof AiError ? err.message : "Analiz başarısız.");
    } finally {
      setBusy(false);
    }
  }

  const shown = text ?? existing?.content ?? null;

  return (
    <Modal
      open
      wide
      eyebrow="tek işlem incelemesi"
      title={`${trade.symbol || "İşlem"} · ${trade.date}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" disabled={busy} onClick={run}>
          {busy ? "İnceleniyor…" : shown ? "Yeniden incele" : "İncele"}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {trade.imageIds.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {trade.imageIds.map((id) => (
              <Thumb
                key={id}
                id={id}
                className="aspect-[4/3] w-full border border-[var(--hairline)] object-cover"
              />
            ))}
          </div>
        )}

        {!settings.apiKey && (
          <Banner tone="warn">
            API anahtarı yok. Ayarlar ekranından kendi Anthropic anahtarını gir — istek
            doğrudan tarayıcından gider, anahtar cihazında kalır.
          </Banner>
        )}

        {error && <Banner tone="error">{error}</Banner>}

        {shown ? (
          <Markdown text={shown} />
        ) : (
          <p className="text-[0.875rem] leading-relaxed text-[var(--text-dim)]">
            Bu işlemi dışarıdan bir göze okut: kurulum gerçekten var mıydı, giriş ve stop
            yerinde miydi, çıkış kararı doğru muydu. Görsel eklediysen grafiği de okur.
          </p>
        )}

        {existing && !text && (
          <p className="t-eyebrow normal-case tracking-[0.08em]">
            önceki inceleme · {new Date(existing.createdAt).toLocaleString("tr-TR")}
          </p>
        )}
      </div>
    </Modal>
  );
}
