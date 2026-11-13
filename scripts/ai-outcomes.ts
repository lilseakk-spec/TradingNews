/**
 * Haber sonrasi yorum: ne bekleniyordu, ne geldi, ne anlama geliyor.
 *
 *   node scripts/ai-outcomes.ts
 *   node scripts/ai-outcomes.ts --week 2026-W46 --force
 *   node scripts/ai-outcomes.ts --dry        # istegi yaz, cagri yapma
 *
 * Yalnizca sonucu gelmis ve henuz yorumlanmamis olaylari isler, hepsini
 * tek cagrida. Etkisi dusuk olaylar atlanir — butce oraya gitmesin.
 *
 * Onemli: fiyatin nasil tepki verdigini BILMIYORUZ. Bu projede fiyat
 * verisi yok. Yorum verinin ne soyledigiyle sinirli; piyasa tepkisi
 * uydurulmaz.
 */

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { logUsage } from "./log-usage.ts";
import { surpriseLabel } from "../src/lib/outcomes.ts";
import { activeWeekRange, trTodayISO } from "../src/lib/weeks.ts";
import { instrumentName } from "../src/lib/instruments.ts";
import type { NewsEvent, WeekData } from "../src/lib/types.ts";

const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || "claude-sonnet-5-5";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const force = args.includes("--force");
const wantWeek = args.includes("--week") ? args[args.indexOf("--week") + 1] : undefined;

const weekId = wantWeek ?? activeWeekRange(trTodayISO()).id;
const file = path.join(process.cwd(), "src", "data", "weeks", `${weekId}.json`);
if (!fs.existsSync(file)) {
  console.error(`Hafta dosyasi yok: ${weekId}`);
  process.exit(1);
}
const week = JSON.parse(fs.readFileSync(file, "utf8")) as WeekData;

/** Sonucu gelmis, yorumu olmayan, etkisi anlamli olaylar. */
const targets: { day: string; e: NewsEvent }[] = [];
for (const d of week.days ?? []) {
  for (const e of d.events) {
    if (!e.results?.length) continue;
    if (e.impact < 2) continue;
    if (e.aiResult && !force) continue;
    targets.push({ day: d.label ?? d.key, e });
  }
}

if (targets.length === 0) {
  console.log("Yorumlanacak yeni sonuc yok.");
  process.exit(0);
}

const SYSTEM = `Sen ekonomik veri aciklamalarini degerlendiren bir analistsin. Okuyucun gun ici islem yapan bir trader.

Her olay icin ne bekleniyordu, ne geldi ve bunun ne anlama geldigini yaz.

Kurallar:
- Turkce yaz. HER OLAY ICIN EN FAZLA IKI CUMLE.
- Ilk cumle: hangi olcu beklentinin ne kadar ustunde/altinda kaldi. Sayilari kullan.
- Ikinci cumle: bunun yonu ne — hangi enstrumanda hangi taraf guclenir, neden.
- FIYATIN NASIL TEPKI VERDIGINI BILMIYORSUN. Elinde fiyat verisi yok.
  "Altin yukseldi", "dolar deger kazandi" gibi seyler YAZMA. Yalnizca verinin
  ne soyledigini ve mantiksal yonunu yaz.
- Surpriz kucukse bunu soyle; her veriden hikaye cikarma.
- Yatirim tavsiyesi, hedef fiyat ve giris-cikis seviyesi verme.

Cikti yalnizca gecerli JSON: { "olay_id": "yorum" }. JSON disinda hicbir metin yazma.`;

const lines = targets.map(({ day, e }) => {
  const olcu = e.results!.map((r) => {
    const yon = surpriseLabel(r);
    return `${r.name}: gelen ${r.actual}${r.forecast ? `, beklenti ${r.forecast}` : ""}${
      r.previous ? `, onceki ${r.previous}` : ""
    }${yon ? ` (${yon})` : ""}`;
  });
  const etkilenen = e.affected
    .slice(0, 6)
    .map((a) => `${instrumentName(a.symbol)} ${a.direction}`)
    .join(", ");
  return [
    `id: ${e.id}`,
    `  gun: ${day} ${e.time ?? "gun ici"}`,
    `  olay: ${e.title}${e.also?.length ? ` (ayni anda: ${e.also.join("; ")})` : ""}`,
    `  bolge: ${e.region}${e.currency ? ` / ${e.currency}` : ""}  etki: ${e.impact}/3`,
    `  olculer:`,
    ...olcu.map((o) => `    - ${o}`),
    etkilenen ? `  takip ettigimiz etkilenenler: ${etkilenen}` : "",
  ]
    .filter(Boolean)
    .join("\n");
});

const USER = `Hafta: ${week.id}\n\nAsagidaki olaylarin sonuclari aciklandi. Her biri icin yorum yaz.\n\n${lines.join("\n\n")}`;

if (dry) {
  console.log("=== SYSTEM ===\n" + SYSTEM + "\n\n=== USER ===\n" + USER);
  process.exit(0);
}

const client = new Anthropic();
const request = {
  model: MODEL,
  max_tokens: 16000,
  system: SYSTEM,
  thinking: { type: "adaptive" as const },
  output_config: { effort: "high" as const },
  messages: [{ role: "user" as const, content: USER }],
};

console.log(`Model: ${MODEL}  ·  hafta: ${weekId}  ·  ${targets.length} olay`);

let message: Anthropic.Message | Anthropic.Beta.BetaMessage;
try {
  message = await client.beta.messages.create({
    ...request,
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: FALLBACK_MODEL }],
  });
} catch (err) {
  if (err instanceof Anthropic.BadRequestError) {
    console.warn("Yedek model parametresi reddedildi, sade istekle devam ediliyor.");
    message = await client.messages.create(request);
  } else if (err instanceof Anthropic.AuthenticationError) {
    console.error("Kimlik dogrulanamadi. ANTHROPIC_API_KEY tanimla.");
    process.exit(1);
  } else {
    throw err;
  }
}

if (message.stop_reason === "refusal") {
  console.error("Model istegi reddetti:", message.stop_details?.explanation ?? "");
  process.exit(1);
}

const raw = message.content
  .filter((b): b is Anthropic.TextBlock => b.type === "text")
  .map((b) => b.text)
  .join("")
  .trim();

const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, "");
let notes: Record<string, string>;
try {
  notes = JSON.parse(json) as Record<string, string>;
} catch {
  console.error("Yanit JSON olarak okunamadi:\n" + raw.slice(0, 400));
  process.exit(1);
}

let yazildi = 0;
for (const { e } of targets) {
  const note = notes[e.id];
  if (typeof note === "string" && note.trim() !== "") {
    e.aiResult = note.trim();
    yazildi++;
  }
}

week.updatedAt = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(week, null, 2) + "\n", "utf8");

const usage = message.usage;
const logged = logUsage("sonuc", message.model ?? MODEL, usage.input_tokens, usage.output_tokens, yazildi);
console.log(`${yazildi}/${targets.length} olaya sonuc yorumu yazildi.`);
console.log(`  token  : ${usage.input_tokens} giris, ${usage.output_tokens} cikis`);
console.log(`  maliyet: ${logged.cost.toFixed(4)} $`);
for (const { e } of targets) {
  if (e.aiResult) console.log(`\n  ${e.title}\n    ${e.aiResult}`);
}
