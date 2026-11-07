/**
 * Haftalik dosyayi uretir ya da gunceller.
 *
 *   node scripts/new-week.ts              # feed'i ceker, haftayi yazar
 *   node scripts/new-week.ts --offline    # onbellekteki feed'i kullanir
 *   node scripts/new-week.ts --id 2026-W46
 *
 * Yaptigi is:
 *  1. Ekonomik takvimi ceker ve gurultuyu ayiklar (impact.ts kurallari).
 *  2. Her haberi etkiledigi paritelere esler.
 *  3. src/data/manual/<hafta>.json dosyasindaki elle girilen olaylari
 *     (kripto, bilanco, jeopolitik) ayni haftaya karistirir.
 *  4. Hafta dosyasi varsa, icindeki yapay zeka yorumlarini korur.
 */

import fs from "node:fs";
import path from "node:path";
import { ingest, type IngestStats } from "../src/lib/calendar.ts";
import { classify } from "../src/lib/impact.ts";
import { isTracked } from "../src/lib/instruments.ts";
import {
  DAY_META,
  PRIMARY_DAYS,
  addDays,
  dayOfWeek,
  rangeLabel,
  weekRange,
  weekStart,
} from "../src/lib/weeks.ts";
import type { DayBlock, NewsEvent, WeekData } from "../src/lib/types.ts";
import { fetchFeed, readCache, writeCache } from "./fetch-calendar.ts";

const WEEKS_DIR = path.join(process.cwd(), "src", "data", "weeks");
const MANUAL_DIR = path.join(process.cwd(), "src", "data", "manual");

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const idArg = valueOf("--id");

function valueOf(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Elle girilen olay: eksik alanlar kurallardan tamamlanir. */
interface ManualEvent extends Partial<NewsEvent> {
  title: string;
  /** affected yerine kisa yol: sadece semboller. */
  symbols?: string[];
}

interface ManualFile {
  days?: { key: string; focus?: string; events?: ManualEvent[] }[];
}

function dayKeyFor(dateISO: string): string | undefined {
  return DAY_META.find((d) => d.dow === dayOfWeek(dateISO))?.key;
}

function readManual(id: string): ManualFile {
  const file = path.join(MANUAL_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as ManualFile;
  } catch (err) {
    console.warn(`  uyari: ${path.basename(file)} okunamadi — ${(err as Error).message}`);
    return {};
  }
}

function normalizeManual(raw: ManualEvent, dateISO: string): NewsEvent | null {
  const match = classify(raw.title, raw.currency, raw.impact ?? 2);
  const declared =
    raw.affected ??
    (raw.symbols
      ? raw.symbols.map((symbol) => ({
          symbol,
          direction: "volatil" as const,
          strength: 3 as const,
        }))
      : match.affected);

  // Takip evreni disindaki semboller duser; hicbiri kalmazsa olay da duser.
  const unknown = declared.filter((a) => !isTracked(a.symbol));
  const affected = declared.filter((a) => isTracked(a.symbol));
  for (const a of unknown) {
    console.warn(`  uyari: "${raw.title}" — ${a.symbol} takip evreninde yok, atlandi.`);
  }
  if (affected.length === 0) {
    console.warn(`  uyari: "${raw.title}" hicbir takip edilen pariteye degmiyor, eklenmedi.`);
    return null;
  }

  return {
    id: raw.id ?? `manual-${dateISO}-${slug(raw.title)}`,
    time: raw.time ?? null,
    title: raw.title,
    region: raw.region ?? "Kuresel",
    currency: raw.currency,
    category: raw.category ?? match.category,
    impact: raw.impact ?? 2,
    volatility: raw.volatility ?? match.volatility,
    forecast: raw.forecast,
    previous: raw.previous,
    actual: raw.actual,
    source: raw.source ?? { label: "Elle eklendi" },
    affected,
    ai: raw.ai,
  };
}

// ── 1. Takvimi al ───────────────────────────────────────────────

let cache;
if (offline) {
  cache = readCache();
  console.log(`Onbellek kullaniliyor (${cache.fetchedAt.slice(0, 16).replace("T", " ")}).`);
} else {
  cache = await fetchFeed();
  writeCache(cache);
  console.log(`Takvim indirildi: ${cache.items.length} satir.`);
}

const stats: IngestStats = {
  total: 0,
  skipped: 0,
  lowImpact: 0,
  outOfUniverse: 0,
  clustered: 0,
  kept: 0,
};
const events = ingest(cache.items, { stats });
console.log(
  `Ayiklama: ${stats.total} satir -> ${stats.kept} haber ` +
    `(${stats.skipped} tatil/yinelenen, ${stats.lowImpact} dusuk etki, ` +
    `${stats.outOfUniverse} evren disi, ${stats.clustered} katlandi)`,
);
if (events.length === 0 && !idArg) {
  console.error("Feed'de listeye girecek olay yok. --id ile bos hafta olusturabilirsin.");
  process.exit(1);
}

// ── 2. Haftayi belirle ──────────────────────────────────────────

const feedDates = [...new Set(cache.items.map((i) => i.date.slice(0, 10)))].sort();
const inferredStart = weekStart(feedDates[0] ?? new Date().toISOString().slice(0, 10));
const range = idArg
  ? resolveById(idArg)
  : { ...weekRange(inferredStart), start: inferredStart };

function resolveById(id: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(id);
  if (!match) throw new Error(`Hafta kimligi gecersiz: ${id} (ornek: 2026-W46)`);
  const [, yearStr, weekStr] = match;
  // ISO haftasinin pazartesisi: 4 Ocak her zaman 1. haftadadir.
  const jan4 = `${yearStr}-01-04`;
  const jan4Dow = (dayOfWeek(jan4) + 6) % 7;
  const week1Monday = addDays(jan4, -jan4Dow);
  const monday = addDays(week1Monday, (Number(weekStr) - 1) * 7);
  const start = addDays(monday, -1); // pazar
  return { id, start, end: addDays(start, 5), label: rangeLabel(start, addDays(start, 5)) };
}

console.log(`Hafta: ${range.id}  (${range.label})`);

// ── 3. Gunlere dagit ────────────────────────────────────────────

const byDate = new Map<string, NewsEvent[]>();
let outside = 0;
for (const event of events) {
  const dateISO = event.date ?? event.id.slice(0, 10);
  if (dateISO < range.start || dateISO > addDays(range.start, 6)) {
    outside++;
    continue;
  }
  const list = byDate.get(dateISO) ?? [];
  list.push(event);
  byDate.set(dateISO, list);
}
if (outside > 0) console.log(`  ${outside} olay hafta disinda kaldi, atlandi.`);

// Istenen kolonlar her zaman durur; diger gunler yalnizca olay varsa eklenir.
const dayDates = new Set<string>();
for (const key of PRIMARY_DAYS) {
  const meta = DAY_META.find((d) => d.key === key);
  if (meta) dayDates.add(addDays(range.start, (meta.dow - dayOfWeek(range.start) + 7) % 7));
}
for (const dateISO of byDate.keys()) dayDates.add(dateISO);

const manual = readManual(range.id);
const manualByDate = new Map<string, { focus?: string; events: ManualEvent[] }>();
for (const block of manual.days ?? []) {
  const meta = DAY_META.find((d) => d.key === block.key);
  if (!meta) {
    console.warn(`  uyari: bilinmeyen gun anahtari "${block.key}"`);
    continue;
  }
  const dateISO = addDays(range.start, (meta.dow - dayOfWeek(range.start) + 7) % 7);
  dayDates.add(dateISO);
  manualByDate.set(dateISO, { focus: block.focus, events: block.events ?? [] });
}

// ── 4. Onceki yorumlari koru ────────────────────────────────────

const outFile = path.join(WEEKS_DIR, `${range.id}.json`);
const existing: WeekData | null = fs.existsSync(outFile)
  ? (JSON.parse(fs.readFileSync(outFile, "utf8")) as WeekData)
  : null;

const keptNotes = new Map<string, string>();
const keptFocus = new Map<string, string>();
for (const day of existing?.days ?? []) {
  if (day.focus) keptFocus.set(day.key, day.focus);
  for (const e of day.events) if (e.ai) keptNotes.set(e.id, e.ai);
}

// ── 5. Hafta dosyasini kur ──────────────────────────────────────

let manualCount = 0;

const days: DayBlock[] = [...dayDates]
  .sort()
  .map((dateISO): DayBlock | null => {
    const key = dayKeyFor(dateISO);
    const meta = DAY_META.find((d) => d.key === key);
    if (!meta) return null;

    const fromFeed = byDate.get(dateISO) ?? [];
    const fromManual = (manualByDate.get(dateISO)?.events ?? [])
      .map((m) => normalizeManual(m, dateISO))
      .filter((e): e is NewsEvent => e !== null);
    manualCount += fromManual.length;

    const merged = [...fromFeed, ...fromManual]
      .map((e) => ({ ...e, ai: e.ai ?? keptNotes.get(e.id) }))
      .sort((a, b) => {
        const t = (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
        return t !== 0 ? t : b.volatility - a.volatility;
      });

    return {
      key: meta.key,
      label: meta.label,
      date: dateISO,
      focus: manualByDate.get(dateISO)?.focus ?? keptFocus.get(meta.key),
      events: merged,
    };
  })
  .filter((d): d is DayBlock => d !== null);

// Cumartesiye tasan bir olay varsa hafta etiketi onu da kapsasin.
const lastDate = days.length > 0 ? days[days.length - 1].date : range.end;
const end = lastDate > range.end ? lastDate : range.end;
const label = end === range.end ? range.label : rangeLabel(range.start, end);

// Guvenlik agi: ayiklamadan gecen her olay bir gune yerlesmis olmali.
const placed = days.reduce((n, d) => n + d.events.length, 0);
const expected = events.filter((e) => {
  const d = e.date ?? e.id.slice(0, 10);
  return d >= range.start && d <= addDays(range.start, 6);
}).length;
if (placed - manualCount < expected) {
  console.warn(
    `  uyari: ${expected - (placed - manualCount)} olay hicbir gune yerlesmedi.`,
  );
}

const week: WeekData = {
  id: range.id,
  label,
  start: range.start,
  end,
  updatedAt: new Date().toISOString(),
  calendarSource: {
    label: "Forex Factory haftalik takvim",
    url: cache.url,
    fetchedAt: cache.fetchedAt,
  },
  ai:
    existing?.ai ??
    {
      headline: "Yorum bekleniyor",
      thesis:
        "Bu hafta icin yapay zeka yorumu henuz uretilmedi. 'npm run ai' ile uret.",
      regime: { label: "belirlenmedi", tone: "karisik" },
      scenarios: [],
      watchlist: [],
      risks: [],
      generatedBy: "bekliyor",
      generatedAt: new Date().toISOString(),
    },
  days,
};

fs.mkdirSync(WEEKS_DIR, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(week, null, 2) + "\n", "utf8");

const total = days.reduce((n, d) => n + d.events.length, 0);
const high = days.flatMap((d) => d.events).filter((e) => e.impact === 3).length;

console.log(`\nYazildi: ${path.relative(process.cwd(), outFile)}`);
console.log(`  ${week.id} — ${week.label}`);
console.log(`  ${total} haber, ${high} yuksek etki, ${days.length} gun`);
for (const d of days) {
  const peak = d.events.reduce((m, e) => Math.max(m, e.volatility), 0);
  console.log(
    `  ${d.label.padEnd(10)} ${d.date}  ${String(d.events.length).padStart(2)} haber  zirve ${String(peak).padStart(3)}`,
  );
}
if (existing?.ai && existing.ai.generatedBy !== "bekliyor") {
  console.log("\nMevcut yapay zeka yorumu korundu.");
} else {
  console.log("\nSonraki adim: npm run ai");
}
