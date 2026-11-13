/**
 * Yapay zeka maliyeti.
 *
 * Tahmin degil olcum: her cagri sonrasi gercek token sayilari
 * src/data/ai-usage.json dosyasina yazilir ve maliyet oradan
 * hesaplanir. Dusunme tokenleri cikis olarak faturalanir, bu yuzden
 * gorunen metinden daha buyuk cikabilir — asil sayi budur.
 */

export const USAGE_FILE = "src/data/ai-usage.json";

/** Dolar / milyon token. */
export interface ModelPrice {
  input: number;
  output: number;
}

export const PRICES: Record<string, ModelPrice> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

/** Bilinmeyen model icin Opus 5.5 fiyati varsayilir. */
export function priceOf(model: string): ModelPrice {
  return PRICES[model] ?? PRICES["claude-opus-5-5"];
}

export interface UsageEntry {
  at: string;
  /** Hangi is: "hafta", "on-izleme". */
  job: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Dolar. */
  cost: number;
  /** Kac birim uretildi (parite ya da olay sayisi). */
  items?: number;
}

export interface UsageLog {
  entries: UsageEntry[];
}

export function costOf(model: string, input: number, output: number): number {
  const p = priceOf(model);
  return (input / 1_000_000) * p.input + (output / 1_000_000) * p.output;
}

export interface UsageSummary {
  total: number;
  runs: number;
  byJob: { job: string; runs: number; cost: number }[];
  /** Son dort haftanin ortalamasindan yillik tahmin. */
  perWeek: number | null;
  perYear: number | null;
  first?: string;
  last?: string;
}

export function summarize(log: UsageLog): UsageSummary {
  const entries = [...log.entries].sort((a, b) => a.at.localeCompare(b.at));
  const total = entries.reduce((s, e) => s + e.cost, 0);

  const jobs = new Map<string, { runs: number; cost: number }>();
  for (const e of entries) {
    const j = jobs.get(e.job) ?? { runs: 0, cost: 0 };
    j.runs++;
    j.cost += e.cost;
    jobs.set(e.job, j);
  }

  // Haftalik ortalama: ilk ve son kayit arasindaki gercek sureye bolunur.
  let perWeek: number | null = null;
  if (entries.length >= 2) {
    const ms = new Date(entries[entries.length - 1].at).getTime() - new Date(entries[0].at).getTime();
    const weeks = ms / (7 * 86400000);
    if (weeks >= 0.5) perWeek = total / weeks;
  }

  return {
    total,
    runs: entries.length,
    byJob: [...jobs.entries()]
      .map(([job, v]) => ({ job, ...v }))
      .sort((a, b) => b.cost - a.cost),
    perWeek,
    perYear: perWeek === null ? null : perWeek * 52,
    first: entries[0]?.at,
    last: entries[entries.length - 1]?.at,
  };
}

export const JOB_LABEL: Record<string, string> = {
  hafta: "Hafta yorumu",
  "on-izleme": "Gelecek hafta ön izlemesi",
  sonuc: "Haber sonrası yorum",
  // COT kaldirildi; gecmis kayitlar okunakli kalsin diye etiket duruyor.
  cot: "COT yorumu (kaldırıldı)",
};
