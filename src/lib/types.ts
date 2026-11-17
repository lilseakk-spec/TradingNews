import type { EventResult } from "./outcomes.ts";
/** Varlik gruplari — seritteki serit/lane sirasi da budur. */
export type AssetGroup = "kripto" | "endeks" | "forex" | "emtia";

/** 1 = dusuk, 2 = orta, 3 = yuksek etki. */
export type Impact = 1 | 2 | 3;

/** Pozitif surpriz halinde beklenen yon. */
export type Direction = "yukari" | "asagi" | "volatil";

export type EventCategory =
  | "merkez-banka"
  | "enflasyon"
  | "istihdam"
  | "buyume"
  | "kripto"
  | "bilanco"
  | "enerji"
  | "jeopolitik"
  | "likidite";

export interface AffectedInstrument {
  /** instruments.ts icindeki sembol. */
  symbol: string;
  direction: Direction;
  /** Etkinin bu enstrumandaki siddeti. */
  strength: Impact;
  note?: string;
}

/**
 * Olay oncesi brifing.
 *
 * Tek cumlelik yorum haberi anlatmiyordu: okuyucu verinin ne oldugunu,
 * neden bu hafta onemli oldugunu ve iki yonlu sonucun ne anlama
 * geldigini ayri ayri gormeli.
 */
export interface EventBrief {
  /** Bu veri ne olcuyor, sade dille. */
  what: string;
  /** Bu hafta neden onemli, hangi baglamda okunacak. */
  why: string;
  /** Beklentinin ustu gelirse: mekanizma ve yon. */
  above: string;
  /** Beklentinin alti gelirse: mekanizma ve yon. */
  below: string;
  /** Asil izlenecek sey ya da tezi bozacak gelisme. */
  watch?: string;
}

/** Olay sonrasi degerlendirme. */
export interface ResultBrief {
  /** Tek cumlede ne oldu. */
  headline: string;
  /** Sayilarla ne geldi, beklentiden sapma. */
  detail: string;
  /** Bunun anlami: hangi kanaldan hangi pariteye gecer. */
  meaning: string;
  /** Bundan sonra ne izlenecek. */
  next?: string;
}

export interface NewsEvent {
  id: string;
  /** TRT, "15:30". null ise saat belirsiz / gun ici. */
  time: string | null;
  /** ISO tarih (TRT). Gun blogunun tarihiyle ayni. */
  date?: string;
  /** Olayin kesin ani, UTC ISO. New York saati ve geri sayim bundan turer. */
  utc?: string;
  title: string;
  /** Ayni anda aciklanan ve bu satira katlanan diger basliklar. */
  also?: string[];
  region: string;
  currency?: string;
  category: EventCategory;
  impact: Impact;
  /** Beklenen oynaklik skoru, 0–100. Seritte tik yuksekligi. */
  volatility: number;
  forecast?: string;
  previous?: string;
  actual?: string;
  /** Aciklandiktan sonra gelen olculer: ne bekleniyordu, ne geldi. */
  results?: EventResult[];
  /** Olaya ozgu tek olcu: "açık pozisyon" / "4,2 mlr $" gibi. */
  metric?: { label: string; value: string };
  source?: { label: string; url?: string };
  affected: AffectedInstrument[];
  /** Tek cumlelik AI yorumu — olay oncesi. Eski bicim, brief'e birakildi. */
  ai?: string;
  /** Olay oncesi brifing: ne, neden, hangi sonuc ne anlama gelir. */
  brief?: EventBrief;
  /** Olay SONRASI yorum. Eski bicim, resultBrief'e birakildi. */
  aiResult?: string;
  /** Olay sonrasi degerlendirme: ne oldu, ne anlama geliyor, sirada ne var. */
  resultBrief?: ResultBrief;
}

export interface DayBlock {
  key: string;
  label: string;
  /** ISO tarih, YYYY-MM-DD. */
  date: string;
  /** Gunun tek cumlelik odagi. */
  focus?: string;
  events: NewsEvent[];
}

export interface Scenario {
  name: string;
  trigger: string;
  reaction: string;
  bias: "yukari" | "asagi" | "notr";
}

export interface AiCommentary {
  headline: string;
  thesis: string;
  regime: { label: string; tone: "risk-on" | "risk-off" | "karisik" };
  scenarios: Scenario[];
  watchlist: string[];
  risks: string[];
  generatedBy: string;
  generatedAt: string;
}

export interface WeekData {
  /** 2026-W46 */
  id: string;
  /** "8–13 Kasim 2026" */
  label: string;
  /** Pazar, ISO tarih. */
  start: string;
  /** Cuma, ISO tarih. */
  end: string;
  updatedAt: string;
  /** Gelecek hafta on izlemesi: takvim henuz kesinlesmedi. */
  preliminary?: boolean;
  calendarSource?: { label: string; url?: string; fetchedAt?: string };
  ai: AiCommentary;
  days: DayBlock[];
}

export function volatilityLabel(v: number): string {
  if (v >= 80) return "aşırı";
  if (v >= 60) return "yüksek";
  if (v >= 35) return "orta";
  return "düşük";
}
