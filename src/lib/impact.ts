import type { AffectedInstrument, EventCategory, Impact } from "./types.ts";
import { isTracked } from "./instruments.ts";

/**
 * Haber -> etkilenen parite esleme katmani.
 *
 * Iki kademe calisir:
 *  1) Ozel kural: FOMC, TUFE, tarim disi istihdam gibi tek tek tanimli
 *     olaylar. Kategoriyi, oynaklik skorunu ve parite listesini verir.
 *  2) Para birimi haritasi: ozel kural yoksa olayin para birimine gore
 *     varsayilan pariteler atanir.
 *
 * Gurultu kontrolu burada: bir olay listede ancak "always" kuraliyla,
 * feed'de yuksek etkiliyse, ya da "keep" kurali + orta etki ile kalir.
 */

type A = AffectedInstrument;

const up = (symbol: string, strength: Impact = 2, note?: string): A => ({
  symbol,
  direction: "yukari",
  strength,
  note,
});
const down = (symbol: string, strength: Impact = 2, note?: string): A => ({
  symbol,
  direction: "asagi",
  strength,
  note,
});
const vol = (symbol: string, strength: Impact = 2, note?: string): A => ({
  symbol,
  direction: "volatil",
  strength,
  note,
});

/**
 * Para birimi -> varsayilan pariteler.
 * Yon mantigi: veri beklentiden GUCLU gelirse senaryosu.
 */
export const CURRENCY_MAP: Record<string, A[]> = {
  USD: [
    up("DXY", 3),
    down("EURUSD", 3),
    up("USDJPY", 2),
    down("XAUUSD", 2),
    vol("US500", 2),
    vol("BTCUSD", 2),
    up("US10Y", 2),
  ],
  EUR: [up("EURUSD", 3), vol("DAX40", 2), up("DE10Y", 2), up("EURJPY", 2)],
  GBP: [up("GBPUSD", 3), vol("FTSE100", 2)],
  JPY: [down("USDJPY", 3), vol("NIKKEI225", 2), down("EURJPY", 2)],
  CHF: [down("USDCHF", 3), vol("XAUUSD", 1)],
  AUD: [up("AUDUSD", 3), up("NZDUSD", 1)],
  NZD: [up("NZDUSD", 3), vol("AUDUSD", 1)],
  CAD: [down("USDCAD", 3), vol("WTI", 2)],
  CNY: [vol("AUDUSD", 2), vol("BRENT", 1), vol("US500", 1)],
  ALL: [vol("US500", 2), vol("BTCUSD", 2), vol("DXY", 2), vol("XAUUSD", 2)],
};

export interface ImpactRule {
  id: string;
  /** Baslikta aranan kalip. */
  match: RegExp;
  /** Bu kalip da esleirse kural atlanir. */
  exclude?: RegExp;
  /** Yalnizca bu para birimleri icin gecerli. */
  currencies?: string[];
  category: EventCategory;
  /** 0-100 beklenen oynaklik tabani. Feed etkisiyle agirliklandirilir. */
  volatility: number;
  /** Para birimi haritasinin yerine gecen pariteler. */
  affected?: A[];
  /** Haritaya ek olarak eklenecek pariteler. */
  extra?: A[];
  /** Feed orta etki dese de listede kalir. */
  keep?: boolean;
  /** Feed ne derse desin listede kalir. */
  always?: boolean;
}

/** Sira onemli: ilk eslesen kural kazanir, ozelden genele. */
export const RULES: ImpactRule[] = [
  // ── Konusmacilar (merkez banka kararlarindan ONCE gelmeli) ──
  {
    id: "chief-speaker",
    // Yalnizca kurum baskanlari adiyla. "Gov Board Member", "Deputy Gov"
    // gibi ikinci kademe konusmacilar alttaki member-speaker kuralina duser.
    match: /(powell|lagarde|ueda|bailey|bullock|macklem|schlegel|fed chair)/i,
    exclude: /deputy|board member/i,
    category: "merkez-banka",
    volatility: 72,
    keep: true,
    extra: [vol("US100", 2), vol("BTCUSD", 2)],
  },
  {
    id: "cb-presser",
    match: /press conference/i,
    category: "merkez-banka",
    volatility: 74,
    keep: true,
  },
  {
    id: "member-speaker",
    match: /(speaks|speech|testimony|testifies)/i,
    category: "merkez-banka",
    volatility: 46,
  },

  // ── Merkez banka kararlari ─────────────────────────────────
  {
    id: "fomc",
    match: /(fomc statement|federal funds rate|fomc economic projections)/i,
    currencies: ["USD"],
    category: "merkez-banka",
    volatility: 94,
    always: true,
    extra: [vol("US100", 3), vol("ETHUSD", 2), up("US02Y", 3)],
  },
  {
    id: "fomc-minutes",
    match: /(meeting minutes|tutanak)/i,
    currencies: ["USD"],
    category: "merkez-banka",
    volatility: 62,
    keep: true,
  },
  {
    id: "ecb-decision",
    match: /(main refinancing rate|ecb monetary policy|deposit facility rate)/i,
    currencies: ["EUR"],
    category: "merkez-banka",
    volatility: 84,
    always: true,
    extra: [vol("DAX40", 3), vol("DE10Y", 3)],
  },
  {
    id: "boj-decision",
    match: /(boj policy rate|boj outlook report|boj monetary policy)/i,
    currencies: ["JPY"],
    category: "merkez-banka",
    volatility: 80,
    always: true,
    extra: [vol("NIKKEI225", 3), vol("US10Y", 2)],
  },
  {
    id: "boe-decision",
    match: /(official bank rate|bank rate votes|monetary policy summary|monetary policy report)/i,
    currencies: ["GBP"],
    category: "merkez-banka",
    volatility: 76,
    always: true,
  },
  {
    id: "rba-decision",
    match: /(cash rate|rba monetary policy|rba rate statement)/i,
    currencies: ["AUD"],
    category: "merkez-banka",
    volatility: 72,
    always: true,
  },
  {
    id: "cb-generic",
    match:
      /(rate decision|interest rate decision|policy rate|rate statement|monetary policy statement|faiz karari)/i,
    category: "merkez-banka",
    volatility: 70,
    keep: true,
  },

  // ── Istihdam (siralama: ozel olanlar NFP'den once) ─────────
  {
    id: "adp",
    match: /\badp\b/i,
    currencies: ["USD"],
    category: "istihdam",
    volatility: 54,
    keep: true,
  },
  {
    id: "productivity",
    match: /(productivity|unit labor cost|unit labour cost)/i,
    category: "buyume",
    volatility: 34,
  },
  {
    id: "nfp",
    match: /(non-?farm payrolls|non-?farm employment change|\bnfp\b)/i,
    currencies: ["USD"],
    exclude: /\badp\b|productivity/i,
    category: "istihdam",
    volatility: 92,
    always: true,
    extra: [vol("US100", 3), vol("BTCUSD", 3), up("US02Y", 3), down("XAUUSD", 2)],
  },
  {
    id: "wages",
    match: /(average (hourly|cash|weekly) earnings|wage growth|labor cost index)/i,
    category: "istihdam",
    volatility: 58,
    keep: true,
  },
  {
    id: "unemployment-rate",
    match: /(unemployment rate|issizlik orani)/i,
    category: "istihdam",
    volatility: 64,
    keep: true,
  },
  {
    id: "employment-change",
    match: /(employment change|jobs report|employment growth)/i,
    category: "istihdam",
    volatility: 62,
    keep: true,
  },
  {
    id: "jobless-claims",
    match: /(jobless claims|unemployment claims)/i,
    currencies: ["USD"],
    category: "istihdam",
    volatility: 38,
  },
  {
    id: "jolts",
    match: /(jolts|job openings)/i,
    currencies: ["USD"],
    category: "istihdam",
    volatility: 42,
  },

  // ── Enflasyon ──────────────────────────────────────────────
  {
    id: "inflation-expectations",
    match: /inflation expectations/i,
    category: "enflasyon",
    volatility: 44,
  },
  {
    id: "us-cpi",
    match: /\b(cpi|consumer price index|tufe)\b/i,
    currencies: ["USD"],
    category: "enflasyon",
    volatility: 90,
    always: true,
    extra: [vol("US100", 3), vol("BTCUSD", 3), down("XAUUSD", 2), up("US02Y", 3)],
  },
  {
    id: "us-pce",
    match: /\bpce\b/i,
    currencies: ["USD"],
    category: "enflasyon",
    volatility: 76,
    always: true,
  },
  {
    id: "ppi",
    match: /\b(ppi|producer price|ufe)\b/i,
    category: "enflasyon",
    volatility: 52,
  },
  {
    id: "cpi-generic",
    match: /\b(cpi|consumer price|hicp|inflation rate)\b/i,
    category: "enflasyon",
    volatility: 64,
    keep: true,
  },

  // ── Buyume ve aktivite ─────────────────────────────────────
  {
    id: "gdp",
    match: /\b(gdp|gsyh)\b/i,
    category: "buyume",
    volatility: 64,
    keep: true,
  },
  {
    id: "ism",
    match: /\bism\b/i,
    exclude: /prices|employment index|new orders/i,
    currencies: ["USD"],
    category: "buyume",
    volatility: 60,
    keep: true,
  },
  {
    id: "pmi",
    match: /\bpmi\b/i,
    category: "buyume",
    volatility: 48,
  },
  {
    id: "retail-sales",
    match: /(retail sales|perakende)/i,
    category: "buyume",
    volatility: 56,
    keep: true,
  },
  {
    id: "consumer-sentiment",
    match: /(consumer sentiment|consumer confidence|michigan)/i,
    category: "buyume",
    volatility: 40,
  },

  // ── Enerji ─────────────────────────────────────────────────
  {
    id: "opec",
    match: /\bopec\b/i,
    category: "enerji",
    volatility: 72,
    affected: [
      vol("WTI", 3),
      vol("BRENT", 3),
      vol("USDCAD", 2),
      vol("US500", 1),
      vol("XAUUSD", 1),
    ],
    always: true,
  },
  {
    id: "oil-inventories",
    match: /(crude oil inventories|petrol stoklari)/i,
    category: "enerji",
    volatility: 46,
    affected: [vol("WTI", 3), vol("BRENT", 3), vol("USDCAD", 1), vol("US500", 1)],
    keep: true,
  },
  // ── Likidite ve tahvil ─────────────────────────────────────
  {
    id: "auction",
    match: /(bond auction|note auction|bill auction|tahvil ihale)/i,
    category: "likidite",
    volatility: 34,
    affected: [vol("US10Y", 2), vol("US500", 1), vol("DXY", 1)],
  },
  {
    id: "treasury",
    match: /(treasury refunding|treasury statement|debt ceiling|government shutdown)/i,
    category: "likidite",
    volatility: 58,
    keep: true,
  },

  // ── Kripto (elle eklenen katman) ───────────────────────────
  {
    id: "crypto-etf",
    match: /(etf akis|etf flow|etf onay|etf approval|spot etf)/i,
    category: "kripto",
    volatility: 68,
    affected: [vol("BTCUSD", 3), vol("ETHUSD", 3), vol("TOTAL", 2), vol("BTC.D", 2)],
    always: true,
  },
  {
    id: "crypto-unlock",
    match: /(token unlock|kilit acilis|vesting|arz kilidi)/i,
    category: "kripto",
    volatility: 52,
    affected: [vol("TOTAL3", 3), vol("SOLUSD", 2), vol("XRPUSD", 2)],
    always: true,
  },
  {
    id: "crypto-regulation",
    match: /(\bsec\b|mica|clarity act|kripto duzenleme|kripto yasa)/i,
    category: "kripto",
    volatility: 64,
    affected: [vol("BTCUSD", 3), vol("ETHUSD", 2), vol("XRPUSD", 3), vol("TOTAL", 2)],
    always: true,
  },
  {
    id: "crypto-generic",
    match: /(bitcoin|ethereum|kripto|crypto|halving|mainnet|airdrop|stablecoin|likidasyon)/i,
    category: "kripto",
    volatility: 56,
    affected: [vol("BTCUSD", 3), vol("ETHUSD", 2), vol("TOTAL", 2)],
    always: true,
  },

  // ── Bilanco ────────────────────────────────────────────────
  {
    id: "earnings",
    match: /(earnings (report|call|results)|q[1-4] (earnings|results)|bilanco|gelir raporu)/i,
    exclude: /hourly|cash earnings|weekly earnings|wage/i,
    category: "bilanco",
    volatility: 58,
    affected: [vol("US100", 3), vol("US500", 2), vol("VIX", 2)],
    always: true,
  },

  // ── Jeopolitik ─────────────────────────────────────────────
  {
    id: "geopolitics",
    match:
      /(tarife|tariff|sanction|yaptirim|election|secim|summit|zirve|savas|\bwar\b|referendum)/i,
    category: "jeopolitik",
    volatility: 66,
    extra: [vol("XAUUSD", 3), vol("WTI", 2), vol("VIX", 2), vol("USDCHF", 1)],
    always: true,
  },
];

export interface MatchResult {
  rule?: ImpactRule;
  category: EventCategory;
  volatility: number;
  affected: A[];
  /** true ise olay listeye girer. */
  keep: boolean;
}

/** Bir olay basligini kurallardan gecirip kategori ve parite listesi uretir. */
export function classify(
  title: string,
  currency?: string,
  feedImpact: Impact = 2,
): MatchResult {
  const cur = (currency ?? "").toUpperCase();
  const rule = RULES.find(
    (r) =>
      r.match.test(title) &&
      !r.exclude?.test(title) &&
      (!r.currencies || r.currencies.includes(cur)),
  );

  const base = CURRENCY_MAP[cur] ?? CURRENCY_MAP.ALL;
  let affected: A[] = rule?.affected ? [...rule.affected] : [...base];
  if (rule?.extra) affected = dedupe([...affected, ...rule.extra]);
  // Takip evreninden cikarilan semboller eslemeden duser. instruments.ts
  // tek dogruluk kaynagi: oradan silinen sembol burada da yok sayilir.
  affected = affected.filter((a) => isTracked(a.symbol));

  // Feed'in etki notu, kuralin oynaklik tabanini agirliklandirir.
  const feedWeight = feedImpact === 3 ? 1 : feedImpact === 2 ? 0.85 : 0.62;
  const volatility = rule
    ? Math.round(rule.volatility * feedWeight)
    : feedImpact === 3
      ? 70
      : feedImpact === 2
        ? 45
        : 22;

  const keep =
    Boolean(rule?.always) ||
    feedImpact === 3 ||
    (Boolean(rule?.keep) && feedImpact === 2);

  return {
    rule,
    category: rule?.category ?? "buyume",
    volatility,
    // Once en guclu etki: siralama stabil, esit siddette giris sirasi korunur.
    affected: [...affected].sort((a, b) => b.strength - a.strength).slice(0, 8),
    keep,
  };
}

function dedupe(list: A[]): A[] {
  const seen = new Map<string, A>();
  for (const a of list) {
    const prev = seen.get(a.symbol);
    if (!prev || a.strength > prev.strength) seen.set(a.symbol, a);
  }
  return [...seen.values()];
}
