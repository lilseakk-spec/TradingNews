"use client";

/**
 * Fon paneli: her hesabin bakiyesi, kurallari ve kuraldan kalan mesafesi.
 * Altinda kasa defteri — yatirim, cekim, payout ve ucretler.
 */

import { useMemo, useState } from "react";
import {
  accountState,
  money,
  signedMoney,
  todayLocal,
  type AccountState,
} from "@/lib/defter/calc";
import { blankFlow } from "@/lib/defter/defaults";
import { useDefter } from "@/lib/defter/store";
import { FLOW_TYPES, flowLabel, balanceSign, cashSign } from "@/lib/defter/taxonomy";
import type { Account, CashFlow } from "@/lib/defter/types";
import { longDate } from "@/lib/weeks";
import AccountForm from "./AccountForm";
import { Banner, Empty, Field, Meter, Modal, Panel, Stat, levelColor } from "./ui";

export default function Hesaplar() {
  const { accounts, trades, flows, settings, removeFlow } = useDefter();
  const [editing, setEditing] = useState<Account | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [flowFor, setFlowFor] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const today = todayLocal();
  const visible = accounts.filter((a) => showArchived || !a.archived);
  const states = useMemo(
    () => visible.map((account) => accountState(account, trades, flows, today)),
    [visible, trades, flows, today],
  );

  const activeStates = states.filter((s) => !s.account.archived);
  const totalBalance = activeStates.reduce((sum, s) => sum + s.balance, 0);
  const totalPnl = activeStates.reduce((sum, s) => sum + s.netPnl, 0);
  const totalFees = states.reduce((sum, s) => sum + s.feesPaid, 0);
  const totalCash = states.reduce((sum, s) => sum + s.realCash, 0);

  const ledger = useMemo(
    () => [...flows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40),
    [flows],
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="panel">
        <div className="grid grid-cols-2 gap-5 p-4 sm:grid-cols-4 sm:p-5">
          <Stat
            label="Aktif bakiye"
            value={money(totalBalance, settings.baseCurrency)}
            size="lg"
            sub={`${activeStates.length} hesap`}
          />
          <Stat
            label="Net kâr/zarar"
            value={signedMoney(totalPnl, settings.baseCurrency)}
            size="lg"
            tone={totalPnl > 0 ? "up" : totalPnl < 0 ? "down" : "neutral"}
            sub="işlemlerden"
          />
          <Stat
            label="Ödenen ücretler"
            value={money(totalFees, settings.baseCurrency)}
            size="lg"
            tone="warn"
            sub="challenge + yenileme"
          />
          <Stat
            label="Cebe giren net"
            value={signedMoney(totalCash, settings.baseCurrency)}
            size="lg"
            tone={totalCash > 0 ? "up" : totalCash < 0 ? "down" : "neutral"}
            sub="çekim + payout − ücret"
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          + Hesap ekle
        </button>
        <button type="button" className="btn" onClick={() => setShowArchived((prev) => !prev)}>
          {showArchived ? "Arşivi gizle" : "Arşivi göster"}
        </button>
      </div>

      {states.length === 0 ? (
        <Panel>
          <Empty
            title="Hesap yok"
            hint="Challenge, funded ya da kişisel hesaplarını ekle. Kuralları girersen kokpit günlük kalan riskini kendisi hesaplar."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {states.map((state) => (
            <AccountCard
              key={state.account.id}
              state={state}
              onEdit={() => {
                setEditing(state.account);
                setFormOpen(true);
              }}
              onFlow={() => setFlowFor(state.account)}
            />
          ))}
        </div>
      )}

      <Panel
        title="Kasa defteri"
        eyebrow="para giriş çıkışı"
        action={
          <button
            type="button"
            className="btn"
            disabled={accounts.length === 0}
            onClick={() => setFlowFor(accounts[0] ?? null)}
          >
            + Hareket
          </button>
        }
        bodyClass="p-0"
      >
        {ledger.length === 0 ? (
          <Empty
            title="Hareket yok"
            hint="Para yatırdığında, çektiğinde ya da challenge ücreti ödediğinde buraya yaz. Bakiye ve cebe giren para ayrı ayrı hesaplanır."
          />
        ) : (
          <div className="divide-y divide-[var(--hairline)]">
            {ledger.map((flow) => {
              const account = accounts.find((a) => a.id === flow.accountId);
              const balanceEffect = balanceSign(flow.type) * flow.amount;
              const cashEffect = cashSign(flow.type) * flow.amount;
              return (
                <div
                  key={flow.id}
                  className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[8rem_7rem_1fr_auto_auto]"
                >
                  <span className="t-num text-[0.6875rem] text-[var(--text-faint)]">
                    {flow.date}
                  </span>
                  <span className="t-label hidden sm:block">{flowLabel(flow.type)}</span>
                  <span className="min-w-0 truncate text-[0.8125rem] text-[var(--text-dim)]">
                    <span className="text-[var(--text)]">{account?.name ?? "—"}</span>
                    {flow.note ? ` · ${flow.note}` : ""}
                    <span className="sm:hidden"> · {flowLabel(flow.type)}</span>
                  </span>
                  <span className="t-num text-right text-[0.8125rem]">
                    <span
                      style={{
                        color:
                          balanceEffect > 0
                            ? "var(--sage)"
                            : balanceEffect < 0
                              ? "var(--verm)"
                              : "var(--text-faint)",
                      }}
                    >
                      {balanceEffect === 0 ? "—" : signedMoney(balanceEffect, account?.currency)}
                    </span>
                    <span className="block text-[0.625rem] text-[var(--text-faint)]">
                      cep {cashEffect === 0 ? "—" : signedMoney(cashEffect, account?.currency)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="t-label px-1 text-[var(--text-faint)] transition-colors hover:text-[var(--verm)]"
                    onClick={() => {
                      if (confirm("Bu hareket silinsin mi?")) void removeFlow(flow.id);
                    }}
                    aria-label="Hareketi sil"
                  >
                    Sil
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <AccountForm open={formOpen} account={editing} onClose={() => setFormOpen(false)} />
      <FlowForm account={flowFor} onClose={() => setFlowFor(null)} />
    </div>
  );
}

function AccountCard({
  state,
  onEdit,
  onFlow,
}: {
  state: AccountState;
  onEdit: () => void;
  onFlow: () => void;
}) {
  const { account } = state;
  const rules = account.rules;

  return (
    <section
      className="panel edge"
      style={{ "--edge": account.accent } as React.CSSProperties}
    >
      <header className="panel-head">
        <div className="min-w-0">
          <div className="t-eyebrow mb-1 truncate">
            {account.firm || "—"} · {account.kind} · {account.phase}
            {account.archived ? " · arşiv" : ""}
          </div>
          <h3 className="t-display truncate text-[1rem] text-[var(--text)]">{account.name}</h3>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className="btn" onClick={onFlow}>
            Para
          </button>
          <button type="button" className="btn" onClick={onEdit}>
            Düzenle
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4 border-b border-[var(--hairline)] p-4">
        <Stat
          label="Bakiye"
          value={money(state.balance, account.currency)}
          sub={`başlangıç ${money(account.startBalance, account.currency)}`}
        />
        <Stat
          label="Getiri"
          value={`${state.returnPct > 0 ? "+" : ""}%${state.returnPct}`}
          tone={state.returnPct > 0 ? "up" : state.returnPct < 0 ? "down" : "neutral"}
          sub={`${state.trades.length} işlem · ${state.tradingDays} gün`}
        />
        <Stat
          label="Cebe giren"
          value={signedMoney(state.realCash, account.currency)}
          tone={state.realCash > 0 ? "up" : state.realCash < 0 ? "down" : "neutral"}
          sub={`ücret ${money(state.feesPaid, account.currency)}`}
        />
      </div>

      <div className="flex flex-col gap-3 p-4">
        {state.gauges.length === 0 ? (
          <p className="t-label">kural tanımlı değil</p>
        ) : (
          state.gauges.map((gauge) => (
            <div key={gauge.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="t-label" style={{ color: levelColor(gauge.level) }}>
                  {gauge.label}
                </span>
                <span className="t-num text-[0.75rem] text-[var(--text-dim)]">{gauge.value}</span>
              </div>
              <Meter ratio={gauge.ratio} level={gauge.level} />
              <div className="t-eyebrow mt-1 normal-case tracking-[0.08em]">{gauge.detail}</div>
            </div>
          ))
        )}

        <div className="flex flex-wrap gap-1.5 pt-1">
          {rules.profitSplitPct !== null && (
            <span className="chip">kâr payı %{rules.profitSplitPct}</span>
          )}
          {rules.payoutCycleDays !== null && (
            <span className="chip">ödeme {rules.payoutCycleDays} gün</span>
          )}
          <span className="chip">{rules.newsTrading ? "haber serbest" : "haber yasak"}</span>
          <span className="chip">{rules.weekendHold ? "hafta sonu taşınır" : "hafta sonu kapat"}</span>
          {rules.maxLots !== null && <span className="chip">azami {rules.maxLots} lot</span>}
        </div>

        {rules.custom.length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-[var(--hairline)] pt-2.5">
            {rules.custom.map((rule) => (
              <li key={rule} className="text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
                — {rule}
              </li>
            ))}
          </ul>
        )}

        {state.level === "ihlal" && (
          <Banner tone="error">
            Bu hesapta bir kural sınırı aşıldı. Fon tarafı kapatmadan önce sen dur.
          </Banner>
        )}
        {state.level === "uyari" && (
          <Banner tone="warn">Sınıra yaklaştın. Bugün işlem almamak da bir karardır.</Banner>
        )}
      </div>
    </section>
  );
}

function FlowForm({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { accounts, saveFlow } = useDefter();
  const [draft, setDraft] = useState<CashFlow | null>(null);

  const open = account !== null;
  const current = draft ?? (account ? blankFlow(account.id) : null);

  if (!open || !current) return null;

  const target = accounts.find((a) => a.id === current.accountId) ?? account;
  const patch = (next: Partial<CashFlow>) =>
    setDraft({ ...(draft ?? current), ...next } as CashFlow);

  const balanceEffect = balanceSign(current.type) * current.amount;
  const cashEffect = cashSign(current.type) * current.amount;

  return (
    <Modal
      open={open}
      eyebrow="kasa hareketi"
      title="Para giriş / çıkış"
      onClose={() => {
        setDraft(null);
        onClose();
      }}
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDraft(null);
              onClose();
            }}
          >
            Vazgeç
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!current.amount}
            onClick={async () => {
              await saveFlow({ ...current, amount: Math.abs(current.amount) });
              setDraft(null);
              onClose();
            }}
          >
            Kaydet
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hesap">
            <select
              className="select"
              value={current.accountId}
              onChange={(event) => patch({ accountId: event.target.value })}
            >
              {accounts.map((item) => (
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
              value={current.date}
              onChange={(event) => patch({ date: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Tür">
          <select
            className="select"
            value={current.type}
            onChange={(event) => patch({ type: event.target.value as CashFlow["type"] })}
          >
            {FLOW_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} — {item.hint}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`Tutar (${target?.currency ?? "USD"})`}>
          <input
            type="number"
            step="any"
            className="input t-num"
            value={current.amount || ""}
            onChange={(event) => patch({ amount: Number(event.target.value) })}
          />
        </Field>

        <Field label="Not">
          <input
            className="input"
            placeholder="2. payout · %80 pay"
            value={current.note ?? ""}
            onChange={(event) => patch({ note: event.target.value })}
          />
        </Field>

        <div className="border border-[var(--hairline)] px-3 py-2.5">
          <div className="t-label mb-1.5">{longDate(current.date)} sonrası</div>
          <div className="flex gap-6">
            <div>
              <div className="t-eyebrow">hesap bakiyesi</div>
              <div className="t-num text-[0.9375rem]">
                {balanceEffect === 0 ? "değişmez" : signedMoney(balanceEffect, target?.currency)}
              </div>
            </div>
            <div>
              <div className="t-eyebrow">cebe giren</div>
              <div className="t-num text-[0.9375rem]">
                {cashEffect === 0 ? "değişmez" : signedMoney(cashEffect, target?.currency)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
