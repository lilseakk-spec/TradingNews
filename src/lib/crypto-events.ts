import type { AffectedInstrument, Impact, NewsEvent } from "./types.ts";
import { trDateKey, trTime } from "./calendar.ts";

/**
 * Kripto tarafinin otomatik olay kaynagi.
 *
 * Ekonomik takvim feed'i kripto tasimaz. Kriptoda tarihi onceden belli,
 * gercekten oynaklik yaratan olaylarin basinda opsiyon vadeleri gelir:
 * vade oncesi fiyat en buyuk acik pozisyonun oldugu seviyeye yapisir,
 * vadeden sonra o baski kalkar.
 *
 * Kaynak OKX'in acik API'si: anahtar gerekmez, hem vade tarihini hem
 * acik pozisyonu verir. Acik pozisyon payi vadeyi agirliklandirir, yani
 * kucuk bir gunluk vade ile ceyreklik vade ayni muameleyi gormez.
 *
 * Not: Deribit en buyuk opsiyon borsasi ama Turkiye'den erisilemiyor.
 * Aylik ve ceyreklik vadeler butun borsalarda ayni gun ve saatte
 * (son cuma 08:00 UTC = 11:00 TRT) oldugu icin OKX ayni takvimi verir.
 */

export const OKX_API = "https://www.okx.com/api/v5";

const FAMILIES = [
  { family: "BTC-USD", coin: "BTC", symbol: "BTCUSD" },
  { family: "ETH-USD", coin: "ETH", symbol: "ETHUSD" },
] as const;

/** Bu paydan buyuk acik pozisyona sahip vade, cuma olmasa da listeye girer. */
const SHARE_THRESHOLD = 12;

type Coin = "BTC" | "ETH";

export interface CoinExpiry {
  /** Vadede duran acik pozisyon, coin cinsinden. */
  oi: number;
  /** Bu coinin toplam acik pozisyonu icindeki payi, yuzde. */
  share: number;
  /** Dolar karsiligi; endeks fiyati alinamazsa 0. */
  notionalUsd: number;
}

export interface ExpiryPoint {
  /** Vade ani, ms (UTC). */
  ts: number;
  byCoin: Partial<Record<Coin, CoinExpiry>>;
}

async function getJson(url: string, timeoutMs = 20000): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { "user-agent": "sismograf/0.1 (+local)" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** OKX'ten BTC ve ETH opsiyon vadelerini acik pozisyonlariyla ceker. */
export async function fetchOptionExpiries(): Promise<ExpiryPoint[]> {
  const points = new Map<number, ExpiryPoint>();

  for (const { family, coin } of FAMILIES) {
    const [instruments, openInterest, index] = await Promise.all([
      getJson(`${OKX_API}/public/instruments?instType=OPTION&instFamily=${family}`),
      getJson(`${OKX_API}/public/open-interest?instType=OPTION&instFamily=${family}`),
      getJson(`${OKX_API}/market/index-tickers?instId=${family}`).catch(() => null),
    ]);

    const oiByInstrument = new Map<string, number>(
      (openInterest?.data ?? []).map((o: any) => [o.instId, Number(o.oiCcy ?? 0)]),
    );
    const price = Number(index?.data?.[0]?.idxPx ?? 0);

    const oiByExpiry = new Map<number, number>();
    for (const inst of instruments?.data ?? []) {
      const ts = Number(inst.expTime);
      if (!Number.isFinite(ts)) continue;
      oiByExpiry.set(ts, (oiByExpiry.get(ts) ?? 0) + (oiByInstrument.get(inst.instId) ?? 0));
    }

    const total = [...oiByExpiry.values()].reduce((a, b) => a + b, 0);
    if (total <= 0) continue;

    for (const [ts, oi] of oiByExpiry) {
      const point = points.get(ts) ?? { ts, byCoin: {} };
      point.byCoin[coin as Coin] = {
        oi,
        share: (100 * oi) / total,
        notionalUsd: price > 0 ? oi * price : 0,
      };
      points.set(ts, point);
    }
  }

  return [...points.values()].sort((a, b) => a.ts - b.ts);
}

type ExpiryKind = "ceyreklik" | "aylik" | "haftalik" | "gunluk";

function classify(ts: number): ExpiryKind {
  const d = new Date(ts);
  if (d.getUTCDay() !== 5) return "gunluk";
  const nextWeek = new Date(ts + 7 * 86_400_000);
  const isLastFriday = nextWeek.getUTCMonth() !== d.getUTCMonth();
  if (!isLastFriday) return "haftalik";
  // Mart, Haziran, Eylul, Aralik sonu ceyreklik vadedir.
  return [2, 5, 8, 11].includes(d.getUTCMonth()) ? "ceyreklik" : "aylik";
}

const BASE_VOLATILITY: Record<ExpiryKind, number> = {
  ceyreklik: 74,
  aylik: 66,
  haftalik: 48,
  gunluk: 46,
};

const BASE_IMPACT: Record<ExpiryKind, Impact> = {
  ceyreklik: 3,
  aylik: 3,
  haftalik: 2,
  gunluk: 2,
};

const fmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

function usdShort(value: number): string {
  if (value >= 1e9) return `${fmt.format(value / 1e9)} mlr $`;
  if (value >= 1e6) return `${fmt.format(value / 1e6)} mn $`;
  return `${fmt.format(value)} $`;
}

/**
 * Vade noktalarini, verilen hafta araligina dusen haber olaylarina cevirir.
 * Yalnizca cuma vadeleri ve acik pozisyon payi esigi gecen vadeler kalir;
 * kucuk gunluk vadeler takvimi kalabaliklastirmasin diye elenir.
 */
export function expiryEvents(
  points: ExpiryPoint[],
  startISO: string,
  endISO: string,
): NewsEvent[] {
  const out: NewsEvent[] = [];

  for (const point of points) {
    const iso = new Date(point.ts).toISOString();
    const date = trDateKey(iso);
    if (date < startISO || date > endISO) continue;

    const coins = (Object.keys(point.byCoin) as Coin[]).filter(
      (c) => (point.byCoin[c]?.oi ?? 0) > 0,
    );
    if (coins.length === 0) continue;

    const kind = classify(point.ts);
    const avgShare =
      coins.reduce((sum, c) => sum + (point.byCoin[c]?.share ?? 0), 0) / coins.length;

    const isFriday = new Date(point.ts).getUTCDay() === 5;
    if (!isFriday && avgShare < SHARE_THRESHOLD) continue;

    const notional = coins.reduce((sum, c) => sum + (point.byCoin[c]?.notionalUsd ?? 0), 0);

    const affected: AffectedInstrument[] = [];
    if (point.byCoin.BTC) {
      affected.push({ symbol: "BTCUSD", direction: "volatil", strength: 3 });
    }
    if (point.byCoin.ETH) {
      affected.push({ symbol: "ETHUSD", direction: "volatil", strength: 3 });
    }
    affected.push({ symbol: "TOTAL", direction: "volatil", strength: 2 });
    if (kind === "aylik" || kind === "ceyreklik") {
      affected.push({
        symbol: "BTC.D",
        direction: "volatil",
        strength: 1,
        note: "vade sonrasi rotasyon",
      });
    }

    const label = coins.join(" ve ");
    const kindWord =
      kind === "gunluk" ? "" : `${kind.replace("ceyreklik", "çeyreklik").replace("aylik", "aylık").replace("haftalik", "haftalık")} `;

    const shares = coins
      .map((c) => `${c} %${fmt.format(point.byCoin[c]?.share ?? 0)}`)
      .join(" · ");

    out.push({
      id: `okx-opsiyon-vadesi-${date}`,
      time: trTime(iso),
      date,
      title: `${label} ${kindWord}opsiyon vadesi`,
      region: "Kripto",
      category: "kripto",
      impact: BASE_IMPACT[kind],
      volatility: Math.min(90, BASE_VOLATILITY[kind] + Math.round(avgShare)),
      metric: {
        label: "vadesi dolan açık pozisyon",
        value: notional > 0 ? `${usdShort(notional)} · ${shares}` : shares,
      },
      source: { label: "OKX opsiyon verisi", url: "https://www.okx.com" },
      affected,
    });
  }

  return out;
}

/** Hafta araligindaki otomatik kripto olaylari. */
export async function cryptoEvents(
  startISO: string,
  endISO: string,
): Promise<NewsEvent[]> {
  return expiryEvents(await fetchOptionExpiries(), startISO, endISO);
}
