/**
 * Haber sonucu: ne bekleniyordu, ne geldi.
 *
 * Forex Factory feed'inde "actual" alani yok — sema yalnizca baslik,
 * ulke, tarih, etki, beklenti ve onceki degeri veriyor. Aciklanan
 * degeri biquote'tan alip olaylara ekliyoruz.
 *
 * Eslestirme baslikla degil, AN ve PARA BIRIMIYLE yapilir: baslik
 * bizde Turkce, kaynakta Ingilizce. Ayni dakikada ayni para biriminde
 * aciklanan ne varsa o olayin sonucudur — zaten ekranda da tek satira
 * katlanmis halde duruyorlar.
 */

import { BIQUOTE_URL } from "./biquote.ts";

/** Olayla birlikte aciklanan tek bir olcu. */
export interface EventResult {
  /** Kaynaktaki adi, Ingilizce. */
  name: string;
  actual: string;
  forecast?: string;
  previous?: string;
  /**
   * Beklentiden sapma yonu. Sayiya cevrilemeyen degerlerde undefined.
   * Pozitif: beklentinin ustunde.
   */
  surprise?: number;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[%,$]/g, "").replace(/,/g, "").trim();
  if (s === "" || s === "-") return null;
  const mult = /k$/i.test(s) ? 1e3 : /m$/i.test(s) ? 1e6 : /b$/i.test(s) ? 1e9 : 1;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n * mult : null;
};

const text = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" || s === "-" ? undefined : s;
};

/**
 * Seviye endeksleri degil, degisim olculeri ise yarar: "Core CPI m/m"
 * anlamli, "Core CPI = 339.9" degil. Adinda degisim gecenler one alinir.
 */
const CHANGE = /\b(m\/m|y\/y|q\/q|mom|yoy|qoq|rate|change|claims|growth|sales|index of)\b/i;

interface BiquoteRow {
  time?: string;
  currency?: string | null;
  name?: string;
  actual?: number | string | null;
  forecast?: number | string | null;
  previous?: number | string | null;
}

export async function fetchOutcomes(from: string, to: string): Promise<BiquoteRow[]> {
  const url = new URL(BIQUOTE_URL);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("limit", "1000");

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; sismograf/0.1)" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const body = await res.json();
    const rows: BiquoteRow[] = Array.isArray(body) ? body : (body?.data ?? []);
    return rows.filter((r) => text(r.actual) !== undefined);
  } finally {
    clearTimeout(timer);
  }
}

/** Kaynaktaki zaman bazen Z'siz geliyor; UTC kabul edilir. */
const stamp = (t: string): number => new Date(t.endsWith("Z") ? t : `${t}Z`).getTime();

/**
 * Baslik ipuclari: olay "Cekirdek TUFE" ise ana olcu "Core CPI m/m"
 * olmali, mansetki degil. Turkce basliktan Ingilizce ada kopru.
 */
const HINTS: [RegExp, RegExp][] = [
  [/çekirdek/i, /\bcore\b/i],
  [/manşet/i, /^(?!.*\bcore\b)/i],
  [/işsizlik|istihdam/i, /unemploy|payroll|claims|employ/i],
  [/perakende/i, /retail/i],
  [/\büfe\b/i, /\bppi\b|producer/i],
  [/\btüfe\b/i, /\bcpi\b|consumer price/i],
  [/gsyh|büyüme/i, /\bgdp\b/i],
  [/pmi/i, /\bpmi\b/i],
  [/faiz/i, /rate/i],
];

/**
 * Bir olayin sonuclari: ayni dakikada (±2 dk) ayni para biriminde
 * aciklananlar. Once baslikla ortusenler, sonra degisim olculeri,
 * sonra surpriz buyuklugu. En fazla bes tane.
 */
export function resultsFor(
  event: { utc?: string; currency?: string; title?: string },
  rows: BiquoteRow[],
): EventResult[] {
  if (!event.utc || !event.currency) return [];
  const at = new Date(event.utc).getTime();
  if (!Number.isFinite(at)) return [];

  const hits = rows.filter(
    (r) =>
      r.time &&
      r.currency === event.currency &&
      Math.abs(stamp(r.time) - at) <= 120_000,
  );

  const out: EventResult[] = [];
  for (const r of hits) {
    const actual = text(r.actual);
    if (!actual) continue;
    const forecast = text(r.forecast);
    const a = num(actual);
    const f = num(forecast);
    out.push({
      name: String(r.name ?? "").trim() || "ölçü",
      actual,
      forecast,
      previous: text(r.previous),
      surprise: a !== null && f !== null ? Number((a - f).toFixed(4)) : undefined,
    });
  }

  const title = event.title ?? "";
  const wanted = HINTS.filter(([tr]) => tr.test(title)).map(([, en]) => en);
  // Kac ipucu tutuyorsa o kadar iyi. "Hepsi tutsun" kurali kirilgandi:
  // "TUFE" icinde "UFE" gectigi icin alakasiz ipucu da devreye giriyordu.
  const score = (name: string) => wanted.filter((re) => re.test(name)).length;

  // Once baslikla ortusen olcu, sonra degisim olculeri, sonra surpriz.
  out.sort((x, y) => {
    const sx = score(x.name);
    const sy = score(y.name);
    if (sx !== sy) return sy - sx;
    const cx = CHANGE.test(x.name) ? 0 : 1;
    const cy = CHANGE.test(y.name) ? 0 : 1;
    if (cx !== cy) return cx - cy;
    return Math.abs(y.surprise ?? 0) - Math.abs(x.surprise ?? 0);
  });

  const seen = new Set<string>();
  return out.filter((r) => !seen.has(r.name) && seen.add(r.name)).slice(0, 5);
}

/** Beklentiye gore tek kelimelik okuma. */
export function surpriseLabel(r: EventResult): "üstünde" | "altında" | "beklendiği gibi" | null {
  if (r.surprise === undefined) return null;
  if (Math.abs(r.surprise) < 1e-9) return "beklendiği gibi";
  return r.surprise > 0 ? "üstünde" : "altında";
}
