/**
 * Takip evrenini denetler.
 *
 *   node scripts/check-universe.ts
 *
 * Uc soruya cevap verir:
 *  1. Kurallarda gecip kayit defterinde olmayan sembol var mi?
 *     (zararsizdir, esleme sirasinda duser; ama olu ayardir)
 *  2. Kayit defterinde olup hicbir kuralin dokunmadigi enstruman var mi?
 *     (asla tik almaz; listeden cikarilabilir)
 *  3. Arsivdeki haftalarda her enstrumana kac haber degdi?
 *
 * Listeyi daraltmadan once bunu calistir.
 */

import fs from "node:fs";
import path from "node:path";
import { GROUPS, INSTRUMENTS, isTracked } from "../src/lib/instruments.ts";
import { CURRENCY_MAP, RULES } from "../src/lib/impact.ts";
import type { WeekData } from "../src/lib/types.ts";

const WEEKS_DIR = path.join(process.cwd(), "src", "data", "weeks");

// ── 1. Kurallarin dokundugu semboller ───────────────────────────

const referenced = new Map<string, string[]>();
const note = (symbol: string, where: string) => {
  const list = referenced.get(symbol) ?? [];
  list.push(where);
  referenced.set(symbol, list);
};

for (const [currency, list] of Object.entries(CURRENCY_MAP)) {
  for (const a of list) note(a.symbol, `para birimi:${currency}`);
}
for (const rule of RULES) {
  for (const a of rule.affected ?? []) note(a.symbol, `kural:${rule.id}`);
  for (const a of rule.extra ?? []) note(a.symbol, `kural:${rule.id}`);
}

const orphans = [...referenced.keys()].filter((s) => !isTracked(s));
const unreachable = INSTRUMENTS.filter((i) => !referenced.has(i.symbol));

// ── 2. Arsivdeki kullanim ───────────────────────────────────────

const weeks = fs.existsSync(WEEKS_DIR)
  ? fs
      .readdirSync(WEEKS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(WEEKS_DIR, f), "utf8")) as WeekData)
  : [];

const touches = new Map<string, number>();
for (const w of weeks) {
  for (const d of w.days) {
    for (const e of d.events) {
      for (const a of e.affected) touches.set(a.symbol, (touches.get(a.symbol) ?? 0) + 1);
    }
  }
}

// ── Rapor ───────────────────────────────────────────────────────

console.log(`Takip evreni: ${INSTRUMENTS.length} enstruman, ${RULES.length} kural`);
console.log(`Arsiv: ${weeks.length} hafta\n`);

for (const g of GROUPS) {
  const list = INSTRUMENTS.filter((i) => i.group === g.id);
  console.log(`${g.code.padEnd(4)} ${g.label} (${list.length})`);
  for (const i of list) {
    const refs = referenced.get(i.symbol)?.length ?? 0;
    const hits = touches.get(i.symbol) ?? 0;
    const flag = refs === 0 ? "  <- hicbir kural dokunmuyor" : "";
    console.log(
      `  ${i.symbol.padEnd(10)} kural ${String(refs).padStart(2)}  haber ${String(hits).padStart(3)}${flag}`,
    );
  }
  console.log("");
}

let problems = 0;

if (orphans.length > 0) {
  problems += orphans.length;
  console.log("Kayit defterinde olmayan ama kurallarda gecen semboller:");
  for (const s of orphans) {
    console.log(`  ${s.padEnd(10)} -> ${[...new Set(referenced.get(s))].join(", ")}`);
  }
  console.log("  Bunlar eslemede yok sayilir. impact.ts icinden silinebilir.\n");
}

if (unreachable.length > 0) {
  console.log("Hicbir kuralin dokunmadigi enstrumanlar:");
  for (const i of unreachable) console.log(`  ${i.symbol.padEnd(10)} ${i.name}`);
  console.log("  Bunlar asla tik almaz. Ya instruments.ts'den cikar ya impact.ts'e kural ekle.\n");
}

if (problems === 0 && unreachable.length === 0) {
  console.log("Evren tutarli: her kural bir enstrumana, her enstruman bir kurala bagli.");
}

process.exit(orphans.length > 0 ? 1 : 0);
