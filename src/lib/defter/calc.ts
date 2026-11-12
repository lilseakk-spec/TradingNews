/**
 * Hesap motoru — kar/zarar, R istatistigi, fon kurali olcumleri,
 * disiplin skoru ve seriler. Saf fonksiyonlar: her yerden cagrilabilir,
 * yapay zeka ozeti de ayni sayilari kullanir.
 */

import { addDays, parseISO, weekRange } from "@/lib/weeks";
import { balanceSign, cashSign, mistakeLabel } from "./taxonomy";
import type { Account, CashFlow, Market, Settings, Trade } from "./types";

export function weekIdOf(dateISO: string): string {
  return weekRange(dateISO).id;
}

export function monthIdOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function net(trade: Trade): number {
  return trade.pnl - (trade.fees ?? 0);
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/* ── R istatistigi ───────────────────────────────────────────────── */

export interface RStats {
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalR: number;
  avgR: number;
  avgWinR: number;
  avgLossR: number;
  expectancy: number;
  profitFactor: number | null;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  bestR: number;
  worstR: number;
  avgTargetR: number;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: number;
}

export const EMPTY_STATS: RStats = {
  count: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  winRate: 0,
  totalR: 0,
  avgR: 0,
  avgWinR: 0,
  avgLossR: 0,
  expectancy: 0,
  profitFactor: null,
  grossProfit: 0,
  grossLoss: 0,
  netPnl: 0,
  bestR: 0,
  worstR: 0,
  avgTargetR: 0,
  maxWinStreak: 0,
  maxLossStreak: 0,
  currentStreak: 0,
};

export function rStats(trades: Trade[]): RStats {
  if (trades.length === 0) return EMPTY_STATS;

  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const wins = ordered.filter((t) => t.rResult > 0.05);
  const losses = ordered.filter((t) => t.rResult < -0.05);
  const breakeven = ordered.length - wins.length - losses.length;

  const grossProfit = sum(ordered.filter((t) => net(t) > 0).map(net));
  const grossLoss = Math.abs(sum(ordered.filter((t) => net(t) < 0).map(net)));

  let maxWin = 0;
  let maxLoss = 0;
  let run = 0;
  for (const trade of ordered) {
    const positive = trade.rResult > 0.05;
    const negative = trade.rResult < -0.05;
    if (positive) run = run > 0 ? run + 1 : 1;
    else if (negative) run = run < 0 ? run - 1 : -1;
    else run = 0;
    maxWin = Math.max(maxWin, run);
    maxLoss = Math.min(maxLoss, run);
  }

  const totalR = sum(ordered.map((t) => t.rResult));
  const avgWinR = wins.length ? sum(wins.map((t) => t.rResult)) / wins.length : 0;
  const avgLossR = losses.length ? sum(losses.map((t) => t.rResult)) / losses.length : 0;
  const winRate = ordered.length ? wins.length / ordered.length : 0;

  return {
    count: ordered.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate,
    totalR: round(totalR),
    avgR: round(totalR / ordered.length),
    avgWinR: round(avgWinR),
    avgLossR: round(avgLossR),
    // Beklenti: her islemden ortalama kac R. Kazanma orani tek basina bir
    // sey soylemez, bu soyler.
    expectancy: round(winRate * avgWinR + (1 - winRate) * avgLossR),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : null,
    grossProfit: round(grossProfit),
    grossLoss: round(grossLoss),
    netPnl: round(sum(ordered.map(net))),
    bestR: round(Math.max(...ordered.map((t) => t.rResult))),
    worstR: round(Math.min(...ordered.map((t) => t.rResult))),
    avgTargetR: round(sum(ordered.map((t) => t.rTarget)) / ordered.length),
    maxWinStreak: maxWin,
    maxLossStreak: Math.abs(maxLoss),
    currentStreak: run,
  };
}

export interface Bucket {
  key: string;
  label: string;
  stats: RStats;
}

export function bucketBy(
  trades: Trade[],
  keyOf: (t: Trade) => string,
  labelOf: (key: string) => string = (k) => k,
): Bucket[] {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = keyOf(trade);
    const list = groups.get(key);
    if (list) list.push(trade);
    else groups.set(key, [trade]);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({ key, label: labelOf(key), stats: rStats(list) }))
    .sort((a, b) => b.stats.totalR - a.stats.totalR);
}

/* ── Hesap durumu ────────────────────────────────────────────────── */

export type RuleLevel = "ihlal" | "uyari" | "tamam";

export interface RuleGauge {
  id: string;
  label: string;
  /** 0–1 arasi doluluk. */
  ratio: number;
  level: RuleLevel;
  value: string;
  detail: string;
}

export interface AccountState {
  account: Account;
  trades: Trade[];
  flows: CashFlow[];
  netPnl: number;
  balance: number;
  returnPct: number;
  peak: number;
  /** Cebe giren eksi cepten cikan — challenge ucreti dahil. */
  realCash: number;
  deposits: number;
  withdrawals: number;
  feesPaid: number;
  todayPnl: number;
  weekPnl: number;
  monthPnl: number;
  tradingDays: number;
  daysElapsed: number;
  /** Kurallara gore bugun riske atilabilecek azami tutar. */
  openRiskRoom: number | null;
  gauges: RuleGauge[];
  level: RuleLevel;
  stats: RStats;
}

function levelOf(ratio: number): RuleLevel {
  if (ratio >= 1) return "ihlal";
  if (ratio >= 0.7) return "uyari";
  return "tamam";
}

function share(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return part / whole;
}

/** Hesabin gun gun bakiye serisi — tepe nokta ve trailing dusus icin. */
export function balanceSeries(
  account: Account,
  trades: Trade[],
  flows: CashFlow[],
): { date: string; balance: number }[] {
  const events = [
    ...trades.map((t) => ({ date: t.date, delta: net(t) })),
    ...flows.map((f) => ({ date: f.date, delta: balanceSign(f.type) * f.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const series: { date: string; balance: number }[] = [
    { date: account.startedAt, balance: account.startBalance },
  ];
  let balance = account.startBalance;
  for (const event of events) {
    balance += event.delta;
    const last = series[series.length - 1];
    if (last.date === event.date) last.balance = balance;
    else series.push({ date: event.date, balance });
  }
  return series;
}

export function accountState(
  account: Account,
  allTrades: Trade[],
  allFlows: CashFlow[],
  today: string,
): AccountState {
  const trades = allTrades.filter((t) => t.accountId === account.id);
  const flows = allFlows.filter((f) => f.accountId === account.id);

  const netPnl = sum(trades.map(net));
  const flowBalance = sum(flows.map((f) => balanceSign(f.type) * f.amount));
  const balance = account.startBalance + netPnl + flowBalance;

  const series = balanceSeries(account, trades, flows);
  const peak = Math.max(account.startBalance, ...series.map((p) => p.balance));

  const realCash = sum(flows.map((f) => cashSign(f.type) * f.amount)) - (account.fee || 0);

  const week = weekRange(today).id;
  const month = monthIdOf(today);
  const todayPnl = sum(trades.filter((t) => t.date === today).map(net));
  const weekPnl = sum(trades.filter((t) => weekIdOf(t.date) === week).map(net));
  const monthPnl = sum(trades.filter((t) => monthIdOf(t.date) === month).map(net));

  const tradingDays = new Set(trades.map((t) => t.date)).size;
  const start = parseISO(account.startedAt);
  const end = parseISO(today);
  const daysElapsed = Math.max(
    0,
    Math.round((Date.UTC(end.y, end.m, end.d) - Date.UTC(start.y, start.m, start.d)) / 86400000),
  );

  const rules = account.rules;
  const gauges: RuleGauge[] = [];
  let openRiskRoom: number | null = null;

  if (rules.dailyLossPct) {
    const limit = (account.startBalance * rules.dailyLossPct) / 100;
    const used = Math.max(0, -todayPnl);
    const ratio = share(used, limit);
    openRiskRoom = Math.max(0, limit - used);
    gauges.push({
      id: "gunluk",
      label: "Günlük zarar",
      ratio,
      level: levelOf(ratio),
      value: `${money(used)} / ${money(limit)}`,
      detail: `bugün kalan risk ${money(Math.max(0, limit - used))}`,
    });
  }

  if (rules.maxDrawdownPct) {
    const reference = rules.drawdownType === "trailing" ? peak : account.startBalance;
    const floor = reference * (1 - rules.maxDrawdownPct / 100);
    const room = balance - floor;
    const limit = reference - floor;
    const ratio = share(limit - room, limit);
    gauges.push({
      id: "dusus",
      label: rules.drawdownType === "trailing" ? "Trailing düşüş" : "Toplam düşüş",
      ratio,
      level: levelOf(ratio),
      value: `${money(Math.max(0, limit - room))} / ${money(limit)}`,
      detail: `taban ${money(floor)} · kalan ${money(Math.max(0, room))}`,
    });
    const ddRoom = Math.max(0, room);
    openRiskRoom = openRiskRoom === null ? ddRoom : Math.min(openRiskRoom, ddRoom);
  }

  if (rules.profitTargetPct) {
    const target = (account.startBalance * rules.profitTargetPct) / 100;
    const gained = balance - account.startBalance;
    const ratio = share(Math.max(0, gained), target);
    gauges.push({
      id: "hedef",
      label: "Kâr hedefi",
      ratio,
      level: "tamam",
      value: `${money(Math.max(0, gained))} / ${money(target)}`,
      detail: ratio >= 1 ? "hedef tamam" : `kalan ${money(Math.max(0, target - gained))}`,
    });
  }

  if (rules.minTradingDays) {
    const ratio = share(tradingDays, rules.minTradingDays);
    gauges.push({
      id: "gun",
      label: "İşlem günü",
      ratio,
      level: "tamam",
      value: `${tradingDays} / ${rules.minTradingDays}`,
      detail:
        tradingDays >= rules.minTradingDays
          ? "şart tamam"
          : `${rules.minTradingDays - tradingDays} gün daha`,
    });
  }

  if (rules.maxDays) {
    const ratio = share(daysElapsed, rules.maxDays);
    gauges.push({
      id: "sure",
      label: "Süre",
      ratio,
      level: levelOf(ratio),
      value: `${daysElapsed} / ${rules.maxDays} gün`,
      detail: `${Math.max(0, rules.maxDays - daysElapsed)} gün kaldı`,
    });
  }

  if (rules.consistencyPct) {
    const byDay = new Map<string, number>();
    for (const trade of trades) {
      byDay.set(trade.date, (byDay.get(trade.date) ?? 0) + net(trade));
    }
    const profits = [...byDay.values()].filter((v) => v > 0);
    const totalProfit = sum(profits);
    const best = profits.length ? Math.max(...profits) : 0;
    const part = totalProfit > 0 ? best / totalProfit : 0;
    const ratio = share(part * 100, rules.consistencyPct);
    gauges.push({
      id: "tutarlilik",
      label: "Tutarlılık",
      ratio,
      level: levelOf(ratio),
      value: `%${Math.round(part * 100)} / %${rules.consistencyPct}`,
      detail: "en kârlı günün toplam kârdaki payı",
    });
  }

  const level: RuleLevel = gauges.some((g) => g.level === "ihlal")
    ? "ihlal"
    : gauges.some((g) => g.level === "uyari")
      ? "uyari"
      : "tamam";

  return {
    account,
    trades,
    flows,
    netPnl: round(netPnl),
    balance: round(balance),
    returnPct: account.startBalance
      ? round(((balance - account.startBalance) / account.startBalance) * 100)
      : 0,
    peak: round(peak),
    realCash: round(realCash),
    deposits: round(sum(flows.filter((f) => f.type === "yatirim").map((f) => f.amount))),
    withdrawals: round(
      sum(flows.filter((f) => f.type === "cekim" || f.type === "payout").map((f) => f.amount)),
    ),
    feesPaid: round(
      (account.fee || 0) +
        sum(flows.filter((f) => f.type === "challenge-ucreti").map((f) => f.amount)) -
        sum(flows.filter((f) => f.type === "ucret-iadesi").map((f) => f.amount)),
    ),
    todayPnl: round(todayPnl),
    weekPnl: round(weekPnl),
    monthPnl: round(monthPnl),
    tradingDays,
    daysElapsed,
    openRiskRoom: openRiskRoom === null ? null : round(openRiskRoom),
    gauges,
    level,
    stats: rStats(trades),
  };
}

/* ── Kota ve disiplin ────────────────────────────────────────────── */

export interface QuotaRow {
  market: Market;
  used: number;
  limit: number;
  over: boolean;
}

export function weekQuota(trades: Trade[], settings: Settings, weekId: string): QuotaRow[] {
  const inWeek = trades.filter((t) => weekIdOf(t.date) === weekId);
  return (Object.keys(settings.weeklyLimits) as Market[])
    .map((market) => {
      const used = inWeek.filter((t) => t.market === market).length;
      const limit = settings.weeklyLimits[market] ?? 0;
      return { market, used, limit, over: limit > 0 ? used > limit : used > 0 };
    })
    .filter((row) => row.limit > 0 || row.used > 0);
}

export interface DisciplineComponent {
  id: string;
  label: string;
  score: number;
  max: number;
  detail: string;
}

export interface Discipline {
  total: number;
  components: DisciplineComponent[];
}

/**
 * Haftalik disiplin skoru. Sonuc degil, davranis olculur: kar eden bir
 * hafta da dusuk skor alabilir — alinmamasi gereken islemle kazanildiysa.
 */
export function disciplineScore(trades: Trade[], settings: Settings): Discipline {
  const components: DisciplineComponent[] = [];
  const count = trades.length;

  const limits = settings.weeklyLimits;
  let overflow = 0;
  let allowed = 0;
  for (const market of Object.keys(limits) as Market[]) {
    const limit = limits[market] ?? 0;
    const used = trades.filter((t) => t.market === market).length;
    allowed += limit;
    overflow += Math.max(0, used - limit);
  }
  components.push({
    id: "kota",
    label: "Kota uyumu",
    score: overflow === 0 ? 30 : Math.max(0, 30 - overflow * 15),
    max: 30,
    detail:
      overflow === 0
        ? `${count}/${allowed} işlem — sınır korundu`
        : `${overflow} işlem kotanın dışında`,
  });

  const unplanned = trades.filter((t) => !t.planned).length;
  components.push({
    id: "plan",
    label: "Plan uyumu",
    score: count === 0 ? 20 : Math.max(0, 20 - unplanned * 10),
    max: 20,
    detail: unplanned === 0 ? "tamamı planlıydı" : `${unplanned} dürtüsel giriş`,
  });

  const lowTarget = trades.filter((t) => t.rTarget < settings.minR).length;
  components.push({
    id: "hedef",
    label: "Hedef disiplini",
    score: count === 0 ? 15 : Math.max(0, 15 - lowTarget * 8),
    max: 15,
    detail:
      lowTarget === 0
        ? `hedefler ${settings.minR}R üstünde`
        : `${lowTarget} işlem ${settings.minR}R altında planlandı`,
  });

  const riskBreaches = trades.filter((t) =>
    t.mistakes.some((m) => m === "asiri-risk" || m === "stop-kaydirma"),
  ).length;
  components.push({
    id: "risk",
    label: "Risk disiplini",
    score: count === 0 ? 15 : Math.max(0, 15 - riskBreaches * 8),
    max: 15,
    detail: riskBreaches === 0 ? "1R korundu, stop oynatılmadı" : `${riskBreaches} risk ihlali`,
  });

  const undocumented = trades.filter((t) => t.imageIds.length === 0).length;
  components.push({
    id: "kayit",
    label: "Kayıt disiplini",
    score: count === 0 ? 10 : Math.max(0, 10 - undocumented * 5),
    max: 10,
    detail: undocumented === 0 ? "her işlemin görseli var" : `${undocumented} işlem görselsiz`,
  });

  const checkAvg =
    count === 0
      ? 1
      : sum(
          trades.map((t) => {
            const values = Object.values(t.checklist);
            return values.filter(Boolean).length / Math.max(1, values.length);
          }),
        ) / count;
  components.push({
    id: "kontrol",
    label: "Kontrol listesi",
    score: Math.round(checkAvg * 10),
    max: 10,
    detail: `ortalama %${Math.round(checkAvg * 100)} dolu`,
  });

  return { total: sum(components.map((c) => c.score)), components };
}

/* ── Hata analizi ────────────────────────────────────────────────── */

export interface MistakeRow {
  id: string;
  label: string;
  count: number;
  rCost: number;
  moneyCost: number;
}

export function mistakeStats(trades: Trade[]): MistakeRow[] {
  const rows = new Map<string, MistakeRow>();
  for (const trade of trades) {
    for (const id of trade.mistakes) {
      const row = rows.get(id) ?? {
        id,
        label: mistakeLabel(id),
        count: 0,
        rCost: 0,
        moneyCost: 0,
      };
      row.count += 1;
      if (trade.rResult < 0) {
        row.rCost += Math.abs(trade.rResult);
        row.moneyCost += Math.abs(net(trade));
      }
      rows.set(id, row);
    }
  }
  return [...rows.values()]
    .map((row) => ({ ...row, rCost: round(row.rCost), moneyCost: round(row.moneyCost) }))
    .sort((a, b) => b.rCost - a.rCost || b.count - a.count);
}

/* ── Seriler ─────────────────────────────────────────────────────── */

export interface EquityPoint {
  date: string;
  equity: number;
  cumR: number;
}

/** Tum hesaplarin birlesik ozkaynak egrisi. */
export function equityCurve(
  accounts: Account[],
  trades: Trade[],
  flows: CashFlow[],
): EquityPoint[] {
  const base = sum(accounts.map((a) => a.startBalance));
  const events = [
    ...trades.map((t) => ({ date: t.date, money: net(t), r: t.rResult })),
    ...flows.map((f) => ({ date: f.date, money: balanceSign(f.type) * f.amount, r: 0 })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (events.length === 0) return [];

  const points: EquityPoint[] = [{ date: events[0].date, equity: base, cumR: 0 }];
  let equity = base;
  let cumR = 0;
  for (const event of events) {
    equity += event.money;
    cumR += event.r;
    const last = points[points.length - 1];
    if (last.date === event.date) {
      last.equity = round(equity);
      last.cumR = round(cumR);
    } else {
      points.push({ date: event.date, equity: round(equity), cumR: round(cumR) });
    }
  }
  return points;
}

export interface PeriodRow {
  id: string;
  label: string;
  trades: number;
  pnl: number;
  totalR: number;
  winRate: number;
}

export function byPeriod(
  trades: Trade[],
  idOf: (iso: string) => string,
  labelOf: (id: string) => string,
): PeriodRow[] {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) {
    const id = idOf(trade.date);
    const list = groups.get(id);
    if (list) list.push(trade);
    else groups.set(id, [trade]);
  }
  return [...groups.entries()]
    .map(([id, list]) => {
      const stats = rStats(list);
      return {
        id,
        label: labelOf(id),
        trades: list.length,
        pnl: stats.netPnl,
        totalR: stats.totalR,
        winRate: stats.winRate,
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

const MONTHS_TR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export function monthLabel(id: string): string {
  const [year, month] = id.split("-").map(Number);
  return `${MONTHS_TR[month - 1]} ${year}`;
}

export function weekLabel(id: string): string {
  const week = Number(id.split("-W")[1]);
  return `${week}. hafta`;
}

/** Haftanin gunlerine gore dagilim — hangi gun para kaybettiriyor. */
export function byWeekday(trades: Trade[]): Bucket[] {
  const names = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  return bucketBy(
    trades,
    (t) => {
      const { y, m, d } = parseISO(t.date);
      return String(new Date(Date.UTC(y, m, d)).getUTCDay());
    },
    (key) => names[Number(key)] ?? key,
  );
}

/* ── Bicimleme ───────────────────────────────────────────────────── */

export function money(value: number, currency = "USD"): string {
  const symbol =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "TRY" ? "₺" : "";
  const abs = Math.abs(value);
  const text = abs.toLocaleString("tr-TR", {
    minimumFractionDigits: abs < 100 && abs !== 0 ? 2 : 0,
    maximumFractionDigits: abs < 100 && abs !== 0 ? 2 : 0,
  });
  return `${value < 0 ? "−" : ""}${symbol}${text}`;
}

export function signedMoney(value: number, currency = "USD"): string {
  if (value === 0) return money(0, currency);
  return `${value > 0 ? "+" : ""}${money(value, currency)}`;
}

export function signedR(value: number): string {
  const text = `${round(value, 2)}`.replace(".", ",");
  return `${value > 0 ? "+" : ""}${text}R`;
}

export function percent(value: number, digits = 0): string {
  return `%${(value * 100).toFixed(digits).replace(".", ",")}`;
}

/** Bugun, kullanicinin kendi saatiyle. */
export function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysAgo(n: number): string {
  return addDays(todayLocal(), -n);
}
