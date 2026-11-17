import type { NewsEvent } from "./types";
import { DIRECTION_GLYPH } from "./labels";
import { nyTime } from "./clock";
import { surpriseLabel } from "./outcomes";

/**
 * Sistem bildirimi metni.
 *
 * Bildirim govdesi bos kalmasin: ne beklendigini, hangi sayiya
 * bakilacagini ve hangi pariteye dokundugunu uygulamayi acmadan
 * okuyabilmeli. Iki tur var — haber yaklasirken ve sonuc geldiginde.
 */

export type NotifyKind = "yaklasiyor" | "sonuc";

export interface NotifyText {
  title: string;
  body: string;
}

export function notifyText(
  event: NewsEvent,
  kind: NotifyKind,
  minutes?: number,
): NotifyText {
  const pairs = event.affected
    .slice(0, 4)
    .map((a) => `${a.symbol}${DIRECTION_GLYPH[a.direction]}`)
    .join("  ");

  const lines: string[] = [];
  let title: string;

  if (kind === "yaklasiyor") {
    const dk = minutes !== undefined && minutes > 0 ? `${minutes} dk` : "birazdan";
    title = `${dk} · ${event.title}`;
    lines.push(
      `${event.time ?? "gün içi"} TRT${event.utc ? ` · ${nyTime(event.utc)} NY` : ""} · ${event.region}`,
    );
    const sayilar = [
      event.forecast ? `beklenti ${event.forecast}` : null,
      event.previous ? `önceki ${event.previous}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    if (sayilar) lines.push(sayilar);
    if (event.brief?.watch) lines.push(event.brief.watch);
  } else {
    title = `Sonuç · ${event.title}`;
    const r = event.results?.[0];
    if (r) {
      const yon = surpriseLabel(r);
      lines.push(
        `${r.name}: ${r.actual}${
          r.forecast ? ` (beklenti ${r.forecast}${yon ? `, ${yon}` : ""})` : ""
        }`,
      );
    }
    if (event.resultBrief?.headline) lines.push(event.resultBrief.headline);
  }

  if (pairs) lines.push(pairs);
  return { title, body: lines.join("\n") };
}

/** Izin varsa bildirimi gonderir; yoksa sessizce gecer. */
export function sendNotification(
  event: NewsEvent,
  kind: NotifyKind,
  minutes?: number,
): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const { title, body } = notifyText(event, kind, minutes);
  try {
    new Notification(title, {
      title,
      body,
      tag: `${event.id}-${kind}`,
      // Sonuc bildirimi sessiz: haber gecti, aciliyeti yok.
      silent: kind === "sonuc",
    } as NotificationOptions);
  } catch {
    // Bazi tarayicilar servis worker olmadan reddeder; sayfa ici uyari yine cikar.
  }
}
