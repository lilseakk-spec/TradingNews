import type { Direction, EventCategory, Impact } from "./types.ts";

export const CATEGORY_TR: Record<EventCategory, string> = {
  "merkez-banka": "Merkez bankası",
  enflasyon: "Enflasyon",
  istihdam: "İstihdam",
  buyume: "Büyüme",
  kripto: "Kripto",
  bilanco: "Bilanço",
  enerji: "Enerji",
  jeopolitik: "Jeopolitik",
  likidite: "Likidite",
};

export const DIRECTION_GLYPH: Record<Direction, string> = {
  yukari: "▲",
  asagi: "▼",
  volatil: "⇅",
};

export const DIRECTION_TR: Record<Direction, string> = {
  yukari: "yukarı yönlü",
  asagi: "aşağı yönlü",
  volatil: "iki yönlü oynak",
};

export const IMPACT_TR: Record<Impact, string> = {
  1: "düşük etki",
  2: "orta etki",
  3: "yüksek etki",
};

export const REGIME_TR = {
  "risk-on": "Risk alma iştahı",
  "risk-off": "Riskten kaçış",
  karisik: "Karışık",
} as const;

/** Etki siddetinin rengi. Renk rampasi yalnizca etkiyi tasir. */
export function impactColor(impact: Impact): string {
  return impact === 3 ? "var(--verm)" : impact === 2 ? "var(--amber)" : "var(--sage)";
}

export function volatilityColor(v: number): string {
  if (v >= 75) return "var(--verm)";
  if (v >= 50) return "var(--amber)";
  return "var(--sage)";
}

/** Turkce buyuk harf: i -> İ. */
export function upperTR(s: string): string {
  return s.replace(/i/g, "İ").toUpperCase();
}
