/**
 * Aciklanan degerleri cekip hafta dosyasina isler.
 *
 *   node scripts/fetch-outcomes.ts            # bu hafta
 *   node scripts/fetch-outcomes.ts --week 2026-W46
 *
 * Gunluk calisir: gecmis olaylara "ne geldi" bilgisini ekler.
 * Yalnizca zamani gecmis olaylara bakar, gelecek olaylara dokunmaz.
 *
 * Yeni sonuc bulundugunda cikti olarak bildirir; yorum adimi buna gore
 * calisir (GitHub Actions ciktisi: results_new).
 */

import fs from "node:fs";
import path from "node:path";
import { fetchOutcomes, resultsFor } from "../src/lib/outcomes.ts";
import { activeWeekRange, addDays, trTodayISO } from "../src/lib/weeks.ts";
import type { WeekData } from "../src/lib/types.ts";

const args = process.argv.slice(2);
const wantWeek = args.includes("--week") ? args[args.indexOf("--week") + 1] : undefined;

const dir = path.join(process.cwd(), "src", "data", "weeks");
const weekId = wantWeek ?? activeWeekRange(trTodayISO()).id;
const file = path.join(dir, `${weekId}.json`);

if (!fs.existsSync(file)) {
  console.error(`Hafta dosyasi yok: ${weekId}`);
  process.exit(1);
}

const week = JSON.parse(fs.readFileSync(file, "utf8")) as WeekData;
const days = week.days ?? [];
if (days.length === 0) {
  console.log("Gun yok, atlandi.");
  process.exit(0);
}

const from = days[0].date;
const to = addDays(days[days.length - 1].date, 1);

let rows;
try {
  rows = await fetchOutcomes(from, to);
} catch (err) {
  console.error(`Sonuclar alinamadi: ${(err as Error).message}`);
  process.exit(1);
}
console.log(`${weekId}: ${from} .. ${to} araliginda ${rows.length} aciklanmis olcu.`);

const now = Date.now();
let eklendi = 0;
let guncellendi = 0;

for (const day of days) {
  for (const e of day.events) {
    // Gelecek olaylarin sonucu olmaz.
    if (!e.utc || new Date(e.utc).getTime() > now) continue;
    const found = resultsFor(e, rows);
    if (found.length === 0) continue;

    const before = JSON.stringify(e.results ?? []);
    const after = JSON.stringify(found);
    if (before === after) continue;

    if (!e.results || e.results.length === 0) eklendi++;
    else guncellendi++;
    e.results = found;
    // Ana olcu: degisim olculerinin ilki.
    e.actual = found[0].actual;
  }
}

if (eklendi === 0 && guncellendi === 0) {
  console.log("Yeni sonuc yok.");
} else {
  week.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(week, null, 2) + "\n", "utf8");
  console.log(`${eklendi} olaya sonuc eklendi, ${guncellendi} olayin sonucu guncellendi.`);
  for (const day of days) {
    for (const e of day.events) {
      if (!e.results?.length) continue;
      const ilk = e.results[0];
      console.log(
        `  ${day.key.padEnd(10)}${(e.time ?? "--:--")}  ${e.title.slice(0, 34).padEnd(36)}` +
          `${ilk.name.slice(0, 20)}: ${ilk.actual}${ilk.forecast ? ` (bek ${ilk.forecast})` : ""}`,
      );
    }
  }
}

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `results_new=${eklendi + guncellendi > 0 ? "true" : "false"}\nweek_id=${weekId}\n`,
  );
}
