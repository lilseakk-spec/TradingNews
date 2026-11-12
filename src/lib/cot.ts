/**
 * COT (Commitments of Traders) — kurumsal pozisyonlanma.
 *
 * Kaynak: CFTC'nin kendi acik veri ucu (publicreporting.cftc.gov).
 * Ucretsiz, anahtarsiz. Klasik "Legacy, futures only" raporu: ticari
 * olmayan (buyuk spekulatorler), ticari (hedge eden kurumlar) ve
 * kucuk yatirimci pozisyonlari.
 *
 * Rapor her sali kapanisindaki pozisyonu gosterir ve cuma 15:30 ET'de
 * (23:30 TRT) yayinlanir. Yani veri yayinlandiginda uc gun eskidir —
 * bu COT'un dogasi, gecikme degil.
 *
 * Ters okuma: CFTC vadeli islemleri yabanci para birimi uzerinden
 * raporlar. Yen vadelilerinde net uzun olmak USDJPY'nin dusmesi
 * demektir; tahvil vadelilerinde net uzun olmak faizin dusmesi
 * demektir. Bu enstrumanlar "inverse" isaretlidir.
 */

export const CFTC_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

export interface CotMarket {
  symbol: string;
  /** CFTC'deki tam piyasa adi. */
  market: string;
  /**
   * true ise vadeli islemdeki net uzun, enstrumanin DUSMESI anlamina
   * gelir (yen, frank, kanada dolari vadelileri; tahvil -> faiz).
   */
  inverse: boolean;
  /** Ters okumanin nedeni; ekranda gosterilir. */
  inverseNote?: string;
}

/** Takip evrenimizden CFTC'de karsiligi olanlar. */
export const COT_MARKETS: CotMarket[] = [
  // Forex
  { symbol: "EURUSD", market: "EURO FX - CHICAGO MERCANTILE EXCHANGE", inverse: false },
  {
    symbol: "USDJPY",
    market: "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE",
    inverse: true,
    inverseNote: "Yen vadelisinde net uzun = USDJPY aşağı",
  },
  { symbol: "GBPUSD", market: "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE", inverse: false },
  {
    symbol: "USDCHF",
    market: "SWISS FRANC - CHICAGO MERCANTILE EXCHANGE",
    inverse: true,
    inverseNote: "Frank vadelisinde net uzun = USDCHF aşağı",
  },
  { symbol: "AUDUSD", market: "AUSTRALIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE", inverse: false },
  { symbol: "NZDUSD", market: "NZ DOLLAR - CHICAGO MERCANTILE EXCHANGE", inverse: false },
  {
    symbol: "USDCAD",
    market: "CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",
    inverse: true,
    inverseNote: "Kanada doları vadelisinde net uzun = USDCAD aşağı",
  },
  { symbol: "DXY", market: "USD INDEX - ICE FUTURES U.S.", inverse: false },
  { symbol: "EURJPY", market: "EURO FX/JAPANESE YEN XRATE - CHICAGO MERCANTILE EXCHANGE", inverse: false },

  // Endeks
  { symbol: "US500", market: "S&P 500 Consolidated - CHICAGO MERCANTILE EXCHANGE", inverse: false },
  { symbol: "US100", market: "NASDAQ-100 Consolidated - CHICAGO MERCANTILE EXCHANGE", inverse: false },
  { symbol: "VIX", market: "VIX FUTURES - CBOE FUTURES EXCHANGE", inverse: false },
  { symbol: "NIKKEI225", market: "NIKKEI STOCK AVERAGE YEN DENOM - CHICAGO MERCANTILE EXCHANGE", inverse: false },

  // Emtia ve tahvil
  { symbol: "XAUUSD", market: "GOLD - COMMODITY EXCHANGE INC.", inverse: false },
  { symbol: "XAGUSD", market: "SILVER - COMMODITY EXCHANGE INC.", inverse: false },
  { symbol: "WTI", market: "CRUDE OIL, LIGHT SWEET-WTI - ICE FUTURES EUROPE", inverse: false },
  { symbol: "BRENT", market: "BRENT LAST DAY - NEW YORK MERCANTILE EXCHANGE", inverse: false },
  {
    symbol: "US10Y",
    market: "UST 10Y NOTE - CHICAGO BOARD OF TRADE",
    inverse: true,
    inverseNote: "Tahvil vadelisinde net uzun = faiz aşağı",
  },
  {
    symbol: "US02Y",
    market: "UST 2Y NOTE - CHICAGO BOARD OF TRADE",
    inverse: true,
    inverseNote: "Tahvil vadelisinde net uzun = faiz aşağı",
  },

  // Kripto
  { symbol: "BTCUSD", market: "BITCOIN - CHICAGO MERCANTILE EXCHANGE", inverse: false },
  { symbol: "ETHUSD", market: "ETHER CASH SETTLED - CHICAGO MERCANTILE EXCHANGE", inverse: false },
  { symbol: "XRPUSD", market: "XRP - CHICAGO MERCANTILE EXCHANGE", inverse: false },
];

export interface CotSide {
  long: number;
  short: number;
  net: number;
  /** Haftalik net degisim. */
  change: number;
}

export interface CotEntry {
  symbol: string;
  market: string;
  inverse: boolean;
  inverseNote?: string;
  openInterest: number;
  openInterestChange: number;
  /** Buyuk spekulatorler. */
  noncomm: CotSide;
  /** Hedge eden kurumlar. ICT tarafinda "akilli para" olarak okunur. */
  comm: CotSide;
  /** Kucuk yatirimci. */
  small: CotSide;
  /**
   * Ticari olmayan netin son uc yildaki yeri, 0–100.
   * 0 = donemin en kisa pozisyonu, 100 = en uzunu.
   */
  index: number | null;
  /** Kac haftalik veriyle hesaplandi. */
  weeks: number;
  /**
   * Ticari olmayan (buyuk spekulator) net, eskiden yeniye.
   * Uc yil saklanir; ekranda istenen pencereye kirpilir.
   */
  history: number[];
  /** Ayni donemde ticari (hedge eden) net. Klasik COT grafiginde
   *  spekulatorun ayna goruntusudur. */
  commHistory: number[];
  /** Kucuk yatirimci (raporlanmayan) net. Klasik grafigin ucuncu cizgisi. */
  smallHistory: number[];
  /** Secili pariteler icin uretilen yorum. */
  ai?: string;
}

export interface CotReport {
  /** Pozisyonlarin ait oldugu sali. */
  date: string;
  fetchedAt: string;
  source: { label: string; url: string };
  entries: CotEntry[];
  /** Yorum uretilen pariteler. */
  aiSymbols?: string[];
  aiGeneratedBy?: string;
  aiGeneratedAt?: string;
}

interface RawRow {
  market_and_exchange_names: string;
  report_date_as_yyyy_mm_dd: string;
  open_interest_all: string;
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
  comm_positions_long_all: string;
  comm_positions_short_all: string;
  nonrept_positions_long_all: string;
  nonrept_positions_short_all: string;
}

const n = (v: string | undefined) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Socrata string escape: tek tirnak ikilenir. */
function sq(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

/**
 * Secilen piyasalarin son `weeks` haftalik kayitlarini ceker ve
 * her biri icin guncel pozisyon, haftalik degisim ve donem icindeki
 * yerini hesaplar.
 */
export async function fetchCot(
  markets: CotMarket[] = COT_MARKETS,
  weeks = 156,
  timeoutMs = 40000,
): Promise<CotReport> {
  const names = markets.map((m) => sq(m.market)).join(",");
  const since = new Date(Date.now() - weeks * 7 * 86400000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    $select:
      "market_and_exchange_names,report_date_as_yyyy_mm_dd,open_interest_all," +
      "noncomm_positions_long_all,noncomm_positions_short_all," +
      "comm_positions_long_all,comm_positions_short_all," +
      "nonrept_positions_long_all,nonrept_positions_short_all",
    $where: `market_and_exchange_names in(${names}) AND report_date_as_yyyy_mm_dd > '${since}'`,
    $order: "report_date_as_yyyy_mm_dd DESC",
    $limit: "6000",
  });

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let rows: RawRow[];
  try {
    const res = await fetch(`${CFTC_URL}?${params}`, {
      signal: ctl.signal,
      headers: { "user-agent": "sismograf/0.1 (+local)", accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CFTC ${res.status} ${res.statusText}`);
    rows = (await res.json()) as RawRow[];
  } finally {
    clearTimeout(timer);
  }

  const byMarket = new Map<string, RawRow[]>();
  for (const r of rows) {
    const list = byMarket.get(r.market_and_exchange_names) ?? [];
    list.push(r);
    byMarket.set(r.market_and_exchange_names, list);
  }

  const entries: CotEntry[] = [];
  let latest = "";

  for (const m of markets) {
    const hist = (byMarket.get(m.market) ?? []).sort((a, b) =>
      b.report_date_as_yyyy_mm_dd.localeCompare(a.report_date_as_yyyy_mm_dd),
    );
    if (hist.length === 0) continue;

    const cur = hist[0];
    const prev = hist[1];
    const date = cur.report_date_as_yyyy_mm_dd.slice(0, 10);
    if (date > latest) latest = date;

    const side = (long: number, short: number, pLong: number, pShort: number): CotSide => ({
      long,
      short,
      net: long - short,
      change: long - short - (pLong - pShort),
    });

    const nets = hist.map(
      (h) => n(h.noncomm_positions_long_all) - n(h.noncomm_positions_short_all),
    );
    const min = Math.min(...nets);
    const max = Math.max(...nets);
    const curNet = nets[0];
    const index = max > min ? Math.round(((curNet - min) / (max - min)) * 100) : null;

    entries.push({
      symbol: m.symbol,
      market: m.market,
      inverse: m.inverse,
      inverseNote: m.inverseNote,
      openInterest: n(cur.open_interest_all),
      openInterestChange: n(cur.open_interest_all) - n(prev?.open_interest_all),
      noncomm: side(
        n(cur.noncomm_positions_long_all),
        n(cur.noncomm_positions_short_all),
        n(prev?.noncomm_positions_long_all),
        n(prev?.noncomm_positions_short_all),
      ),
      comm: side(
        n(cur.comm_positions_long_all),
        n(cur.comm_positions_short_all),
        n(prev?.comm_positions_long_all),
        n(prev?.comm_positions_short_all),
      ),
      small: side(
        n(cur.nonrept_positions_long_all),
        n(cur.nonrept_positions_short_all),
        n(prev?.nonrept_positions_long_all),
        n(prev?.nonrept_positions_short_all),
      ),
      index,
      weeks: hist.length,
      history: nets.slice(0, 156).reverse(),
      commHistory: hist
        .slice(0, 156)
        .map((h) => n(h.comm_positions_long_all) - n(h.comm_positions_short_all))
        .reverse(),
      smallHistory: hist
        .slice(0, 156)
        .map((h) => n(h.nonrept_positions_long_all) - n(h.nonrept_positions_short_all))
        .reverse(),
    });
  }

  return {
    date: latest,
    fetchedAt: new Date().toISOString(),
    source: { label: "CFTC Commitments of Traders (Legacy, futures only)", url: CFTC_URL },
    entries: entries.sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}

/**
 * Vadeli islemdeki ham duruş: CFTC ne raporluyorsa o.
 * COT grafiklerinde gorulen sayi budur.
 */
export type CotTone = "uzun" | "kisa" | "notr";

/** Ic anahtar ASCII; ekranda gorunen metin ayri tutulur. */
const TONE_WORD: Record<CotTone, string> = {
  uzun: "uzun",
  kisa: "kısa",
  notr: "dengeli",
};

function label(tone: CotTone, share: number): string {
  if (tone === "notr") return TONE_WORD.notr;
  const strength = share > 0.4 ? "güçlü " : share > 0.2 ? "belirgin " : "";
  return `${strength}net ${TONE_WORD[tone]}`;
}

export function stance(entry: CotEntry): { label: string; tone: CotTone } {
  const net = entry.noncomm.net;
  const total = entry.noncomm.long + entry.noncomm.short;
  const share = total > 0 ? Math.abs(net) / total : 0;
  const tone: CotTone = share < 0.08 ? "notr" : net > 0 ? "uzun" : "kisa";
  return { label: label(tone, share), tone };
}

/**
 * Ayni duruşun BIZIM enstrumanimiz icin anlami.
 *
 * Yen, frank, kanada dolari ve tahvil vadelilerinde yon terstir:
 * yen vadelisinde net uzun olmak USDJPY'nin asagi gitmesi beklentisidir.
 * Ekranda karisiklik olmasin diye ayri hesaplanir.
 */
export function instrumentBias(entry: CotEntry): { label: string; tone: CotTone } {
  const raw = stance(entry);
  if (raw.tone === "notr" || !entry.inverse) return raw;
  const flipped: CotTone = raw.tone === "uzun" ? "kisa" : "uzun";
  const total = entry.noncomm.long + entry.noncomm.short;
  const share = total > 0 ? Math.abs(entry.noncomm.net) / total : 0;
  return { label: label(flipped, share), tone: flipped };
}
