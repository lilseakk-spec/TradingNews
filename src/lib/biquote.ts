import type { RawFeedItem } from "./calendar.ts";

/**
 * Ileriye donuk ekonomik takvim kaynagi.
 *
 * Forex Factory feed'i yalnizca icinde bulunulan haftayi veriyor
 * (nextweek ucu yok, denendi: 404). Gelecek haftaya bakabilmek icin
 * tarih araligi sorgulanabilen ikinci bir kaynak gerekti.
 *
 * biquote.io anahtarsiz, tarih araligi aliyor ve zamani UTC olarak
 * veriyor. Ciktiyi Forex Factory satir bicimine cevirip ayni ayiklama
 * hattindan geciriyoruz — siniflandirma, Turkcelestirme, kumeleme ve
 * gurultu filtresi aynen calisiyor.
 *
 * Not: Bu kaynakta ayni olay birden fazla kayit olarak gelebiliyor
 * (ornegin ayni saatte alti kez "GBP CPI y/y"). ingest icindeki kimlik
 * tekillestirmesi ve kumeleme bunu zaten topluyor.
 */

export const BIQUOTE_URL = "https://biquote.io/api/calendar";

/** Tek istekte alinacak ust sinir; bir hafta icin fazlasiyla yeterli. */
const LIMIT = 1000;

interface BiquoteItem {
  time?: string;
  currency?: string | null;
  countryCode?: string | null;
  name?: string;
  importance?: string | null;
  actual?: number | string | null;
  forecast?: number | string | null;
  previous?: number | string | null;
  unit?: string | null;
  multiplier?: string | null;
}

const IMPORTANCE: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Sayiyi okunur metne cevirir; yuzde ve carpan eklerini korur. */
function formatValue(
  value: number | string | null | undefined,
  unit?: string | null,
  multiplier?: string | null,
): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);

  let text = String(num);
  const mult = (multiplier ?? "").toLowerCase();
  if (mult === "thousands") text = `${text}B`;
  else if (mult === "millions") text = `${text}M`;
  else if (mult === "billions") text = `${text}Mr`;

  const u = (unit ?? "").toLowerCase();
  if (u === "percent" || u === "percentage") text = `${text}%`;
  return text;
}

/**
 * Verilen araliktaki olaylari Forex Factory satir bicimine cevirir.
 * from ve to: YYYY-MM-DD (dahil).
 */
export async function fetchRange(
  fromISO: string,
  toISO: string,
  timeoutMs = 25000,
): Promise<RawFeedItem[]> {
  const url = `${BIQUOTE_URL}?from=${fromISO}&to=${toISO}&limit=${LIMIT}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);

  let payload: unknown;
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { "user-agent": "sismograf/0.1 (+local)", accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    payload = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const list: BiquoteItem[] = Array.isArray(payload)
    ? (payload as BiquoteItem[])
    : (((payload as { data?: BiquoteItem[] })?.data ?? []) as BiquoteItem[]);

  return list
    .filter((x) => x?.name && x?.time)
    .map((x) => ({
      title: String(x.name),
      country: String(x.currency ?? x.countryCode ?? "").toUpperCase(),
      date: String(x.time),
      impact: IMPORTANCE[(x.importance ?? "").toLowerCase()] ?? "Low",
      actual: formatValue(x.actual, x.unit, x.multiplier),
      forecast: formatValue(x.forecast, x.unit, x.multiplier),
      previous: formatValue(x.previous, x.unit, x.multiplier),
    }));
}
