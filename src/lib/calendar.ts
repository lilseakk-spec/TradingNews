import type { AffectedInstrument, Impact, NewsEvent } from "./types.ts";
import { classify } from "./impact.ts";

/** Uygulamanin tek saat dilimi. Takvimdeki her saat TRT. */
export const TR_TZ = "Europe/Istanbul";

/** Ucretsiz, anahtarsiz haftalik ekonomik takvim feed'i. */
export const DEFAULT_FEED = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

export interface RawFeedItem {
  title: string;
  /** Feed bu alanda para birimi kodu tasir: USD, EUR, ... */
  country: string;
  date: string;
  impact: string;
  forecast?: string;
  previous?: string;
}

const REGION_TR: Record<string, string> = {
  USD: "ABD",
  EUR: "Euro Bölgesi",
  GBP: "İngiltere",
  JPY: "Japonya",
  CHF: "İsviçre",
  AUD: "Avustralya",
  NZD: "Yeni Zelanda",
  CAD: "Kanada",
  CNY: "Çin",
  TRY: "Türkiye",
  ALL: "Küresel",
};

export function regionName(currency: string): string {
  return REGION_TR[currency?.toUpperCase()] ?? currency ?? "Küresel";
}

// ── Baslik Turkcelestirme ───────────────────────────────────────

/** "... m/m" gibi donem ekleri. */
const PERIOD: [RegExp, string][] = [
  [/\s+m\/m$/i, " (aylık)"],
  [/\s+y\/y$/i, " (yıllık)"],
  [/\s+q\/q$/i, " (çeyreklik)"],
  [/\s+q\/y$/i, " (yıllık)"],
];

/** "Prelim ..." gibi nitelik onekleri. */
const QUALIFIER: [RegExp, string][] = [
  [/^prelim\s+/i, "Öncü "],
  [/^preliminary\s+/i, "Öncü "],
  [/^flash\s+/i, "Öncü "],
  [/^advance\s+/i, "Öncü "],
  [/^final\s+/i, "Nihai "],
  [/^revised\s+/i, "Revize "],
];

/** Ulke onekleri: "German Retail Sales" -> "Almanya ...". */
const COUNTRY_PREFIX: [RegExp, string][] = [
  [/^german\s+/i, "Almanya "],
  [/^italian\s+/i, "İtalya "],
  [/^french\s+/i, "Fransa "],
  [/^spanish\s+/i, "İspanya "],
  [/^swiss\s+/i, "İsviçre "],
  [/^tokyo\s+/i, "Tokyo "],
];

/** Kurum onekleri: "BOE Monetary Policy Report" -> "BoE ...". */
const INSTITUTION_PREFIX: [RegExp, string][] = [
  [/^fomc\s+/i, "Fed "],
  [/^fed\s+/i, "Fed "],
  [/^ecb\s+/i, "ECB "],
  [/^boe\s+/i, "BoE "],
  [/^boj\s+/i, "BoJ "],
  [/^boc\s+/i, "BoC "],
  [/^rba\s+/i, "RBA "],
  [/^rbnz\s+/i, "RBNZ "],
  [/^snb\s+/i, "SNB "],
  [/^mpc\s+/i, "BoE MPC "],
];

/** Konusmaci unvanlari. */
const SPEAKER_TITLE: [RegExp, string][] = [
  [/^fed chair\s+/i, "Fed Başkanı "],
  [/^german buba president\s+/i, "Bundesbank Başkanı "],
  [/^rba deputy gov\s+/i, "RBA Başkan Yardımcısı "],
  [/^gov board member\s+/i, "SNB Yönetim Kurulu üyesi "],
  [/^fomc member\s+/i, "Fed üyesi "],
  [/^boe gov\s+/i, "BoE Başkanı "],
  [/^mpc member\s+/i, "BoE MPC üyesi "],
  [/^ecb president\s+/i, "ECB Başkanı "],
  [/^ecb member\s+/i, "ECB üyesi "],
  [/^boj gov\s+/i, "BoJ Başkanı "],
  [/^rba gov\s+/i, "RBA Başkanı "],
  [/^boc gov\s+/i, "BoC Başkanı "],
  [/^snb chairman\s+/i, "SNB Başkanı "],
  [/^rbnz gov\s+/i, "RBNZ Başkanı "],
  [/^treasury sec\s+/i, "Hazine Bakanı "],
];

/** Cekirdek terim sozlugu: nitelik ve donem ekleri soyulduktan sonra. */
const TERMS: [RegExp, string][] = [
  // Merkez bankasi
  [/^fomc statement$/i, "Fed faiz kararı ve metni"],
  [/^federal funds rate$/i, "Fed politika faizi"],
  [/^fomc economic projections$/i, "Fed ekonomik projeksiyonları"],
  [/^fomc meeting minutes$/i, "Fed toplantı tutanakları"],
  [/^meeting minutes$/i, "Toplantı tutanakları"],
  [/^main refinancing rate$/i, "ECB politika faizi"],
  [/^deposit facility rate$/i, "ECB mevduat faizi"],
  [/^ecb monetary policy statement$/i, "ECB para politikası metni"],
  [/^official bank rate$/i, "BoE politika faizi"],
  [/^mpc official bank rate votes$/i, "BoE faiz oylaması"],
  [/^monetary policy summary$/i, "Para politikası özeti"],
  [/^monetary policy report$/i, "Para politikası raporu"],
  [/^boj policy rate$/i, "BoJ politika faizi"],
  [/^boj outlook report$/i, "BoJ görünüm raporu"],
  [/^cash rate$/i, "RBA politika faizi"],
  [/^rba (monetary policy statement|rate statement)$/i, "RBA para politikası metni"],
  [/^overnight rate$/i, "BoC politika faizi"],
  [/^official cash rate$/i, "RBNZ politika faizi"],
  [/^monetary policy statement$/i, "Para politikası metni"],
  [/^rate statement$/i, "Faiz kararı metni"],
  [/^press conference$/i, "Basın toplantısı"],
  [/^interest rate decision$/i, "Faiz kararı"],

  // Enflasyon
  [/^core cpi( flash estimate)?$/i, "Çekirdek TÜFE"],
  [/^cpi( flash estimate)?$/i, "TÜFE"],
  [/^cpi data$/i, "TÜFE verisi"],
  [/^core hicp$/i, "Çekirdek HICP enflasyonu"],
  [/^hicp$/i, "HICP enflasyonu"],
  [/^core pce price index$/i, "Çekirdek PCE enflasyonu"],
  [/^pce price index$/i, "PCE enflasyonu"],
  [/^core ppi$/i, "Çekirdek ÜFE"],
  [/^ppi$/i, "ÜFE"],
  [/^(uom )?inflation expectations$/i, "Enflasyon beklentisi"],
  [/^mi inflation gauge$/i, "MI enflasyon göstergesi"],

  // Istihdam
  [/^non-?farm payrolls$/i, "Tarım dışı istihdam"],
  [/^non-?farm employment change$/i, "Tarım dışı istihdam"],
  [/^adp non-?farm employment change$/i, "ADP özel sektör istihdamı"],
  [/^employment change$/i, "İstihdam değişimi"],
  [/^unemployment rate$/i, "İşsizlik oranı"],
  [/^unemployment claims$/i, "Haftalık işsizlik başvuruları"],
  [/^jolts job openings$/i, "JOLTS açık iş sayısı"],
  [/^average hourly earnings$/i, "Ortalama saatlik kazanç"],
  [/^average cash earnings$/i, "Ortalama nakit kazanç"],
  [/^labor cost index$/i, "İşgücü maliyeti endeksi"],
  [/^participation rate$/i, "İşgücüne katılım oranı"],
  [/^non-?farm productivity$/i, "Tarım dışı verimlilik"],
  [/^unit labor costs$/i, "Birim işgücü maliyeti"],

  // Buyume ve aktivite
  [/^gdp$/i, "GSYH büyümesi"],
  [/^gdp price index$/i, "GSYH fiyat endeksi"],
  [/^ism manufacturing pmi$/i, "ISM imalat PMI"],
  [/^ism services pmi$/i, "ISM hizmet PMI"],
  [/^ism manufacturing prices$/i, "ISM imalat fiyatları"],
  [/^ism services prices$/i, "ISM hizmet fiyatları"],
  [/^manufacturing pmi$/i, "İmalat PMI"],
  [/^services pmi$/i, "Hizmet PMI"],
  [/^composite pmi$/i, "Bileşik PMI"],
  [/^core retail sales$/i, "Çekirdek perakende satışlar"],
  [/^retail sales$/i, "Perakende satışlar"],
  [/^industrial production$/i, "Sanayi üretimi"],
  [/^factory orders$/i, "Fabrika siparişleri"],
  [/^durable goods orders$/i, "Dayanıklı mal siparişleri"],
  [/^core durable goods orders$/i, "Çekirdek dayanıklı mal siparişleri"],
  [/^building permits$/i, "İnşaat izinleri"],
  [/^housing starts$/i, "Konut başlangıçları"],
  [/^new home sales$/i, "Yeni konut satışları"],
  [/^existing home sales$/i, "İkinci el konut satışları"],
  [/^trade balance$/i, "Dış ticaret dengesi"],
  [/^current account$/i, "Cari denge"],
  [/^consumer sentiment$/i, "Tüketici güven endeksi"],
  [/^cb consumer confidence$/i, "CB tüketici güveni"],
  [/^consumer confidence$/i, "Tüketici güveni"],
  [/^consumer credit$/i, "Tüketici kredileri"],

  // Enerji ve likidite
  [/^crude oil inventories$/i, "Ham petrol stokları"],
  [/^natural gas storage$/i, "Doğalgaz stokları"],
  [/^\d+-?(year|yr) (bond|note|bill) auction$/i, "Tahvil ihalesi"],
  [/^federal budget balance$/i, "Federal bütçe dengesi"],

  // Siyaset
  [/^congressional elections$/i, "ABD ara seçimleri"],
  [/^presidential election$/i, "Başkanlık seçimi"],
  [/^parliamentary election$/i, "Parlamento seçimi"],
];

const SPEAKER = /^(.+?)\s+(speaks|speech|testifies)$/i;

function translateSpeaker(name: string): string {
  for (const [re, tr] of SPEAKER_TITLE) {
    if (re.test(name)) return name.replace(re, tr);
  }
  return name;
}

/**
 * Feed basligini Turkceye cevirir. Sozlukte karsiligi yoksa baslik
 * oldugu gibi kalir — uydurma ceviri yapilmaz.
 */
export function localizeTitle(raw: string): string {
  let t = raw.trim();

  const speaker = SPEAKER.exec(t);
  if (speaker) return `${translateSpeaker(speaker[1])} konuşması`;

  let period = "";
  for (const [re, tr] of PERIOD) {
    if (re.test(t)) {
      period = tr;
      t = t.replace(re, "");
      break;
    }
  }

  let qualifier = "";
  for (const [re, tr] of QUALIFIER) {
    if (re.test(t)) {
      qualifier = tr;
      t = t.replace(re, "");
      break;
    }
  }

  let prefix = "";
  for (const [re, tr] of COUNTRY_PREFIX) {
    if (re.test(t)) {
      prefix = tr;
      t = t.replace(re, "");
      break;
    }
  }

  // Sozlukte tam karsiligi varsa kurum onekini soymadan dene.
  for (const [re, tr] of TERMS) {
    if (re.test(t.trim())) {
      return compose(prefix, qualifier, tr, period);
    }
  }

  for (const [re, tr] of INSTITUTION_PREFIX) {
    if (re.test(t)) {
      prefix = `${prefix}${tr}`;
      t = t.replace(re, "");
      break;
    }
  }

  for (const [re, tr] of TERMS) {
    if (re.test(t.trim())) {
      return compose(prefix, qualifier, tr, period);
    }
  }

  // Sozlukte yok: ozgun basligi koru, ekleri geri yaz.
  return `${prefix}${qualifier}${t.trim()}${period}`.trim();
}

/** Onek varsa cekirdek terim kucuk harfle baslar: "BoE para politikası raporu". */
function compose(prefix: string, qualifier: string, term: string, period: string): string {
  const lead = prefix || qualifier;
  const core = lead ? term.charAt(0).toLocaleLowerCase("tr") + term.slice(1) : term;
  return `${prefix}${qualifier}${core}${period}`.trim();
}

export function impactFromFeed(raw: string): Impact {
  const s = (raw ?? "").toLowerCase();
  if (s.startsWith("high")) return 3;
  if (s.startsWith("med")) return 2;
  return 1;
}

const fmtTime = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fmtDateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TR_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Feed tarihini TRT saatine cevirir. Saat belirsizse null. */
export function trTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Feed, saati belirsiz olaylari gun basina sabitler.
  const hhmm = fmtTime.format(d);
  return hhmm === "00:00" ? null : hhmm;
}

/** Feed tarihinin TRT gunu, YYYY-MM-DD. */
export function trDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return fmtDateKey.format(d);
}

export interface IngestStats {
  /** Feed'den gelen satir sayisi. */
  total: number;
  /** Tatil ve veri olmayan satirlar. */
  skipped: number;
  /** Etki esigini gecemeyenler. */
  lowImpact: number;
  /** Takip evrenindeki hicbir enstrumana degmeyenler. */
  outOfUniverse: number;
  /** Kumelemede baska bir satira katlananlar. */
  clustered: number;
  /** Listede kalan haber sayisi. */
  kept: number;
}

export interface IngestOptions {
  /** Bu skorun altindaki olaylar atilir. */
  minVolatility?: number;
  /** Ayni dakika araliginda toplanan olaylar tek satira katlanir. */
  clusterMinutes?: number;
  /** Verilirse ayiklama sayaclari buraya yazilir. */
  stats?: IngestStats;
}

/**
 * Feed satirlarini uygulamanin olay modeline cevirir, gurultuyu ayiklar
 * ve ayni anda aciklanan paket olaylari tek satirda toplar.
 */
export function ingest(items: RawFeedItem[], opts: IngestOptions = {}): NewsEvent[] {
  const minVolatility = opts.minVolatility ?? 35;
  const clusterMinutes = opts.clusterMinutes ?? 45;
  const s: IngestStats = opts.stats ?? {
    total: 0,
    skipped: 0,
    lowImpact: 0,
    outOfUniverse: 0,
    clustered: 0,
    kept: 0,
  };
  s.total = items.length;
  const out: NewsEvent[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item?.title || !item?.date) {
      s.skipped++;
      continue;
    }
    const impactRaw = (item.impact ?? "").toLowerCase();
    if (impactRaw.includes("holiday") || /bank holiday|daylight saving/i.test(item.title)) {
      s.skipped++;
      continue;
    }

    const currency = (item.country ?? "").toUpperCase();
    const impact = impactFromFeed(item.impact);
    const match = classify(item.title, currency, impact);

    if (!match.keep || match.volatility < minVolatility) {
      s.lowImpact++;
      continue;
    }
    // Takip evrenindeki hicbir enstrumana degmiyorsa listeye hic girmez.
    if (match.affected.length === 0) {
      s.outOfUniverse++;
      continue;
    }

    const date = trDateKey(item.date);
    const time = trTime(item.date);
    const id = `${date}-${currency}-${slug(item.title)}`;
    if (seen.has(id)) {
      s.skipped++;
      continue;
    }
    seen.add(id);

    out.push({
      id,
      time,
      date,
      title: localizeTitle(item.title),
      region: regionName(currency),
      currency,
      category: match.category,
      impact,
      volatility: match.volatility,
      forecast: clean(item.forecast),
      previous: clean(item.previous),
      source: { label: "Forex Factory takvimi" },
      affected: match.affected,
    });
  }

  const merged = cluster(out, clusterMinutes);
  s.clustered = out.length - merged.length;
  s.kept = merged.length;
  return sortEvents(merged);
}

/**
 * Ayni gun, ayni para birimi ve ayni kategoride, birbirine yakin saatte
 * aciklanan olaylari tek satirda toplar. Merkez banka kararlari feed'de
 * dort bes satira bolunur; trader icin bu tek olaydir.
 */
export function cluster(events: NewsEvent[], windowMinutes: number): NewsEvent[] {
  // Merkez banka paketleri karar + metin + basin toplantisi olarak yayilir,
  // bu yuzden onlara daha genis bir pencere verilir.
  const windowFor = (category: NewsEvent["category"]) =>
    category === "merkez-banka" ? Math.max(windowMinutes, 120) : windowMinutes;

  const groups = new Map<string, NewsEvent[]>();
  for (const e of events) {
    const key = `${e.date}|${e.currency}|${e.category}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const merged: NewsEvent[] = [];
  for (const list of groups.values()) {
    // Saate gore zincirle: ardisik iki olayin arasi pencereden kucukse
    // ayni kumeye girerler.
    const byTime = [...list].sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
    const chains: NewsEvent[][] = [];
    for (const e of byTime) {
      const chain = chains[chains.length - 1];
      const last = chain?.[chain.length - 1];
      if (
        chain &&
        last &&
        minutesOf(e.time) - minutesOf(last.time) <= windowFor(e.category)
      ) {
        chain.push(e);
      } else {
        chains.push([e]);
      }
    }

    for (const chain of chains) {
      if (chain.length === 1) {
        merged.push(chain[0]);
        continue;
      }
      const primary = pickPrimary(chain);
      const also = dedupeTitles(
        chain.filter((e) => e !== primary).map((e) => e.title),
        primary.title,
      );

      merged.push({
        ...primary,
        time: chain[0].time,
        also: also.length > 0 ? also : undefined,
        impact: Math.max(...chain.map((e) => e.impact)) as Impact,
        volatility: Math.max(...chain.map((e) => e.volatility)),
        forecast: primary.forecast,
        previous: primary.previous,
        affected: mergeAffected(chain.flatMap((e) => e.affected)),
      });
    }
  }

  return merged;
}

/**
 * Kumede basligi tasiyacak olay. Karar metinleri basin toplantisini,
 * cekirdek veri manset veriyi geride birakir.
 */
const PRIMARY_BONUS: [RegExp, number][] = [
  [/politika faizi|faiz kararı/i, 90],
  [/faiz oylaması|para politikası/i, 70],
  [/çekirdek|core/i, 50],
  [/basın toplantısı|konuşması/i, -60],
];

function pickPrimary(chain: NewsEvent[]): NewsEvent {
  const score = (e: NewsEvent) => {
    let s = e.volatility * 10 + e.impact;
    for (const [re, bonus] of PRIMARY_BONUS) {
      if (re.test(e.title)) {
        s += bonus;
        break;
      }
    }
    return s;
  };
  return [...chain].sort(
    (a, b) => score(b) - score(a) || a.title.length - b.title.length,
  )[0];
}

/** Ayni Turkce karsiliga dusen basliklari teke indirir. */
function dedupeTitles(titles: string[], primary: string): string[] {
  const seen = new Set([primary.toLocaleLowerCase("tr")]);
  const out: string[] = [];
  for (const t of titles) {
    const key = t.toLocaleLowerCase("tr");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function mergeAffected(list: AffectedInstrument[]): AffectedInstrument[] {
  const seen = new Map<string, AffectedInstrument>();
  for (const a of list) {
    const prev = seen.get(a.symbol);
    if (!prev || a.strength > prev.strength) seen.set(a.symbol, a);
  }
  return [...seen.values()]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 8);
}

export function sortEvents(events: NewsEvent[]): NewsEvent[] {
  return [...events].sort(
    (a, b) =>
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || b.volatility - a.volatility,
  );
}

function minutesOf(time: string | null): number {
  if (!time) return 24 * 60;
  const [h, m] = time.split(":").map(Number);
  return (Number.isNaN(h) ? 24 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}

function clean(v?: string): string | undefined {
  const s = (v ?? "").trim();
  return s && s !== "-" ? s : undefined;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
