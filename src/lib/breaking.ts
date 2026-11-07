/**
 * Ani haber izleme.
 *
 * Takvim onceden bilinen olaylari tasir; bu dosya takvimde olmayan,
 * aniden olan seyler icin. Iki kaynak, ikisi de ucretsiz, anahtarsiz ve
 * tarayicidan dogrudan cagrilabiliyor (CORS acik):
 *
 *  1. DefiLlama hack listesi — isimli olay, zincir, dolar tutari.
 *     Kurumsal ve dogrulanmis, ama kayit saatler icinde giriliyor:
 *     "oldu" bilgisi kesin, "su anda oluyor" degil.
 *  2. Coinpaprika fiyat degisimi — BTC ve ETH'te 1 saatlik sert hareket.
 *     Bu gercekten anlik: kriz cogu zaman haber yazilmadan once
 *     fiyatta gorunur.
 *
 * Not: Tarayicidan cagrildigi icin sayfa acikken calisir. Sekme
 * kapaliyken bildirim icin sunucu tarafli bir push gerekir.
 */

export const HACKS_URL = "https://api.llama.fi/hacks";
export const TICKER_URL = "https://api.coinpaprika.com/v1/tickers";

export type BreakingKind = "hack" | "sok";

export interface BreakingItem {
  id: string;
  kind: BreakingKind;
  /** 1 bilgi, 2 dikkat, 3 kritik. Bildirim 2 ve uzerinde gider. */
  severity: 1 | 2 | 3;
  title: string;
  detail: string;
  /** Olayin zamani, ISO. */
  at: string;
  symbols: string[];
}

interface RawHack {
  date: number;
  name: string;
  classification?: string;
  technique?: string;
  amount?: number | null;
  /** Tek zincir adi ya da zincir dizisi olarak gelebiliyor. */
  chain?: string | string[] | null;
  targetType?: string | null;
  source?: string | null;
}

const usd = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

function usdShort(v: number): string {
  if (v >= 1e9) return `${usd.format(v / 1e9)} mlr $`;
  if (v >= 1e6) return `${usd.format(v / 1e6)} mn $`;
  if (v >= 1e3) return `${usd.format(v / 1e3)} bin $`;
  return `${usd.format(v)} $`;
}

function hackSeverity(amount: number | null | undefined, targetType?: string | null): 1 | 2 | 3 {
  const a = amount ?? 0;
  if (a >= 100e6) return 3;
  if (a >= 10e6) return 2;
  // Borsa kaynakli olaylar tutar bilinmese de dikkat ister.
  if (/cex|exchange/i.test(targetType ?? "")) return 2;
  return 1;
}

/** "Unknown" gibi bos degerler satira bilgi katmiyor, elenir. */
function meaningful(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s && !/^(unknown|other|n\/a|-)$/i.test(s) ? s : undefined;
}

/** chain alani kimi kayitta dizi, kimi kayitta virgullu metin. */
function firstChain(chain: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(chain)) return chain[0];
  if (typeof chain === "string" && chain.trim()) return chain.split(",")[0].trim();
  return undefined;
}

async function getJson(url: string, timeoutMs = 15000): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Son gunlerdeki kripto hack kayitlari. */
export async function fetchHacks(sinceDays = 7): Promise<BreakingItem[]> {
  const data = (await getJson(HACKS_URL)) as RawHack[];
  if (!Array.isArray(data)) return [];
  const cutoff = Date.now() / 1000 - sinceDays * 86400;

  return data
    .filter((h) => h?.date > cutoff && h?.name)
    .sort((a, b) => b.date - a.date)
    .map((h) => {
      const severity = hackSeverity(h.amount, h.targetType);
      const parts = [
        h.amount ? usdShort(h.amount) : "tutar belirsiz",
        h.targetType ?? undefined,
        meaningful(h.technique) ?? meaningful(h.classification),
        firstChain(h.chain),
      ].filter(Boolean);
      return {
        id: `hack-${h.name}-${h.date}`,
        kind: "hack" as const,
        severity,
        title: `${h.name} — güvenlik ihlali`,
        detail: parts.join(" · "),
        at: new Date(h.date * 1000).toISOString(),
        symbols: ["BTCUSD", "ETHUSD", "TOTAL"],
      };
    })
    .filter((item) => item.severity >= 2);
}

interface Ticker {
  quotes?: { USD?: { percent_change_1h?: number; percent_change_24h?: number; price?: number } };
}

const WATCHED = [
  { id: "btc-bitcoin", symbol: "BTCUSD", label: "Bitcoin" },
  { id: "eth-ethereum", symbol: "ETHUSD", label: "Ethereum" },
] as const;

/** 1 saatlik sert hareketler. Kriz cogu zaman once burada gorunur. */
export async function fetchShocks(): Promise<BreakingItem[]> {
  const out: BreakingItem[] = [];
  const results = await Promise.allSettled(
    WATCHED.map((w) => getJson(`${TICKER_URL}/${w.id}`) as Promise<Ticker>),
  );

  results.forEach((res, i) => {
    if (res.status !== "fulfilled") return;
    const q = res.value?.quotes?.USD;
    const h1 = Number(q?.percent_change_1h ?? 0);
    const h24 = Number(q?.percent_change_24h ?? 0);
    const w = WATCHED[i];

    let severity: 1 | 2 | 3 | 0 = 0;
    let basis = "";
    if (Math.abs(h1) >= 5) {
      severity = 3;
      basis = `1 saatte %${usd.format(h1)}`;
    } else if (Math.abs(h1) >= 3) {
      severity = 2;
      basis = `1 saatte %${usd.format(h1)}`;
    } else if (Math.abs(h24) >= 10) {
      severity = 2;
      basis = `24 saatte %${usd.format(h24)}`;
    }
    if (severity === 0) return;

    // Saat basina tek uyari: ayni hareket her yoklamada tekrar etmesin.
    const hourKey = new Date().toISOString().slice(0, 13);
    out.push({
      id: `sok-${w.symbol}-${hourKey}`,
      kind: "sok",
      severity,
      title: `${w.label} sert hareket`,
      detail: [basis, q?.price ? `${usd.format(q.price)} $` : null]
        .filter(Boolean)
        .join(" · "),
      at: new Date().toISOString(),
      symbols: [w.symbol, "TOTAL"],
    });
  });

  return out;
}

/** Iki kaynagi birden; biri duserse digeri yine doner. */
export async function fetchBreaking(sinceDays = 7): Promise<BreakingItem[]> {
  const [hacks, shocks] = await Promise.allSettled([
    fetchHacks(sinceDays),
    fetchShocks(),
  ]);
  const items = [
    ...(hacks.status === "fulfilled" ? hacks.value : []),
    ...(shocks.status === "fulfilled" ? shocks.value : []),
  ];
  return items.sort(
    (a, b) => b.severity - a.severity || b.at.localeCompare(a.at),
  );
}
