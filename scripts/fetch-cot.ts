/**
 * COT raporunu ceker ve src/data/cot/latest.json dosyasina yazar.
 *
 *   node scripts/fetch-cot.ts
 *
 * CFTC raporu cuma 15:30 ET'de (23:30 TRT) yayinlanir ve o haftanin
 * salisindaki pozisyonu gosterir. Mevcut yorumlar korunur; yeni rapor
 * geldiyse yorumlar duser, cunku artik eski veriyi anlatirlar.
 */

import fs from "node:fs";
import path from "node:path";
import {
  COT_MARKETS,
  fetchCot,
  instrumentBias,
  stance,
  type CotReport,
} from "../src/lib/cot.ts";

const OUT_DIR = path.join(process.cwd(), "src", "data", "cot");
const OUT_FILE = path.join(OUT_DIR, "latest.json");

const report = await fetchCot(COT_MARKETS);

if (report.entries.length === 0) {
  console.error("CFTC'den kayit gelmedi, dosya degistirilmedi.");
  process.exit(1);
}

let previous: CotReport | null = null;
if (fs.existsSync(OUT_FILE)) {
  try {
    previous = JSON.parse(fs.readFileSync(OUT_FILE, "utf8")) as CotReport;
  } catch {
    previous = null;
  }
}

// Ayni rapor tarihindeysek yorumlar hala gecerli, korunur.
if (previous && previous.date === report.date) {
  const notes = new Map(previous.entries.map((e) => [e.symbol, e.ai]));
  for (const e of report.entries) {
    const note = notes.get(e.symbol);
    if (note) e.ai = note;
  }
  report.aiSymbols = previous.aiSymbols;
  report.aiGeneratedBy = previous.aiGeneratedBy;
  report.aiGeneratedAt = previous.aiGeneratedAt;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2) + "\n", "utf8");

if (process.env.GITHUB_OUTPUT) {
  const fresh = !previous || previous.date !== report.date;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `cot_date=${report.date}\ncot_new=${fresh}\n`);
}

console.log(`COT raporu: ${report.date}  (${report.entries.length} piyasa)`);
console.log(`Yazildi: ${path.relative(process.cwd(), OUT_FILE)}`);
if (previous && previous.date !== report.date) {
  console.log(`  yeni rapor — onceki ${previous.date}, yorumlar sifirlandi`);
}

for (const e of report.entries) {
  const raw = stance(e);
  const bias = instrumentBias(e);
  const arrow = e.noncomm.change > 0 ? "+" : "";
  console.log(
    `  ${e.symbol.padEnd(10)}` +
      `vadeli ${raw.label.padEnd(16)}` +
      `net ${String(e.noncomm.net).padStart(9)}  ` +
      `hf ${(arrow + String(e.noncomm.change)).padStart(8)}  ` +
      `endeks ${e.index === null ? "  -" : String(e.index).padStart(3)}  ` +
      (e.inverse ? `-> ${e.symbol} ${bias.label}` : ""),
  );
}
