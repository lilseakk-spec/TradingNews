/** Yeni kayitlarin bos iskeletleri. Form acildiginda buradan baslar. */

import { ACCENTS } from "./taxonomy";
import { newId } from "./db";
import { todayLocal } from "./calc";
import type {
  Account,
  AccountRules,
  CashFlow,
  MarketNote,
  PlaybookItem,
  Settings,
  Trade,
  WeeklyReview,
} from "./types";

export const DEFAULT_RULES: AccountRules = {
  dailyLossPct: 5,
  maxDrawdownPct: 10,
  drawdownType: "statik",
  profitTargetPct: 8,
  minTradingDays: null,
  maxDays: null,
  consistencyPct: null,
  newsTrading: true,
  weekendHold: false,
  maxLots: null,
  profitSplitPct: 80,
  payoutCycleDays: 14,
  custom: [],
};

export function blankAccount(index = 0): Account {
  const now = new Date().toISOString();
  return {
    id: newId("acc"),
    name: "",
    firm: "",
    kind: "challenge",
    phase: "faz-1",
    currency: "USD",
    startBalance: 100000,
    fee: 0,
    rules: { ...DEFAULT_RULES, custom: [] },
    startedAt: todayLocal(),
    closedAt: null,
    archived: false,
    accent: ACCENTS[index % ACCENTS.length],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function blankTrade(accountId: string, settings: Settings, riskAmount: number): Trade {
  const now = new Date().toISOString();
  return {
    id: newId("trd"),
    accountId,
    date: todayLocal(),
    time: "",
    market: "endeks",
    symbol: "",
    direction: "long",
    session: "ny-am",
    model: "mmxm",
    htfBias: "notr",
    entryTf: "5m",
    riskAmount,
    rTarget: settings.minR,
    rResult: 0,
    pnl: 0,
    fees: 0,
    outcome: "tp",
    grade: "A",
    entry: null,
    stop: null,
    target: null,
    exit: null,
    checklist: {
      htfBias: false,
      liquidity: false,
      poi: false,
      confirmation: false,
      riskOk: false,
      rrOk: false,
      newsChecked: false,
    },
    mistakes: [],
    emotion: "",
    planned: true,
    imageIds: [],
    note: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function blankFlow(accountId: string): CashFlow {
  return {
    id: newId("flw"),
    accountId,
    date: todayLocal(),
    type: "cekim",
    amount: 0,
    note: "",
    createdAt: new Date().toISOString(),
  };
}

export function blankNote(): MarketNote {
  const now = new Date().toISOString();
  return {
    id: newId("not"),
    date: todayLocal(),
    kind: "reversal",
    title: "",
    body: "",
    symbol: "",
    timeframe: "",
    tags: [],
    imageIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function blankPlaybook(): PlaybookItem {
  const now = new Date().toISOString();
  return {
    id: newId("pbk"),
    date: todayLocal(),
    model: "fvg",
    symbol: "",
    timeframe: "15m",
    title: "",
    context: "",
    criteria: [],
    quality: 3,
    outcome: "izlendi",
    tookTrade: false,
    tradeId: null,
    tags: [],
    imageIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function blankReview(weekId: string): WeeklyReview {
  const now = new Date().toISOString();
  return {
    id: weekId,
    wins: "",
    mistakes: "",
    lesson: "",
    focus: "",
    selfGrade: 5,
    createdAt: now,
    updatedAt: now,
  };
}
