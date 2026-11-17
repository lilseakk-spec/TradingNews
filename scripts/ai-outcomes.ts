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

/** Hata izi: adim continue-on-error oldugu icin sebep dosyaya dusmeli. */
const ERROR_FILE = path.join(process.cwd(), "src", "data", "ai-last-error.txt");
function iz(mesaj: string): void {
  try {
    fs.mkdirSync(path.dirname(ERROR_FILE), { recursive: true });
    fs.writeFileSync(ERROR_FILE, `${new Date().toISOString()}  ai-outcomes
${mesaj}
`, "utf8");
  } catch {
    // Yazilamadiysa yapacak bir sey yok.
  }
}
process.on("uncaughtException", (err) => {
  iz(`uncaught: ${(err as Error).message}`.slice(0, 1200));
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  iz(`unhandled: ${String(err)}`.slice(0, 1200));
  process.exit(1);
});
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
    if (e.resultBrief && !force) continue;
    targets.push({ day: d.label ?? d.key, e });
  }
}

if (targets.length === 0) {
  console.log("Yorumlanacak yeni sonuc yok.");
  process.exit(0);
}

const SYSTEM = `Sen ekonomik veri aciklamalarini degerlendiren bir analistsin. Okuyucun gun ici islem yapan bir trader.

Her olay icin "ne oldu, ne bitti" brifingi yaz. Dort alan:

- headline: Tek cumlede ne oldu. Manset gibi, sayiyi icersin.
- detail: Sayilarla ne geldi. Hangi olcu, ne kadar sapti, alt kalemler ne dedi.
  Birden fazla olcu varsa aralarindaki ayrismaya dikkat cek.
- meaning: Bunun anlami. Hangi mekanizmayla hangi pariteye gecer, hangi tarafi
  guclendirir. Merkez bankasi beklentisine etkisi varsa soyle.
- next: Bundan sonra ne izlenecek. Bir sonraki ilgili veri, revizyon riski ya da
  bu okumayi teyit/iptal edecek gelisme.

Kurallar:
- Turkce yaz. Her alan en fazla iki cumle, dolgu yok.
- YUZEYSEL OLMA. "Piyasa tepki verdi", "izlenmeli" gibi bos ifadeler yasak.
- FIYATIN NASIL TEPKI VERDIGINI BILMIYORSUN. Elinde fiyat verisi yok.
  "Altin yukseldi", "dolar deger kazandi" YAZMA. Yalnizca verinin ne soyledigini
  ve mantiksal yonunu yaz.
- Surpriz kucukse bunu acikca soyle; her veriden hikaye cikarma.
- Elinde olmayan olcu varsa (ornegin manset rakami gelmemisse) bunu belirt,
  tahmin etme.
- Yatirim tavsiyesi, hedef fiyat ve seviye verme.

Cikti yalnizca gecerli JSON:
{ "olay_id": { "headline": "...", "detail": "...", "meaning": "...", "next": "..." } }
JSON disinda hicbir metin yazma.`;

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
  // Yuksek caba + yapisal brifing cok dusunme tokeni yakiyor ve bunlar
  // cikis olarak sayiliyor; 32000'de yanit yarida kesiliyordu. Akis
  // devrede oldugu icin sure sinirina takilmiyoruz.
  max_tokens: 64000,
  system: SYSTEM,
  thinking: { type: "adaptive" as const },
  output_config: { effort: "high" as const },
  messages: [{ role: "user" as const, content: USER }],
};

console.log(`Model: ${MODEL}  ·  hafta: ${weekId}  ·  ${targets.length} olay`);

let message: Anthropic.Message | Anthropic.Beta.BetaMessage;
try {
  // Akis sart: max_tokens yuksek oldugunda SDK, istegin 10 dakikayi
  // asabilecegini hesaplayip akissiz cagriyi reddediyor.
  message = await client.beta.messages
    .stream({
      ...request,
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: FALLBACK_MODEL }],
    })
    .finalMessage();
} catch (err) {
  if (err instanceof Anthropic.BadRequestError) {
    console.warn("Yedek model parametresi reddedildi, sade istekle devam ediliyor.");
    message = await client.messages.stream(request).finalMessage();
  } else if (err instanceof Anthropic.AuthenticationError) {
    console.error("Kimlik dogrulanamadi. ANTHROPIC_API_KEY tanimla.");
    process.exit(1);
  } else {
    throw err;
  }
}

if (message.stop_reason === "max_tokens") {
  console.error("Yanit token sinirina takildi; JSON yarim kaldi.");
  process.exit(1);
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
interface ResultBriefOut {
  headline?: string;
  detail?: string;
  meaning?: string;
  next?: string;
}

let notes: Record<string, ResultBriefOut>;
try {
  notes = JSON.parse(json) as Record<string, ResultBriefOut>;
} catch {
  console.error("Yanit JSON olarak okunamadi:\n" + raw.slice(0, 400));
  process.exit(1);
}

let yazildi = 0;
for (const { e } of targets) {
  const n = notes[e.id];
  if (n?.headline && n.detail && n.meaning) {
    e.resultBrief = {
      headline: n.headline.trim(),
      detail: n.detail.trim(),
      meaning: n.meaning.trim(),
      next: n.next?.trim() || undefined,
    };
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
