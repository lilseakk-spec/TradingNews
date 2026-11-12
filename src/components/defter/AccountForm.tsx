"use client";

/**
 * Fon hesabi formu. Kurallar elle girilir — her fonun kurali farkli,
 * hazir sablonlar yalnizca baslangic noktasi.
 */

import { useEffect, useState } from "react";
import { blankAccount, DEFAULT_RULES } from "@/lib/defter/defaults";
import { useDefter } from "@/lib/defter/store";
import { ACCENTS, ACCOUNT_KINDS, PHASES } from "@/lib/defter/taxonomy";
import type { Account, AccountRules } from "@/lib/defter/types";
import { Banner, ChipPick, Field, Modal, Toggle } from "./ui";

interface Preset {
  id: string;
  label: string;
  rules: Partial<AccountRules>;
}

const PRESETS: Preset[] = [
  {
    id: "iki-faz",
    label: "2 fazlı klasik",
    rules: {
      dailyLossPct: 5,
      maxDrawdownPct: 10,
      drawdownType: "statik",
      profitTargetPct: 8,
      minTradingDays: 4,
      maxDays: null,
      profitSplitPct: 80,
    },
  },
  {
    id: "tek-faz",
    label: "Tek faz",
    rules: {
      dailyLossPct: 4,
      maxDrawdownPct: 6,
      drawdownType: "trailing",
      profitTargetPct: 9,
      minTradingDays: 5,
      consistencyPct: 40,
      profitSplitPct: 85,
    },
  },
  {
    id: "funded",
    label: "Funded (hedefsiz)",
    rules: {
      dailyLossPct: 5,
      maxDrawdownPct: 10,
      drawdownType: "trailing",
      profitTargetPct: null,
      minTradingDays: null,
      profitSplitPct: 90,
      payoutCycleDays: 14,
    },
  },
];

export default function AccountForm({
  open,
  account,
  onClose,
}: {
  open: boolean;
  account: Account | null;
  onClose: () => void;
}) {
  const { accounts, saveAccount, removeAccount } = useDefter();
  const [draft, setDraft] = useState<Account | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      return;
    }
    setDraft(account ? { ...account, rules: { ...account.rules } } : blankAccount(accounts.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account]);

  if (!open || !draft) return null;

  const patch = (next: Partial<Account>) => setDraft((prev) => (prev ? { ...prev, ...next } : prev));
  const patchRules = (next: Partial<AccountRules>) =>
    setDraft((prev) => (prev ? { ...prev, rules: { ...prev.rules, ...next } } : prev));

  const numberField = (
    label: string,
    key: keyof AccountRules,
    hint?: string,
    step = "any",
  ) => (
    <Field label={label} hint={hint}>
      <input
        type="number"
        step={step}
        className="input t-num"
        value={(draft.rules[key] as number | null) ?? ""}
        placeholder="—"
        onChange={(event) =>
          patchRules({
            [key]: event.target.value === "" ? null : Number(event.target.value),
          } as Partial<AccountRules>)
        }
      />
    </Field>
  );

  return (
    <Modal
      open={open}
      wide
      eyebrow={account ? "hesabı düzenle" : "yeni hesap"}
      title={account ? draft.name || "Hesap" : "Fon hesabı ekle"}
      onClose={onClose}
      footer={
        <>
          {account && (
            <button
              type="button"
              className="btn btn-danger mr-auto"
              onClick={async () => {
                if (
                  confirm(
                    "Hesap, ona bağlı tüm işlem ve para hareketleriyle birlikte silinsin mi? Geri alınamaz.",
                  )
                ) {
                  await removeAccount(account.id);
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
          <button
            type="button"
            className="btn btn-primary"
            disabled={!draft.name.trim()}
            onClick={async () => {
              await saveAccount({ ...draft, name: draft.name.trim() });
              onClose();
            }}
          >
            Kaydet
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Hesap adı">
            <input
              className="input"
              placeholder="FTMO 100K #2"
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </Field>
          <Field label="Fon / broker">
            <input
              className="input"
              placeholder="FTMO"
              value={draft.firm}
              onChange={(event) => patch({ firm: event.target.value })}
            />
          </Field>
          <Field label="Başlangıç bakiyesi">
            <input
              type="number"
              step="any"
              className="input t-num"
              value={draft.startBalance}
              onChange={(event) => patch({ startBalance: Number(event.target.value) })}
            />
          </Field>
          <Field label="Para birimi">
            <select
              className="select"
              value={draft.currency}
              onChange={(event) => patch({ currency: event.target.value })}
            >
              {["USD", "EUR", "TRY", "GBP"].map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hesap tipi">
            <ChipPick
              options={ACCOUNT_KINDS}
              value={draft.kind}
              onChange={(kind) => patch({ kind: kind as Account["kind"] })}
            />
          </Field>
          <Field label="Aşama">
            <ChipPick
              options={PHASES}
              value={draft.phase}
              onChange={(phase) => patch({ phase: phase as Account["phase"] })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Başlangıç tarihi">
            <input
              type="date"
              className="input t-num"
              value={draft.startedAt}
              onChange={(event) => patch({ startedAt: event.target.value })}
            />
          </Field>
          <Field label="Challenge ücreti" hint="cepten çıkan gerçek para">
            <input
              type="number"
              step="any"
              className="input t-num"
              value={draft.fee}
              onChange={(event) => patch({ fee: Number(event.target.value) })}
            />
          </Field>
          <Field label="Renk">
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ACCENTS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Renk ${color}`}
                  onClick={() => patch({ accent: color })}
                  className="h-6 w-6 rounded-sm border transition-transform"
                  style={{
                    background: color,
                    borderColor: draft.accent === color ? "var(--text)" : "transparent",
                    transform: draft.accent === color ? "scale(1.12)" : undefined,
                  }}
                />
              ))}
            </div>
          </Field>
          <Field label="Arşiv">
            <Toggle
              label={draft.archived ? "Arşivde" : "Aktif"}
              checked={draft.archived}
              onChange={(archived) => patch({ archived })}
            />
          </Field>
        </div>

        <div className="border-t border-[var(--hairline)] pt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="t-label">Hazır kural seti</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="chip"
                onClick={() => patchRules({ ...DEFAULT_RULES, ...preset.rules })}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <Banner>
            Kurallar burada <strong>ölçüt</strong> olur: kokpitte günlük kalan risk ve düşüş
            mesafesi bu sayılardan hesaplanır. Fonun kuralını birebir gir.
          </Banner>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {numberField("Günlük zarar %", "dailyLossPct")}
            {numberField("Azami düşüş %", "maxDrawdownPct")}
            <Field label="Düşüş tipi">
              <select
                className="select"
                value={draft.rules.drawdownType}
                onChange={(event) =>
                  patchRules({ drawdownType: event.target.value as AccountRules["drawdownType"] })
                }
              >
                <option value="statik">Statik (başlangıçtan)</option>
                <option value="trailing">Trailing (tepeden)</option>
              </select>
            </Field>
            {numberField("Kâr hedefi %", "profitTargetPct")}
            {numberField("Min işlem günü", "minTradingDays", undefined, "1")}
            {numberField("Süre limiti (gün)", "maxDays", undefined, "1")}
            {numberField("Tutarlılık %", "consistencyPct", "tek günün kârdaki payı")}
            {numberField("Kâr payı %", "profitSplitPct")}
            {numberField("Ödeme döngüsü (gün)", "payoutCycleDays", undefined, "1")}
            {numberField("Azami lot", "maxLots")}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Toggle
              label="Haber anında işleme izin var"
              checked={draft.rules.newsTrading}
              onChange={(newsTrading) => patchRules({ newsTrading })}
            />
            <Toggle
              label="Hafta sonu pozisyon taşınabilir"
              checked={draft.rules.weekendHold}
              onChange={(weekendHold) => patchRules({ weekendHold })}
            />
          </div>

          <Field label="Diğer kurallar" wide>
            <textarea
              className="textarea"
              placeholder="Her satır bir kural. Örn: Kârın %50'si tek işlemden gelemez."
              value={draft.rules.custom.join("\n")}
              onChange={(event) =>
                patchRules({
                  custom: event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
        </div>

        <Field label="Not">
          <textarea
            className="textarea"
            value={draft.notes ?? ""}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}
