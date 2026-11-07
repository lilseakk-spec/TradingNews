/**
 * Haftanin yapay zeka yorumunu uretir ve hafta dosyasina isler.
 *
 *   node scripts/ai-commentary.ts                 # en yeni haftayi yorumlar
 *   node scripts/ai-commentary.ts --id 2026-W46
 *   node scripts/ai-commentary.ts --dry           # istek metnini yazar, cagri yapmaz
 *
 * Uretilenler:
 *  - hafta tezi, risk rejimi, uc senaryo, izleme listesi, riskler
 *  - her gun icin tek cumlelik odak
 *  - her haber icin tek cumlelik yorum
 *
 * Anahtar: ANTHROPIC_API_KEY ortam degiskeni ya da 'ant auth login' profili.
 */

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { AiCommentary, WeekData } from "../src/lib/types.ts";
import { CATEGORY_TR } from "../src/lib/labels.ts";
import { instrumentName } from "../src/lib/instruments.ts";
import { shortDate } from "../src/lib/weeks.ts";

const WEEKS_DIR = path.join(process.cwd(), "src", "data", "weeks");
const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || "claude-opus-4-8";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const idArg = args[args.indexOf("--id") + 1];

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

const week = JSON.parse(fs.readFileSync(weekFile, "utf8")) as WeekData;

// ── Istek metni ─────────────────────────────────────────────────

const SYSTEM = `Sen bir piyasa yapisi analistisin. Turkiye'deki aktif trader'lar icin haftalik oynaklik brifingi yaziyorsun. Okuyucu kitlen agirlikla kripto ve endeks islemi yapiyor, yaninda forex ve emtia da takip ediyor.

Kurallar:
- Turkce yaz. Kisa, somut, teknik. Dolgu cumle yok, giris-gelisme-sonuc yok.
- Enstrumanlari sembolleriyle an: BTCUSD, US100, DXY, XAUUSD gibi.
- Yalnizca sana verilen takvim olaylarina dayan. Olmayan veri, rakam ya da olay uydurma.
- Fiyat hedefi, seviye tahmini ya da al/sat onerisi verme. Ne izlenecegini ve neyin tezi bozacagini yaz.
- Mekanizmayi soyle: hangi veri hangi kanaldan hangi pariteye gecer. "Volatilite artabilir" gibi bos ifade kullanma.
- Her cumle bir bilgi tasisin. Ayni seyi iki kez soyleme.

Cikti yalnizca gecerli JSON olsun. JSON disinda hicbir metin, kod bloku ya da aciklama yazma.`;

interface EventRef {
  id: string;
  line: string;
}

const refs: EventRef[] = [];
const dayLines: string[] = [];

for (const day of week.days) {
  if (day.events.length === 0) {
    dayLines.push(`${day.key} | ${day.label} ${shortDate(day.date)} | olay yok`);
    continue;
  }
  dayLines.push(`${day.key} | ${day.label} ${shortDate(day.date)} | ${day.events.length} olay`);
  for (const e of day.events) {
    const pairs = e.affected
      .map((a) => `${a.symbol}(${a.direction[0]}${a.strength})`)
      .join(" ");
    const data = [
      e.forecast ? `beklenti ${e.forecast}` : null,
      e.previous ? `onceki ${e.previous}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const line = [
      `  id=${e.id}`,
      `${e.time ?? "gun ici"}`,
      `oynaklik ${e.volatility}`,
      `etki ${e.impact}/3`,
      e.region,
      CATEGORY_TR[e.category],
      e.title,
      e.also?.length ? `(ayni anda: ${e.also.join("; ")})` : null,
      data || null,
      `pariteler: ${pairs}`,
    ]
      .filter(Boolean)
      .join(" | ");
    refs.push({ id: e.id, line });
    dayLines.push(line);
  }
}

const universe = [...new Set(week.days.flatMap((d) => d.events.flatMap((e) => e.affected.map((a) => a.symbol))))]
  .map((s) => `${s} = ${instrumentName(s)}`)
  .join("\n");

const USER = `Hafta: ${week.label} (${week.id}). Islem haftasi pazar aksami acilistan cuma kapanisa.

Parite sozlugu:
${universe}

Takvim (yon kodu: y=yukari, a=asagi, v=iki yonlu; sayi=etki siddeti 1-3):
${dayLines.join("\n")}

Bu takvime bakarak asagidaki JSON'u uret:

{
  "headline": "Haftanin tek cumlelik mansedi. En fazla 70 karakter, buyuk harf kullanma, nokta koyma.",
  "thesis": "Haftanin tezi. 3-4 cumle. Hangi olay haftanin merkezinde, hangi kanaldan hangi varliklara gecer, kripto ve endeks tarafinda ne anlama gelir.",
  "regime": { "label": "Rejimi tek cumlede acikla", "tone": "risk-on | risk-off | karisik" },
  "scenarios": [
    { "name": "Senaryo adi, 2-4 kelime", "trigger": "Hangi veri nasil gelirse, tek cumle", "reaction": "Hangi paritelerde ne beklenir, tek cumle", "bias": "yukari | asagi | notr" }
  ],
  "watchlist": ["Haftanin en kritik 4-6 sembolu, yalnizca parite sozlugunden"],
  "risks": ["Tezi bozacak 2-3 risk, her biri tek cumle"],
  "dayFocus": { "gun_anahtari": "O gunun odagi, 1-2 cumle. Ilk cumle o gunu neyin belirledigini soylesin, ikincisi hangi paritede ne izlenecegini. Gunun kendi hikayesi olsun, hafta tezini tekrarlamasin. Olaysiz gunler icin bu anahtari hic yazma." },
  "eventNotes": { "olay_id": "O haber icin tek cumlelik yorum: neden onemli ve hangi paritede izlenir. En fazla 180 karakter." }
}

scenarios tam uc eleman olsun: biri yukari, biri asagi, biri notr.
dayFocus anahtarlari sunlardan secilecek: ${week.days.filter((d) => d.events.length > 0).map((d) => d.key).join(", ")}
eventNotes her olay icin bir giris icersin. Kullanilacak id'ler:
${refs.map((r) => r.id).join("\n")}`;

if (dry) {
  console.log("=== SYSTEM ===\n" + SYSTEM + "\n\n=== USER ===\n" + USER);
  console.log(`\n(${refs.length} olay, ${week.days.length} gun)`);
  process.exit(0);
}

// ── Model cagrisi ───────────────────────────────────────────────

interface AiResponse extends Omit<AiCommentary, "generatedBy" | "generatedAt"> {
  dayFocus?: Record<string, string>;
  eventNotes?: Record<string, string>;
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

console.log(`Model: ${MODEL}  ·  hafta: ${week.id}  ·  ${refs.length} olay`);

let message: Anthropic.Message | Anthropic.Beta.BetaMessage;
try {
  // Guvenlik siniflandiricisi istegi reddederse ayni istek yedek
  // modelde yeniden calisir.
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
    console.error(
      "Kimlik dogrulanamadi. ANTHROPIC_API_KEY tanimla ya da 'ant auth login' ile giris yap.",
    );
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

const parsed = parseJson(text);

function parseJson(raw: string): AiResponse {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) {
    console.error("Yanitta JSON bulunamadi. Gelen metin:\n" + raw.slice(0, 600));
    process.exit(1);
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as AiResponse;
  } catch (err) {
    console.error("JSON ayristirilamadi:", (err as Error).message);
    console.error(cleaned.slice(0, 600));
    process.exit(1);
  }
}

// ── Hafta dosyasina isle ────────────────────────────────────────

const ai: AiCommentary = {
  headline: parsed.headline ?? "Yorum uretilemedi",
  thesis: parsed.thesis ?? "",
  regime: parsed.regime ?? { label: "belirlenmedi", tone: "karisik" },
  scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : [],
  watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : [],
  risks: Array.isArray(parsed.risks) ? parsed.risks : [],
  generatedBy: message.model ?? MODEL,
  generatedAt: new Date().toISOString(),
};

let noted = 0;
let focused = 0;
const days = week.days.map((day) => {
  const focus = parsed.dayFocus?.[day.key];
  if (focus) focused++;
  return {
    ...day,
    focus: focus ?? day.focus,
    events: day.events.map((e) => {
      const note = parsed.eventNotes?.[e.id];
      if (note) noted++;
      return { ...e, ai: note ?? e.ai };
    }),
  };
});

const out: WeekData = { ...week, ai, days, updatedAt: new Date().toISOString() };
fs.writeFileSync(weekFile, JSON.stringify(out, null, 2) + "\n", "utf8");

const usage = message.usage;
console.log(`\nYazildi: ${path.relative(process.cwd(), weekFile)}`);
console.log(`  manset   : ${ai.headline}`);
console.log(`  rejim    : ${ai.regime.tone} — ${ai.regime.label}`);
console.log(`  senaryo  : ${ai.scenarios.length}`);
console.log(`  gun odagi: ${focused}/${week.days.filter((d) => d.events.length > 0).length}`);
console.log(`  olay notu: ${noted}/${refs.length}`);
console.log(
  `  token    : ${usage.input_tokens} giris, ${usage.output_tokens} cikis`,
);
