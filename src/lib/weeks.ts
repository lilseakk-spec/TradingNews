import type { DayBlock, WeekData } from "./types.ts";
import { trTodayISO } from "./clock.ts";

export { trTodayISO };

/**
 * Islem haftasi PAZAR gunu baslar, CUMA gunu kapanir.
 * Hafta kimligi, haftanin pazartesisinin ISO hafta numarasidir: 2026-W46.
 */

export interface DayMeta {
  key: string;
  label: string;
  short: string;
  /** JS getDay(): 0 = Pazar. */
  dow: number;
}

export const DAY_META: DayMeta[] = [
  { key: "pazar", label: "PAZAR", short: "PAZ", dow: 0 },
  { key: "pazartesi", label: "PAZARTESİ", short: "PZT", dow: 1 },
  { key: "sali", label: "SALI", short: "SAL", dow: 2 },
  { key: "carsamba", label: "ÇARŞAMBA", short: "ÇAR", dow: 3 },
  { key: "persembe", label: "PERŞEMBE", short: "PER", dow: 4 },
  { key: "cuma", label: "CUMA", short: "CUM", dow: 5 },
  { key: "cumartesi", label: "CUMARTESİ", short: "CMT", dow: 6 },
];

/**
 * Takvimin varsayilan kolonlari. Pazartesi ve cumartesi yalnizca o gune
 * dusen olay varsa eklenir; boylece hicbir haber kaybolmaz.
 */
export const PRIMARY_DAYS = ["pazar", "sali", "carsamba", "persembe", "cuma"];

export function dayMetaFor(key: string): DayMeta | undefined {
  return DAY_META.find((d) => d.key === key);
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

/** YYYY-MM-DD dizgisini saat dilimi kaymasi olmadan parcalar. */
export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

export function toISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function utc(iso: string): Date {
  const { y, m, d } = parseISO(iso);
  return new Date(Date.UTC(y, m, d));
}

export function addDays(iso: string, n: number): string {
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() + n);
  return toISO(date);
}

export function dayOfWeek(iso: string): number {
  return utc(iso).getUTCDay();
}

/** Verilen tarihin ait oldugu islem haftasinin pazar gunu. */
export function weekStart(iso: string): string {
  return addDays(iso, -dayOfWeek(iso));
}

/** ISO 8601 hafta numarasi. */
export function isoWeek(iso: string): { year: number; week: number } {
  const date = utc(iso);
  const dayNum = (date.getUTCDay() + 6) % 7; // Pazartesi = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // o haftanin persembesi
  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year, week };
}

export interface WeekRange {
  id: string;
  label: string;
  /** Pazar. */
  start: string;
  /** Cuma. */
  end: string;
}

/** Bir tarihin dustugu islem haftasinin kimligi ve etiketi. */
export function weekRange(iso: string): WeekRange {
  const start = weekStart(iso);
  const monday = addDays(start, 1);
  const end = addDays(start, 5);
  const { year, week } = isoWeek(monday);
  return {
    id: `${year}-W${String(week).padStart(2, "0")}`,
    label: rangeLabel(start, end),
    start,
    end,
  };
}

/**
 * Ilgili islem haftasi. Cumartesi gunu hafta kapanmistir, o yuzden
 * yarin baslayan hafta gosterilir.
 */
export function activeWeekRange(todayISO: string): WeekRange {
  return weekRange(dayOfWeek(todayISO) === 6 ? addDays(todayISO, 1) : todayISO);
}

/** "8 – 13 Kasım 2026" ya da ay degisiyorsa "29 Kasım – 4 Aralık 2026". */
export function rangeLabel(startISO: string, endISO: string): string {
  const a = parseISO(startISO);
  const b = parseISO(endISO);
  if (a.m === b.m && a.y === b.y) {
    return `${a.d} – ${b.d} ${MONTHS_TR[b.m]} ${b.y}`;
  }
  if (a.y === b.y) {
    return `${a.d} ${MONTHS_TR[a.m]} – ${b.d} ${MONTHS_TR[b.m]} ${b.y}`;
  }
  return `${a.d} ${MONTHS_TR[a.m]} ${a.y} – ${b.d} ${MONTHS_TR[b.m]} ${b.y}`;
}

/** "12 Kasım Perşembe" */
export function longDate(iso: string): string {
  const { y, m, d } = parseISO(iso);
  const meta = DAY_META.find((x) => x.dow === dayOfWeek(iso));
  // Turkce kuralla kucult: "CUMARTESİ" -> "Cumartesi". Varsayilan
  // toLowerCase, I harfini noktali bir i'ye cevirip "Cumartesi̇" uretiyor.
  const dayName = meta
    ? meta.label.charAt(0) + meta.label.slice(1).toLocaleLowerCase("tr")
    : "";
  return `${d} ${MONTHS_TR[m]} ${y} ${dayName}`;
}

/** "12 Kas" */
export function shortDate(iso: string): string {
  const { m, d } = parseISO(iso);
  return `${d} ${MONTHS_TR[m].slice(0, 3)}`;
}

/** Bos bir hafta iskeleti: istenen gunler, olaysiz. */
export function emptyDays(startISO: string, keys: string[] = PRIMARY_DAYS): DayBlock[] {
  return keys
    .map((key): DayBlock | null => {
      const meta = dayMetaFor(key);
      if (!meta) return null;
      const offset = (meta.dow - dayOfWeek(startISO) + 7) % 7;
      return {
        key,
        label: meta.label,
        date: addDays(startISO, offset),
        events: [],
      };
    })
    .filter((d): d is DayBlock => d !== null);
}

/** Haftanin toplam oynaklik yuku ve en yogun gunu. */
export function weekStats(week: WeekData) {
  const events = week.days.flatMap((d) => d.events);
  const high = events.filter((e) => e.impact === 3).length;
  const peak = week.days
    .map((d) => ({
      key: d.key,
      label: d.label,
      score: d.events.reduce((s, e) => Math.max(s, e.volatility), 0),
      count: d.events.length,
    }))
    .sort((a, b) => b.score - a.score)[0];
  const symbols = new Map<string, number>();
  for (const e of events) {
    for (const a of e.affected) {
      symbols.set(a.symbol, (symbols.get(a.symbol) ?? 0) + a.strength * (e.volatility / 100));
    }
  }
  const hottest = [...symbols.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([symbol, score]) => ({ symbol, score: Math.round(score * 10) / 10 }));

  return { total: events.length, high, peak, hottest };
}
