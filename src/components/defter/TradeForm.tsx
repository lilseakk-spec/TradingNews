"use client";

/**
 * Islem kaydi formu.
 *
 * Iki seyi zorlar: haftalik kota ve en az 2R hedef. Kota dolmusken islem
 * kaydedilirse kayit silinmez — "kota asimi" olarak isaretlenir. Defterin
 * isi gercegi tutmak, gercegi guzellestirmek degil.
 */

import { useEffect, useMemo, useState } from "react";
import {
  money,
  round,
  signedR,
  weekIdOf,
  weekQuota,
} from "@/lib/defter/calc";
import { blankTrade } from "@/lib/defter/defaults";
import { useDefter } from "@/lib/defter/store";
import {
  BIASES,
  CHECKLIST_ITEMS,
  GRADES,
  MARKETS,
  MISTAKES,
  MODELS,
  OUTCOMES,
  SESSIONS,
} from "@/lib/defter/taxonomy";
import type { Market, Trade } from "@/lib/defter/types";
import { Banner, ChipMulti, ChipPick, Field, Modal, Toggle } from "./ui";
import { ImageDrop } from "./media";

export default function TradeForm({
  open,
  trade,
  onClose,
}: {
  open: boolean;
  trade: Trade | null;
  onClose: () => void;
}) {
  const { accounts, trades, settings, saveTrade, removeTrade } = useDefter();
  const live = accounts.filter((a) => !a.archived);
  const [draft, setDraft] = useState<Trade | null>(null);
  const [showPrices, setShowPrices] = useState(false);

  useEffect(() => {
    // Kapanista taslak temizlenir: form yeniden acildiginda bir kare
    // boyunca onceki kaydin verisi gorunmesin.
    if (!open) {
      setDraft(null);
      return;
    }
    if (trade) {
      setDraft({ ...trade });
      setShowPrices(Boolean(trade.entry || trade.stop || trade.target));
      return;
    }
    const account = live[0];
    if (!account) {
      setDraft(null);
      return;
    }
    const risk = round((account.startBalance * settings.defaultRiskPct) / 100, 2);
    setDraft(blankTrade(account.id, settings, risk));
    setShowPrices(false);
    // live/settings degisimi formu sifirlamasin: yalnizca acilista kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trade]);

  const quota = useMemo(() => {
    if (!draft) return null;
    const weekId = weekIdOf(draft.date);
    const others = trades.filter((t) => t.id !== draft.id);
    const rows = weekQuota(others, settings, weekId);
    const row = rows.find((r) => r.market === draft.market);
    const limit = settings.weeklyLimits[draft.market] ?? 0;
    const used = row?.used ?? 0;
    return { used, limit, full: limit > 0 && used >= limit, weekId };
  }, [draft, trades, settings]);

  const symbols = useMemo(
    () => [...new Set(trades.map((t) => t.symbol).filter(Boolean))].sort(),
    [trades],
  );

  if (!open) return null;

  if (!draft) {
    return (
      <Modal open={open} title="İşlem kaydı" onClose={onClose}>
        <Banner tone="warn">
          Önce bir hesap ekle. İşlem her zaman bir hesaba yazılır — kâr/zarar ve fon
          kuralları onun üstünden hesaplanır.
        </Banner>
      </Modal>
    );
  }

  const patch = (next: Partial<Trade>) => setDraft((prev) => (prev ? { ...prev, ...next } : prev));

  function setR(value: number) {
    patch({ rResult: value, pnl: round(draft!.riskAmount * value, 2) });
  }

  function setPnl(value: number) {
    patch({
      pnl: value,
      rResult: draft!.riskAmount ? round(value / draft!.riskAmount, 2) : 0,
    });
  }

  function setRisk(value: number) {
    patch({ riskAmount: value, pnl: round(value * draft!.rResult, 2) });
  }

  const account = accounts.find((a) => a.id === draft.accountId);
  const currency = account?.currency ?? settings.baseCurrency;
  const lowTarget = draft.rTarget < settings.minR;
  const highTarget = draft.rTarget > settings.maxR;

  async function submit() {
    if (!draft) return;
    const mistakes = [...draft.mistakes];
    if (quota?.full && !mistakes.includes("kota-asimi")) mistakes.push("kota-asimi");
    await saveTrade({ ...draft, mistakes, symbol: draft.symbol.trim().toUpperCase() });
    onClose();
  }

  return (
    <Modal
      open={open}
      wide
      eyebrow={trade ? "kaydı düzenle" : "yeni kayıt"}
      title={trade ? `${trade.symbol || "İşlem"} · ${trade.date}` : "İşlem kaydı"}
      onClose={onClose}
      footer={
        <>
          {trade && (
            <button
              type="button"
              className="btn btn-danger mr-auto"
              onClick={async () => {
                if (confirm("Bu işlem kaydı silinsin mi? Geri alınamaz.")) {
                  await removeTrade(trade.id);
                  onClose();
                }
              }}
            >
              Sil
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            Kaydet
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {quota?.full && (
          <Banner tone="error">
            Bu hafta <strong>{draft.market}</strong> kotan dolu ({quota.used}/{quota.limit}).
            Kaydedersen bu işlem <strong>kota aşımı</strong> olarak işaretlenir ve disiplin
            skorunu düşürür. Kuralı sen koydun.
          </Banner>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Hesap">
            <select
              className="select"
              value={draft.accountId}
              onChange={(event) => patch({ accountId: event.target.value })}
            >
              {live.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tarih">
            <input
              type="date"
              className="input t-num"
              value={draft.date}
              onChange={(event) => patch({ date: event.target.value })}
            />
          </Field>
          <Field label="Saat">
            <input
              type="time"
              className="input t-num"
              value={draft.time ?? ""}
              onChange={(event) => patch({ time: event.target.value })}
            />
          </Field>
          <Field label="Sembol">
            <input
              className="input"
              list="defter-symbols"
              placeholder="NQ, BTCUSD…"
              value={draft.symbol}
              onChange={(event) => patch({ symbol: event.target.value })}
            />
            <datalist id="defter-symbols">
              {symbols.map((symbol) => (
                <option key={symbol} value={symbol} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Piyasa" hint={quota ? `bu hafta ${quota.used}/${quota.limit || "∞"}` : undefined}>
            <ChipPick<Market>
              options={MARKETS}
              value={draft.market}
              onChange={(market) => patch({ market })}
            />
          </Field>
          <Field label="Yön">
            <ChipPick
              options={[
                { id: "long", label: "Alış" },
                { id: "short", label: "Satış" },
              ]}
              value={draft.direction}
              onChange={(direction) => patch({ direction: direction as Trade["direction"] })}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seans">
            <ChipPick
              options={SESSIONS}
              value={draft.session}
              onChange={(session) => patch({ session: session as Trade["session"] })}
            />
          </Field>
          <Field label="HTF yönü">
            <ChipPick
              options={BIASES}
              value={draft.htfBias}
              onChange={(htfBias) => patch({ htfBias: htfBias as Trade["htfBias"] })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Model">
            <select
              className="select"
              value={draft.model}
              onChange={(event) => patch({ model: event.target.value })}
            >
              {MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Giriş TF">
            <input
              className="input t-num"
              value={draft.entryTf}
              onChange={(event) => patch({ entryTf: event.target.value })}
              placeholder="5m"
            />
          </Field>
          <Field label="Sonuç">
            <select
              className="select"
              value={draft.outcome}
              onChange={(event) => patch({ outcome: event.target.value as Trade["outcome"] })}
            >
              {OUTCOMES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="İcra notu" hint="sonuçtan bağımsız">
            <ChipPick
              options={GRADES}
              value={draft.grade}
              onChange={(grade) => patch({ grade: grade as Trade["grade"] })}
            />
          </Field>
        </div>

        <div className="border-t border-[var(--hairline)] pt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={`Risk (1R, ${currency})`}>
              <input
                type="number"
                step="any"
                className="input t-num"
                value={draft.riskAmount}
                onChange={(event) => setRisk(Number(event.target.value))}
              />
            </Field>
            <Field
              label="Planlanan hedef (R)"
              hint={
                lowTarget
                  ? `kuralın ${settings.minR}R`
                  : highTarget
                    ? `kuralın en çok ${settings.maxR}R`
                    : undefined
              }
            >
              <input
                type="number"
                step="0.1"
                className="input t-num"
                style={{
                  borderColor: lowTarget || highTarget ? "var(--amber)" : undefined,
                }}
                value={draft.rTarget}
                onChange={(event) => patch({ rTarget: Number(event.target.value) })}
              />
            </Field>
            <Field label="Sonuç (R)">
              <input
                type="number"
                step="0.01"
                className="input t-num"
                value={draft.rResult}
                onChange={(event) => setR(Number(event.target.value))}
              />
            </Field>
            <Field label={`Kâr / zarar (${currency})`}>
              <input
                type="number"
                step="any"
                className="input t-num"
                value={draft.pnl}
                onChange={(event) => setPnl(Number(event.target.value))}
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="t-num text-[1.125rem]" style={{ color: draft.rResult >= 0 ? "var(--sage)" : "var(--verm)" }}>
              {signedR(draft.rResult)} · {money(draft.pnl - draft.fees, currency)}
            </div>
            <label className="flex items-center gap-2">
              <span className="t-label">Komisyon</span>
              <input
                type="number"
                step="any"
                className="input t-num w-24"
                value={draft.fees}
                onChange={(event) => patch({ fees: Number(event.target.value) })}
              />
            </label>
            <button
              type="button"
              className="btn ml-auto"
              onClick={() => setShowPrices((prev) => !prev)}
            >
              {showPrices ? "Fiyatları gizle" : "Fiyat seviyeleri"}
            </button>
          </div>

          {showPrices && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["entry", "Giriş"],
                  ["stop", "Stop"],
                  ["target", "Hedef"],
                  ["exit", "Çıkış"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    step="any"
                    className="input t-num"
                    value={draft[key] ?? ""}
                    onChange={(event) =>
                      patch({ [key]: event.target.value === "" ? null : Number(event.target.value) })
                    }
                  />
                </Field>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--hairline)] pt-4">
          <span className="t-label block pb-2">Giriş öncesi kontrol</span>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => (
              <Toggle
                key={item.id}
                label={item.label}
                checked={draft.checklist[item.id]}
                onChange={(checked) =>
                  patch({ checklist: { ...draft.checklist, [item.id]: checked } })
                }
              />
            ))}
          </div>
        </div>

        <Field label="Hatalar" hint="dürüst ol — bu etiketler haftalık analizin omurgası">
          <ChipMulti
            options={MISTAKES}
            value={draft.mistakes}
            onChange={(mistakes) => patch({ mistakes })}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Plan dahilindeydi"
            checked={draft.planned}
            onChange={(planned) => patch({ planned })}
          />
          <Field label="Ruh hali">
            <input
              className="input"
              placeholder="sakin · aceleci · kızgın…"
              value={draft.emotion ?? ""}
              onChange={(event) => patch({ emotion: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Not">
          <textarea
            className="textarea"
            placeholder="Ne gördün, neden girdin, ne oldu."
            value={draft.note ?? ""}
            onChange={(event) => patch({ note: event.target.value })}
          />
        </Field>

        <Field label="Görseller">
          <ImageDrop ids={draft.imageIds} onChange={(imageIds) => patch({ imageIds })} />
        </Field>
      </div>
    </Modal>
  );
}
