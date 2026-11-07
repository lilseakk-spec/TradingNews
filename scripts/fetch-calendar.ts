/**
 * Ekonomik takvim feed'ini indirir ve ham halini onbellege yazar.
 *
 *   node scripts/fetch-calendar.ts
 *
 * Feed haftalik doner: pazar gunu yeni haftaya geciyor. Hafta dosyasini
 * uretmek icin new-week.ts bu onbellegi kullanir.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_FEED, type RawFeedItem } from "../src/lib/calendar.ts";

export const CACHE_DIR = path.join(process.cwd(), "src", "data", "cache");
export const CACHE_LATEST = path.join(CACHE_DIR, "feed-latest.json");

export interface CacheFile {
  fetchedAt: string;
  url: string;
  items: RawFeedItem[];
}

export async function fetchFeed(url = process.env.CALENDAR_FEED_URL || DEFAULT_FEED) {
  const res = await fetch(url, {
    headers: { "user-agent": "trading-news-app/0.1 (+local)" },
  });
  if (!res.ok) {
    throw new Error(`Feed ${res.status} ${res.statusText} — ${url}`);
  }
  const items = (await res.json()) as RawFeedItem[];
  if (!Array.isArray(items)) throw new Error("Feed beklenen dizi bicimminde degil.");
  return { fetchedAt: new Date().toISOString(), url, items } satisfies CacheFile;
}

export function writeCache(data: CacheFile) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_LATEST, JSON.stringify(data, null, 2) + "\n", "utf8");
  const stamp = data.fetchedAt.slice(0, 10);
  fs.writeFileSync(
    path.join(CACHE_DIR, `feed-${stamp}.json`),
    JSON.stringify(data, null, 2) + "\n",
    "utf8",
  );
}

export function readCache(): CacheFile {
  if (!fs.existsSync(CACHE_LATEST)) {
    throw new Error(
      "Onbellek bos. Once 'node scripts/fetch-calendar.ts' calistir.",
    );
  }
  return JSON.parse(fs.readFileSync(CACHE_LATEST, "utf8")) as CacheFile;
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("fetch-calendar.ts");

if (isMain) {
  const data = await fetchFeed();
  writeCache(data);
  const dates = [...new Set(data.items.map((i) => i.date.slice(0, 10)))].sort();
  const high = data.items.filter((i) => /high/i.test(i.impact)).length;
  console.log(`Takvim indirildi: ${data.items.length} satir`);
  console.log(`  kapsam  : ${dates[0]} .. ${dates[dates.length - 1]}`);
  console.log(`  yuksek  : ${high} satir`);
  console.log(`  onbellek: ${path.relative(process.cwd(), CACHE_LATEST)}`);
}
