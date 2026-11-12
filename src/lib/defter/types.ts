/**
 * Defter — trade gunlugu, fon hesaplari ve kasa muhasebesi veri modeli.
 *
 * Butun veri tarayicida (IndexedDB) durur. Sunucu yok: uygulama statik
 * olarak yayinlanir, kayitlar kullanicinin cihazindan cikmaz. Tek istisna
 * yapay zeka analizi — o da yalnizca kullanicinin kendi anahtariyla ve
 * yalnizca istendiginde Anthropic'e gider.
 */

export type Market = "endeks" | "kripto" | "forex" | "emtia";
export type Direction = "long" | "short";
export type SessionName = "asya" | "londra" | "ny-am" | "ny-pm";
export type Outcome = "tp" | "sl" | "be" | "kismi" | "manuel";
export type Grade = "A" | "B" | "C" | "D";
export type Bias = "boga" | "ayi" | "notr";

export type AccountKind = "challenge" | "funded" | "kisisel";
export type Phase = "faz-1" | "faz-2" | "funded" | "beklemede" | "yandi" | "kapandi";
export type DrawdownType = "statik" | "trailing";

/** Kasa hareketi turleri. Bakiye ve "cebe giren" ayri ayri hesaplanir. */
export type FlowType =
  | "yatirim"
  | "cekim"
  | "payout"
  | "challenge-ucreti"
  | "ucret-iadesi"
  | "bonus";

export interface AccountRules {
  /** Gunluk azami zarar, baslangic bakiyesinin yuzdesi. */
  dailyLossPct: number | null;
  /** Azami toplam dusus yuzdesi. */
  maxDrawdownPct: number | null;
  /** Statik: baslangictan. Trailing: en yuksek bakiyeden. */
  drawdownType: DrawdownType;
  /** Kar hedefi yuzdesi (challenge fazlari icin). */
  profitTargetPct: number | null;
  minTradingDays: number | null;
  /** Sureli challenge ise gun limiti. */
  maxDays: number | null;
  /** Tutarlilik kurali: tek gunun toplam kardaki azami payi. */
  consistencyPct: number | null;
  /** Haber aninda islem serbest mi. */
  newsTrading: boolean;
  /** Hafta sonu pozisyon tasinabilir mi. */
  weekendHold: boolean;
  maxLots: number | null;
  /** Funded hesapta trader payi. */
  profitSplitPct: number | null;
  payoutCycleDays: number | null;
  /** Fona ozgu, serbest yazilan diger kurallar. */
  custom: string[];
}

export interface Account {
  id: string;
  name: string;
  /** Fon saglayicisi: FTMO, Funding Pips, Topstep... */
  firm: string;
  kind: AccountKind;
  phase: Phase;
  currency: string;
  startBalance: number;
  /** Challenge ucreti — gercek nakit cikisi. */
  fee: number;
  rules: AccountRules;
  startedAt: string;
  closedAt?: string | null;
  archived: boolean;
  /** Kart vurgusu. */
  accent: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradeChecklist {
  htfBias: boolean;
  liquidity: boolean;
  poi: boolean;
  confirmation: boolean;
  riskOk: boolean;
  rrOk: boolean;
  newsChecked: boolean;
}

export interface Trade {
  id: string;
  accountId: string;
  /** ISO gun, YYYY-MM-DD. */
  date: string;
  time?: string;
  market: Market;
  symbol: string;
  direction: Direction;
  session: SessionName;
  /** Playbook modeli — taxonomy.ts icindeki kimlik. */
  model: string;
  htfBias: Bias;
  entryTf: string;
  /** Risk edilen para (1R). */
  riskAmount: number;
  /** Planlanan hedef, R cinsinden. */
  rTarget: number;
  /** Sonuc, R cinsinden. */
  rResult: number;
  /** Para cinsinden sonuc (komisyon dahil degil). */
  pnl: number;
  fees: number;
  outcome: Outcome;
  /** Uygulama notu — sonuctan bagimsiz. */
  grade: Grade;
  entry?: number | null;
  stop?: number | null;
  target?: number | null;
  exit?: number | null;
  checklist: TradeChecklist;
  mistakes: string[];
  emotion?: string;
  /** Haftalik plan icinde miydi — kota disi islemler burada yakalanir. */
  planned: boolean;
  imageIds: string[];
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashFlow {
  id: string;
  accountId: string;
  date: string;
  type: FlowType;
  amount: number;
  note?: string;
  createdAt: string;
}

export type NoteKind = "reversal" | "gozlem" | "ders" | "tez" | "hata";

export interface MarketNote {
  id: string;
  date: string;
  kind: NoteKind;
  title: string;
  body: string;
  symbol?: string;
  timeframe?: string;
  tags: string[];
  imageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type SetupOutcome = "calisti" | "calismadi" | "izlendi";

/** Gorsel playbook kaydi — islem alinsa da alinmasa da ornek biriktirir. */
export interface PlaybookItem {
  id: string;
  date: string;
  model: string;
  symbol: string;
  timeframe: string;
  title: string;
  context: string;
  criteria: string[];
  /** 1-5 arasi ornek kalitesi. */
  quality: number;
  outcome: SetupOutcome;
  tookTrade: boolean;
  tradeId?: string | null;
  tags: string[];
  imageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReview {
  /** Kimlik hafta kimligidir: 2026-W46. */
  id: string;
  wins: string;
  mistakes: string;
  lesson: string;
  focus: string;
  selfGrade: number;
  createdAt: string;
  updatedAt: string;
}

export type ReportScope = "hafta" | "ay" | "islem";

export interface AiReport {
  id: string;
  scope: ReportScope;
  /** Hafta kimligi, ay kimligi (2026-11) ya da islem kimligi. */
  refId: string;
  label: string;
  model: string;
  content: string;
  createdAt: string;
  usage?: { input: number; output: number };
}

export interface StoredImage {
  id: string;
  blob: Blob;
  type: string;
  name: string;
  createdAt: string;
}

export interface Settings {
  id: "settings";
  traderName: string;
  apiKey: string;
  model: string;
  /** Haftalik islem kotasi — piyasa basina. */
  weeklyLimits: Record<Market, number>;
  /** Hesap bakiyesinin yuzdesi olarak varsayilan risk. */
  defaultRiskPct: number;
  minR: number;
  maxR: number;
  baseCurrency: string;
  /** Yapay zekanin tonu. */
  tone: "sert" | "dengeli";
  updatedAt: string;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  traderName: "",
  apiKey: "",
  model: "claude-opus-5-5",
  weeklyLimits: { endeks: 1, kripto: 1, forex: 0, emtia: 0 },
  defaultRiskPct: 1,
  minR: 2,
  maxR: 3,
  baseCurrency: "USD",
  tone: "sert",
  updatedAt: "",
};

export interface DefterData {
  accounts: Account[];
  trades: Trade[];
  flows: CashFlow[];
  notes: MarketNote[];
  playbook: PlaybookItem[];
  reviews: WeeklyReview[];
  reports: AiReport[];
  settings: Settings;
}
