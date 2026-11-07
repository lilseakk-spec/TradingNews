/**
 * Saat dilimleri.
 *
 * Uygulama her olayi iki saatte gosterir: TRT (birincil) ve New York.
 * New York yazin UTC-4, kisin UTC-5 oldugu icin sabit bir ofset yerine
 * saat dilimi adi kullanilir; boylece ABD verilerinin gercek yayin
 * saatiyle yil boyu ortusur.
 *
 * Istanbul'da yaz saati uygulamasi yok, TRT sabit UTC+3.
 */

export const TR_TZ = "Europe/Istanbul";
export const NY_TZ = "America/New_York";

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function timeFormatter(tz: string): Intl.DateTimeFormat {
  let f = timeFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("tr-TR", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    timeFormatters.set(tz, f);
  }
  return f;
}

function dateFormatter(tz: string): Intl.DateTimeFormat {
  let f = dateFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(tz, f);
  }
  return f;
}

/** "HH:mm" — verilen saat diliminde. Gecersiz tarihte null. */
export function timeIn(iso: string, tz: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return timeFormatter(tz).format(d);
}

/** "YYYY-MM-DD" — verilen saat diliminde. */
export function dateKeyIn(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return dateFormatter(tz).format(d);
}

/** New York saati, "08:30". */
export function nyTime(iso: string): string | null {
  return timeIn(iso, NY_TZ);
}

/** Bugunun TRT tarihi. Statik sitede "bugun" isaretleri bununla hesaplanir. */
export function trTodayISO(): string {
  return dateKeyIn(new Date().toISOString(), TR_TZ);
}

/** Su anki TRT saati, dakika cinsinden gun basindan itibaren. */
export function trMinutesNow(): number {
  const hhmm = timeIn(new Date().toISOString(), TR_TZ) ?? "00:00";
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Kalan sureyi okunur hale getirir: "2g 04:12" ya da "04:12:33".
 * Gecmis olaylarda null doner, boylece cagiran taraf ayirabilir.
 */
export function formatCountdown(ms: number): string | null {
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}g ${pad(h)}:${pad(m)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * New York ile TRT arasindaki fark, saat. Kisin -8, yazin -7.
 * Etikette "NY (-8sa)" gibi gostermek icin.
 */
export function nyOffsetFromTR(iso: string): number {
  const tr = timeIn(iso, TR_TZ);
  const ny = timeIn(iso, NY_TZ);
  if (!tr || !ny) return 0;
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  let diff = toMin(ny) - toMin(tr);
  // Gun atlamasini duzelt.
  if (diff > 12 * 60) diff -= 24 * 60;
  if (diff < -12 * 60) diff += 24 * 60;
  return diff / 60;
}
