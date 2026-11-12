/**
 * COT yorumunu uretir ve rapora isler.
 *
 *   node scripts/ai-cot.ts                    # izleme listesindekiler
 *   node scripts/ai-cot.ts --symbol BTCUSD    # tek parite
 *   node scripts/ai-cot.ts --dry              # istek metnini yazar
 *
 * Butce: yalnizca secilen pariteler yorumlanir ve hepsi TEK cagrida
 * islenir. Yirmi bir piyasanin tamami her hafta yorumlansa gereksiz
 * maliyet olurdu; hangi paritelerin yorumlanacagi
 * src/data/cot-watch.json dosyasindan secilir.
 */

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { instrumentBias, stance, type CotEntry, type CotReport } from "../src/lib/cot.ts";
import { instrumentName } from "../src/lib/instruments.ts";

const COT_FILE = path.join(process.cwd(), "src", "data", "cot", "latest.json");
const WATCH_FILE = path.join(process.cwd(), "src", "data", "cot-watch.json");
const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || "claude-opus-4-8";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const symbolArg = args.includes("--symbol") ? args[args.indexOf("--symbol") + 1] : undefined;

if (!fs.existsSync(COT_FILE)) {
  console.error("COT verisi yok. Once 'npm run cot' calistir.");
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(COT_FILE, "utf8")) as CotReport;

let watch: string[];
if (symbolArg) {
  watch = [symbolArg.toUpperCase()];
} else {
  try {
    const cfg = JSON.parse(fs.readFileSync(WATCH_FILE, "utf8")) as { symbols?: string[] };
    watch = Array.isArray(cfg.symbols) ? cfg.symbols : [];
  } catch {
    watch = [];
  }
}

const all = watch.includes("*");
const targets = all ? report.entries : report.entries.filter((e) => watch.includes(e.symbol));
const missing = all
  ? []
  : watch.filter((s) => !report.entries.some((e) => e.symbol === s));
for (const s of missing) console.warn(`  uyari: ${s} COT raporunda yok, atlandi.`);

if (targets.length === 0) {
  console.error("Yorumlanacak parite yok. src/data/cot-watch.json icine sembol ekle.");
  process.exit(1);
}

// ── Istek metni ─────────────────────────────────────────────────

const SYSTEM = `Sen COT (Commitments of Traders) raporunu okuyan bir piyasa yapisi analistisin. Okuyucun gun ici islem yapan bir trader; ICT yaklasimina asina.

COT haftalik bir veridir: o haftanin SALI kapanisini gosterir, cuma yayinlanir. Gun ici sinyal degildir ama haftanin kurumsal yaslanmasini verir.

Her parite icin IKI SEVIYE birden yaz:
1. HAFTALIK TABLO: buyuk spekulator ve ticari taraf ne yapti, haftalik degisim neyi gosteriyor, ikisi ayrisiyor mu, pozisyon donem araliginin neresinde.
2. GUN ICI KARSILIGI: bu yaslanma gun ici islemde hangi yondeki kurulumun arkasinda akinti oldugunu soyluyor ve neyin bu okumayi bozacagi.

Kurallar:
- Turkce yaz. HER PARITE ICIN EN FAZLA UC CUMLE. Kisa ve dolu tut.
- Yalnizca verilen sayilara dayan. Fiyat seviyesi, formasyon ya da verilmeyen veri uydurma.
- Fiyat hedefi, giris-cikis seviyesi ve al/sat onerisi verme.
- Donem endeksi 85 ustu ya da 15 alti ise kalabalik pozisyon ve ters hareket riskini an.
- Ters okumali enstrumanlarda (yen, frank, kanada dolari, tahvil) yonu enstrumana cevirerek yaz.

Cikti yalnizca gecerli JSON: { "SEMBOL": "yorum" }. JSON disinda hicbir metin yazma.`;

function describe(e: CotEntry): string {
  const raw = stance(e);
  const bias = instrumentBias(e);
  const lines = [
    `${e.symbol} (${instrumentName(e.symbol)}) — CFTC piyasasi: ${e.market}`,
    `  vadeli islemdeki ham durus: ${raw.label}`,
    e.inverse ? `  TERS OKUMA: ${e.inverseNote}. Enstruman icin: ${bias.label}` : null,
    `  buyuk spekulator: uzun ${e.noncomm.long}, kisa ${e.noncomm.short}, net ${e.noncomm.net}, haftalik degisim ${e.noncomm.change}`,
    `  ticari (hedge): uzun ${e.comm.long}, kisa ${e.comm.short}, net ${e.comm.net}, haftalik degisim ${e.comm.change}`,
    `  kucuk yatirimci: net ${e.small.net}, haftalik degisim ${e.small.change}`,
    `  acik pozisyon: ${e.openInterest}, haftalik degisim ${e.openInterestChange}`,
    e.index !== null
      ? `  net pozisyonun son ${Math.round(e.weeks / 52)} yildaki yeri: ${e.index}/100 (0 = donemin en kisasi, 100 = en uzunu)`
      : null,
  ];
  return lines.filter(Boolean).join("\n");
}

const USER = `COT raporu tarihi: ${report.date} (o haftanin salisi).

${targets.map(describe).join("\n\n")}

Yukaridaki her parite icin yorum uret. Kullanilacak anahtarlar tam olarak sunlar:
${targets.map((t) => t.symbol).join("\n")}`;

if (dry) {
  console.log("=== SYSTEM ===\n" + SYSTEM + "\n\n=== USER ===\n" + USER);
  console.log(`\n(${targets.length} parite)`);
  process.exit(0);
}

// ── Model cagrisi ───────────────────────────────────────────────

const client = new Anthropic();

const request = {
  model: MODEL,
  max_tokens: 16000,
  system: SYSTEM,
  thinking: { type: "adaptive" as const },
  output_config: { effort: "high" as const },
  messages: [{ role: "user" as const, content: USER }],
};

console.log(`Model: ${MODEL}  ·  rapor: ${report.date}  ·  ${targets.length} parite`);
console.log(`  ${targets.map((t) => t.symbol).join(", ")}`);

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

const text = message.content
  .filter((b): b is Anthropic.TextBlock => b.type === "text")
  .map((b) => b.text)
  .join("\n")
  .trim();

const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
const start = cleaned.indexOf("{");
const end = cleaned.lastIndexOf("}");
if (start < 0 || end < start) {
  console.error("Yanitta JSON bulunamadi:\n" + text.slice(0, 500));
  process.exit(1);
}

let parsed: Record<string, string>;
try {
  parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, string>;
} catch (err) {
  console.error("JSON ayristirilamadi:", (err as Error).message);
  console.error(cleaned.slice(0, 500));
  process.exit(1);
}

let written = 0;
for (const e of report.entries) {
  const note = (parsed[e.symbol] ?? "").trim();
  if (note) {
    e.ai = note;
    written++;
  } else if (watch.includes(e.symbol)) {
    console.warn(`  uyari: ${e.symbol} icin yorum gelmedi.`);
  }
}

report.aiSymbols = targets.map((t) => t.symbol);
report.aiGeneratedBy = message.model ?? MODEL;
report.aiGeneratedAt = new Date().toISOString();

fs.writeFileSync(COT_FILE, JSON.stringify(report, null, 2) + "\n", "utf8");

console.log(`\nYazildi: ${path.relative(process.cwd(), COT_FILE)}`);
console.log(`  ${written}/${targets.length} parite yorumlandi`);
console.log(`  token: ${message.usage.input_tokens} giris, ${message.usage.output_tokens} cikis`);
