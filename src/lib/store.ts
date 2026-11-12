import fs from "node:fs";
import path from "node:path";
import type { WeekData } from "./types.ts";
import type { CotReport } from "./cot.ts";
import type { UsageLog } from "./usage.ts";
import { activeWeekRange, trTodayISO } from "./weeks.ts";

/** Haftalik veri dosyalari. Her hafta tek JSON. */
export const WEEKS_DIR = path.join(process.cwd(), "src", "data", "weeks");

export interface WeekIndexEntry {
  id: string;
  label: string;
  start: string;
  end: string;
  updatedAt: string;
  eventCount: number;
  highImpact: number;
  preliminary: boolean;
}

function readDir(): string[] {
  if (!fs.existsSync(WEEKS_DIR)) return [];
  return fs
    .readdirSync(WEEKS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function loadWeek(id: string): WeekData | null {
  // Kimlik dosya adi olarak kullanilacak: disindaki her sey reddedilir.
  if (!/^\d{4}-W\d{2}$/.test(id)) return null;
  const file = path.join(WEEKS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as WeekData;
  } catch {
    return null;
  }
}

/** Tum haftalar, en yeniden en eskiye. */
export function weekIndex(): WeekIndexEntry[] {
  return readDir()
    .map((id) => loadWeek(id))
    .filter((w): w is WeekData => w !== null)
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((w) => {
      const events = w.days.flatMap((d) => d.events);
      return {
        id: w.id,
        label: w.label,
        start: w.start,
        end: w.end,
        updatedAt: w.updatedAt,
        eventCount: events.length,
        highImpact: events.filter((e) => e.impact === 3).length,
        preliminary: Boolean(w.preliminary),
      };
    });
}

/**
 * Gosterilecek hafta: once bu haftanin dosyasi, yoksa elde olan en yakin
 * gelecek hafta, o da yoksa en yeni arsiv haftasi.
 */
export function currentWeek(todayISO: string): WeekData | null {
  const active = activeWeekRange(todayISO);
  const exact = loadWeek(active.id);
  if (exact) return exact;

  const all = weekIndex();
  if (all.length === 0) return null;
  const upcoming = [...all].reverse().find((w) => w.start >= active.start);
  return loadWeek((upcoming ?? all[0]).id);
}

/**
 * Kurulum anindaki TRT tarihi. Yalnizca hangi haftanin gosterilecegini
 * secmek icin kullanilir; ekrandaki "bugun" isaretleri tarayicida
 * hesaplanir (weeks.ts icindeki trTodayISO).
 */
export function todayISO(): string {
  return trTodayISO();
}

/** COT raporu. Henuz cekilmediyse null. */
export function loadCot(): CotReport | null {
  const file = path.join(process.cwd(), "src", "data", "cot", "latest.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as CotReport;
  } catch {
    return null;
  }
}

/** Yorum uretilecek pariteler. Depodan elle duzenlenebilir. */
export function cotWatchlist(): string[] {
  const file = path.join(process.cwd(), "src", "data", "cot-watch.json");
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { symbols?: string[] };
    return Array.isArray(parsed.symbols) ? parsed.symbols : [];
  } catch {
    return [];
  }
}

/** Yapay zeka kullanim kayitlari. Henuz cagri yapilmadiysa bos. */
export function loadUsage(): UsageLog {
  const file = path.join(process.cwd(), "src", "data", "ai-usage.json");
  if (!fs.existsSync(file)) return { entries: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as UsageLog;
    return Array.isArray(parsed.entries) ? parsed : { entries: [] };
  } catch {
    return { entries: [] };
  }
}
