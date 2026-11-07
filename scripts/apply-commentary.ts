/**
 * Elle yazilmis bir yorum dosyasini hafta dosyasina isler.
 *
 *   node scripts/apply-commentary.ts --file yorum.json
 *   node scripts/apply-commentary.ts --file yorum.json --id 2026-W46
 *
 * Yorum dosyasi 'npm run ai' ciktisiyla ayni bicimde:
 *   { headline, thesis, regime, scenarios, watchlist, risks,
 *     dayFocus: { gun: "..." }, eventNotes: { olay_id: "..." },
 *     generatedBy: "..." }
 *
 * API anahtari olmadan yorum girmek ya da uretilen yorumu elle
 * duzeltmek icin. Bos birakilan alanlar dosyadaki haliyle kalir.
 */

import fs from "node:fs";
import path from "node:path";
import type { AiCommentary, WeekData } from "../src/lib/types.ts";

const WEEKS_DIR = path.join(process.cwd(), "src", "data", "weeks");

const args = process.argv.slice(2);
const fileArg = args[args.indexOf("--file") + 1];
const idArg = args[args.indexOf("--id") + 1];

if (!args.includes("--file") || !fileArg) {
  console.error("Kullanim: node scripts/apply-commentary.ts --file <yorum.json> [--id 2026-W46]");
  process.exit(1);
}
if (!fs.existsSync(fileArg)) {
  console.error(`Yorum dosyasi bulunamadi: ${fileArg}`);
  process.exit(1);
}

function latestWeekId(): string {
  const files = fs.existsSync(WEEKS_DIR)
    ? fs.readdirSync(WEEKS_DIR).filter((f) => f.endsWith(".json"))
    : [];
  if (files.length === 0) {
    console.error("Hafta dosyasi yok. Once 'npm run new-week' calistir.");
    process.exit(1);
  }
  return files.sort().reverse()[0].replace(/\.json$/, "");
}

const weekId = args.includes("--id") && idArg ? idArg : latestWeekId();
const weekFile = path.join(WEEKS_DIR, `${weekId}.json`);
if (!fs.existsSync(weekFile)) {
  console.error(`Hafta dosyasi bulunamadi: ${weekId}`);
  process.exit(1);
}

interface CommentaryFile extends Partial<AiCommentary> {
  dayFocus?: Record<string, string>;
  eventNotes?: Record<string, string>;
}

const week = JSON.parse(fs.readFileSync(weekFile, "utf8")) as WeekData;
const input = JSON.parse(fs.readFileSync(fileArg, "utf8")) as CommentaryFile;

const ai: AiCommentary = {
  headline: input.headline ?? week.ai.headline,
  thesis: input.thesis ?? week.ai.thesis,
  regime: input.regime ?? week.ai.regime,
  scenarios: input.scenarios ?? week.ai.scenarios,
  watchlist: input.watchlist ?? week.ai.watchlist,
  risks: input.risks ?? week.ai.risks,
  generatedBy: input.generatedBy ?? "elle yazıldı",
  generatedAt: input.generatedAt ?? new Date().toISOString(),
};

const knownIds = new Set(week.days.flatMap((d) => d.events.map((e) => e.id)));
const unknown = Object.keys(input.eventNotes ?? {}).filter(
  (id) => !knownIds.has(id) && (input.eventNotes?.[id] ?? "").trim() !== "",
);
const dayKeys = new Set(week.days.map((d) => d.key));
const unknownDays = Object.keys(input.dayFocus ?? {}).filter((k) => !dayKeys.has(k));

let noted = 0;
let focused = 0;
const days = week.days.map((day) => {
  const focus = (input.dayFocus?.[day.key] ?? "").trim();
  if (focus) focused++;
  return {
    ...day,
    focus: focus || day.focus,
    events: day.events.map((e) => {
      const note = (input.eventNotes?.[e.id] ?? "").trim();
      if (note) noted++;
      return { ...e, ai: note || e.ai };
    }),
  };
});

const out: WeekData = { ...week, ai, days, updatedAt: new Date().toISOString() };
fs.writeFileSync(weekFile, JSON.stringify(out, null, 2) + "\n", "utf8");

const withEvents = week.days.filter((d) => d.events.length > 0).length;
console.log(`Islendi: ${path.relative(process.cwd(), weekFile)}`);
console.log(`  manset   : ${ai.headline}`);
console.log(`  kaynak   : ${ai.generatedBy}`);
console.log(`  gun odagi: ${focused}/${withEvents}`);
console.log(`  olay notu: ${noted}/${knownIds.size}`);
for (const id of unknown) console.warn(`  uyari: bilinmeyen olay id — ${id}`);
for (const k of unknownDays) console.warn(`  uyari: bilinmeyen gun anahtari — ${k}`);
