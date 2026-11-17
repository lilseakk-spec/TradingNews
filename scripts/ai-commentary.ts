/**
 * Haftanin yapay zeka yorumunu uretir ve hafta dosyasina isler.
 *
 *   node scripts/ai-commentary.ts                 # icinde bulunulan hafta
 *   node scripts/ai-commentary.ts --next           # on izleme haftasi
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

/**
 * Hata izi.
 *
 * Actions kayitlarina erisimimiz yok ve adim continue-on-error oldugu
 * icin bir hata disaridan "basarili" gorunuyor. Sebep dosyaya yazilir,
 * commit adimi onu da alir.
 */
const ERROR_FILE = path.join(process.cwd(), "src", "data", "ai-last-error.txt");
function iz(mesaj: string): void {
  try {
    fs.mkdirSync(path.dirname(ERROR_FILE), { recursive: true });
    fs.writeFileSync(ERROR_FILE, `${new Date().toISOString()}  ai-commentary
${mesaj}
`, "utf8");
  } catch {
    // Yazilamadiysa yapacak bir sey yok.
  }
}
process.on("uncaughtException", (err) => {
  iz(`uncaught: ${(err as Error).message}
${(err as Error).stack ?? ""}`.slice(0, 1500));
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  iz(`unhandled: ${String(err)}`.slice(0, 1500));
  process.exit(1);
});
import Anthropic from "@anthropic-ai/sdk";
import { logUsage } from "./log-usage.ts";
import type { AiCommentary, WeekData } from "../src/lib/types.ts";
import { CATEGORY_TR } from "../src/lib/labels.ts";
import { activeWeekRange, addDays, trTodayISO, weekRange } from "../src/lib/weeks.ts";
import { instrumentName } from "../src/lib/instruments.ts";
import { shortDate } from "../src/lib/weeks.ts";

const WEEKS_DIR = path.join(process.cwd(), "src", "data", "weeks");
const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || "claude-opus-4-8";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const idArg = args[args.indexOf("--id") + 1];

/**
 * Hangi hafta yorumlanacak.
 *
 * Varsayilan ARTIK "en yeni dosya" degil, icinde bulunulan hafta.
 * Onceki davranis sessiz bir hataya yol aciyordu: on izleme dosyasi
 * her zaman daha yeni oldugu icin "bu haftanin yorumu" adimi gelecek
 * haftayi yorumluyor, icinde bulunulan hafta gunlerce guncellenmeden
 * kaliyordu. Hafta artik takvimden hesaplanir, dosya adlarindan degil.
 */
const weekId = args.includes("--id") && idArg
  ? idArg
  : args.includes("--next")
    ? weekRange(addDays(activeWeekRange(trTodayISO()).start, 7)).id
    : activeWeekRange(trTodayISO()).id;
const weekFile = path.join(WEEKS_DIR, `${weekId}.json`);
if (!fs.existsSync(weekFile)) {
  console.error(`Hafta dosyasi bulunamadi: ${weekId}`);
  process.exit(1);
}

const week = JSON.parse(fs.readFileSync(weekFile, "utf8")) as WeekData;
/** On izleme haftasi ayri kalemde izlenir. */
const weekJob = week.preliminary ? "on-izleme" : "hafta";

// ── Istek metni ─────────────────────────────────────────────────

interface EventBriefOut {
  what?: string;
  why?: string;
  above?: string;
  below?: string;
  watch?: string;
}

const SYSTEM = `Sen bir piyasa yapisi analistisin. Turkiye'deki aktif trader'lar icin haftalik oynaklik brifingi yaziyorsun. Okuyucu kitlen agirlikla kripto ve endeks islemi yapiyor, yaninda forex ve emtia da takip ediyor.

Kurallar:
- Turkce yaz. Kisa, somut, teknik. Dolgu cumle yok, giris-gelisme-sonuc yok.
- Enstrumanlari sembolleriyle an: BTCUSD, US100, DXY, XAUUSD gibi.
- Yalnizca sana verilen takvim olaylarina dayan. Olmayan veri, rakam ya da olay uydurma.
- Fiyat hedefi, seviye tahmini ya da al/sat onerisi verme. Ne izlenecegini ve neyin tezi bozacagini yaz.
- Mekanizmayi soyle: hangi veri hangi kanaldan hangi pariteye gecer. "Volatilite artabilir" gibi bos ifade kullanma.
- Her cumle bir bilgi tasisin. Ayni seyi iki kez soyleme.
- Olay brifinglerinde YUZEYSEL OLMA. "Volatilite artabilir", "yakindan izlenmeli" gibi
  bos cumleler yasak. Her alan kendi isini yapsin: what gercekten ne olculdugunu
  anlatsin (kisaltmalari ac), why bu haftaya ozgu baglami versin, above/below iki
  yonlu sonucun mekanizmasini somut yazsin.
- above ve below birbirinin tersi olsun ama ikisi de kendi basina okunabilsin;
  "tersi olur" deme, mekanizmayi tekrar kur.

Cikti yalnizca gecerli JSON olsun. JSON disinda hicbir metin, kod bloku ya da aciklama yazma.`;

interface EventRef {
  id: string;
  line: string;
}

const refs: EventRef[] = [];
/** Brifing yalnizca etkisi anlamli olaylara yazilir; butce ve derinlik oraya gitsin. */
const briefIds: string[] = [];
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
    if (e.impact >= 2) briefIds.push(e.id);
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
  "eventBriefs": {
    "olay_id": {
      "what": "Bu veri NE olcuyor, sade dille. Kisaltmayi ac. Trader olmayan biri de anlasin. 1 cumle.",
      "why": "Bu hafta NEDEN onemli: hangi baglamda okunacak, onceki veriyle ya da merkez bankasi duruşuyla iliskisi ne. 1-2 cumle.",
      "above": "Beklentinin USTUNDE gelirse: hangi mekanizmayla hangi pariteye gecer, yon ne. Somut ol.",
      "below": "Beklentinin ALTINDA gelirse: ayni sekilde mekanizma ve yon.",
      "watch": "Asil izlenecek detay: alt kalem, revizyon, es zamanli veri ya da bu okumayi bozacak gelisme. 1 cumle."
    }
  }
}

scenarios tam uc eleman olsun: biri yukari, biri asagi, biri notr.
dayFocus anahtarlari sunlardan secilecek: ${week.days.filter((d) => d.events.length > 0).map((d) => d.key).join(", ")}
eventBriefs YALNIZCA asagida listelenen id'ler icin giris icersin. Listede
olmayan olaylar icin giris yazma. Her giris bir NESNE olsun (duz metin degil):
what, why, above, below, watch alanlariyla. Kullanilacak id'ler:
${briefIds.map((x) => x).join("\n")}`;

if (dry) {
  console.log("=== SYSTEM ===\n" + SYSTEM + "\n\n=== USER ===\n" + USER);
  console.log(`\n(${refs.length} olay, ${week.days.length} gun)`);
  process.exit(0);
}

// ── Model cagrisi ───────────────────────────────────────────────

interface AiResponse extends Omit<AiCommentary, "generatedBy" | "generatedAt"> {
  dayFocus?: Record<string, string>;
  eventBriefs?: Record<string, EventBriefOut | string>;
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

console.log(`Model: ${MODEL}  ·  hafta: ${week.id}  ·  ${refs.length} olay`);

let message: Anthropic.Message | Anthropic.Beta.BetaMessage;
try {
  // Guvenlik siniflandiricisi istegi reddederse ayni istek yedek
  // modelde yeniden calisir.
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
    console.error(
      "Kimlik dogrulanamadi. ANTHROPIC_API_KEY tanimla ya da 'ant auth login' ile giris yap.",
    );
    process.exit(1);
  } else {
    throw err;
  }
}

if (message.stop_reason === "max_tokens") {
  iz("stop_reason=max_tokens; JSON yarim kaldi.");
  console.error("Yanit token sinirina takildi; JSON yarim kaldi.");
  process.exit(1);
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
let plain = 0;
let focused = 0;
const days = week.days.map((day) => {
  const focus = parsed.dayFocus?.[day.key];
  if (focus) focused++;
  return {
    ...day,
    focus: focus ?? day.focus,
    events: day.events.map((e) => {
      const raw = parsed.eventBriefs?.[e.id];
      // Model bazen nesne yerine tek cumle donduruyor; o zaman eski
      // bicime dusulur, brifing uydurulmaz.
      if (typeof raw === "string") {
        const line = raw.trim();
        if (line) plain++;
        return { ...e, ai: line || e.ai, brief: e.brief };
      }
      const brief =
        raw && raw.what && raw.why && raw.above && raw.below
          ? {
              what: raw.what.trim(),
              why: raw.why.trim(),
              above: raw.above.trim(),
              below: raw.below.trim(),
              watch: raw.watch?.trim() || undefined,
            }
          : undefined;
      if (brief) noted++;
      return { ...e, brief: brief ?? e.brief };
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
console.log(`  brifing  : ${noted}/${refs.length}` + (plain > 0 ? `  (${plain} tanesi duz metin geldi)` : ""));
if (noted === 0) {
  console.warn("  UYARI: hic brifing uretilmedi. Modelin dondugu ust anahtarlar: " + Object.keys(parsed).join(", "));
}
const logged = logUsage(weekJob, message.model ?? MODEL, usage.input_tokens, usage.output_tokens, refs.length);
console.log(`  token    : ${usage.input_tokens} giris, ${usage.output_tokens} cikis`);
console.log(`  maliyet  : ${logged.cost.toFixed(4)} $`);
