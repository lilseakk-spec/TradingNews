import type { AssetGroup } from "./types.ts";

/**
 * Takip evreni. Uygulamanin tek doğruluk kaynağı budur.
 *
 * Buradan bir satir silmek yeterlidir: impact.ts kurallarinda gecse bile
 * o sembol eslemeden otomatik duser, hicbir paritesi kalmayan haber de
 * listeye hic girmez. Eklemek icin satir yaz, baska yeri degistirme.
 *
 * Listeyi denetlemek icin: npm run check
 */

export interface GroupMeta {
  id: AssetGroup;
  label: string;
  /** Serit etiketi — 3 harf, mono. */
  code: string;
}

/** Serit sirasi: ustten alta. */
export const GROUPS: GroupMeta[] = [
  { id: "kripto", label: "Kripto", code: "KRP" },
  { id: "endeks", label: "Endeks", code: "END" },
  { id: "forex", label: "Forex", code: "FX" },
  { id: "emtia", label: "Emtia & Tahvil", code: "EMT" },
];

export interface Instrument {
  symbol: string;
  name: string;
  group: AssetGroup;
}

export const INSTRUMENTS: Instrument[] = [
  // ── Kripto ────────────────────────────────────────────────
  { symbol: "BTCUSD", name: "Bitcoin", group: "kripto" },
  { symbol: "ETHUSD", name: "Ethereum", group: "kripto" },
  { symbol: "SOLUSD", name: "Solana", group: "kripto" },
  { symbol: "XRPUSD", name: "XRP", group: "kripto" },
  { symbol: "TOTAL", name: "Toplam kripto piyasa değeri", group: "kripto" },
  { symbol: "TOTAL3", name: "Altcoin piyasa değeri (BTC+ETH hariç)", group: "kripto" },
  { symbol: "BTC.D", name: "Bitcoin dominance", group: "kripto" },

  // ── Endeksler ─────────────────────────────────────────────
  { symbol: "US100", name: "Nasdaq 100", group: "endeks" },
  { symbol: "US500", name: "S&P 500", group: "endeks" },
  { symbol: "DAX40", name: "DAX 40", group: "endeks" },
  { symbol: "NIKKEI225", name: "Nikkei 225", group: "endeks" },
  { symbol: "FTSE100", name: "FTSE 100", group: "endeks" },
  { symbol: "VIX", name: "VIX oynaklık endeksi", group: "endeks" },

  // ── Forex ─────────────────────────────────────────────────
  { symbol: "DXY", name: "Dolar endeksi", group: "forex" },
  { symbol: "EURUSD", name: "Euro / Dolar", group: "forex" },
  { symbol: "USDJPY", name: "Dolar / Yen", group: "forex" },
  { symbol: "GBPUSD", name: "Sterlin / Dolar", group: "forex" },
  { symbol: "AUDUSD", name: "Avustralya Doları / Dolar", group: "forex" },
  { symbol: "USDCAD", name: "Dolar / Kanada Doları", group: "forex" },
  { symbol: "USDCHF", name: "Dolar / Frank", group: "forex" },
  { symbol: "NZDUSD", name: "Yeni Zelanda Doları / Dolar", group: "forex" },
  { symbol: "EURJPY", name: "Euro / Yen", group: "forex" },

  // ── Emtia & tahvil ────────────────────────────────────────
  { symbol: "XAUUSD", name: "Altın", group: "emtia" },
  { symbol: "XAGUSD", name: "Gümüş", group: "emtia" },
  { symbol: "WTI", name: "WTI petrol", group: "emtia" },
  { symbol: "BRENT", name: "Brent petrol", group: "emtia" },
  { symbol: "US10Y", name: "ABD 10 yıllık tahvil faizi", group: "emtia" },
  { symbol: "US02Y", name: "ABD 2 yıllık tahvil faizi", group: "emtia" },
  { symbol: "DE10Y", name: "Almanya 10 yıllık tahvil faizi", group: "emtia" },
];

const BY_SYMBOL = new Map(INSTRUMENTS.map((i) => [i.symbol, i]));

export function instrument(symbol: string): Instrument | undefined {
  return BY_SYMBOL.get(symbol);
}

/** Sembol takip evreninde mi. */
export function isTracked(symbol: string): boolean {
  return BY_SYMBOL.has(symbol);
}

export function groupOf(symbol: string): AssetGroup | undefined {
  return BY_SYMBOL.get(symbol)?.group;
}

export function instrumentName(symbol: string): string {
  return BY_SYMBOL.get(symbol)?.name ?? symbol;
}

export function instrumentsByGroup(group: AssetGroup): Instrument[] {
  return INSTRUMENTS.filter((i) => i.group === group);
}
