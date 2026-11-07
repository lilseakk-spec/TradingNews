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

export interface NewsEvent {
  id: string;
  /** TRT, "15:30". null ise saat belirsiz / gun ici. */
  time: string | null;
  /** ISO tarih. Gun blogunun tarihiyle ayni. */
  date?: string;
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
  source?: { label: string; url?: string };
  affected: AffectedInstrument[];
  /** Tek cumlelik AI yorumu. */
  ai?: string;
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
