"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NewsEvent } from "@/lib/types";
import { impactColor, DIRECTION_GLYPH } from "@/lib/labels";
import { formatCountdown, nyTime } from "@/lib/clock";
import { DAY_META, dayOfWeek, shortDate } from "@/lib/weeks";

/**
 * Sıradaki haber kartı, geri sayım ve haber öncesi uyarı.
 *
 * Takvim önceden bilindigi icin uyarilar yoklama yapmadan kurulur:
 * her olay icin tek bir zamanlayici. Sayfa acikken saniye hassasiyetinde
 * calisir; tarayici bildirimi izin verilmisse ayrica gonderilir.
 */

const LEAD_OPTIONS = [5, 15, 30, 60];
const STORAGE_LEAD = "sismograf-lead";
const STORAGE_ON = "sismograf-alerts";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Gizli pencerede yazilamaz; ayar bu oturumda yine de gecerli.
  }
}

function dayLabel(dateISO?: string): string {
  if (!dateISO) return "";
  const meta = DAY_META.find((d) => d.dow === dayOfWeek(dateISO));
  return meta ? meta.short : "";
}

export default function UpcomingAlerts({
  events,
  onOpen,
}: {
  events: NewsEvent[];
  onOpen?: (id: string) => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [alertsOn, setAlertsOn] = useState(false);
  const [lead, setLead] = useState(15);
  const [popup, setPopup] = useState<NewsEvent | null>(null);
  const fired = useRef<Set<string>>(new Set());

  const timed = useMemo(
    () =>
      events
        .filter((e) => e.utc)
        .map((e) => ({ event: e, at: new Date(e.utc as string).getTime() }))
        .filter((e) => Number.isFinite(e.at))
        .sort((a, b) => a.at - b.at),
    [events],
  );

  useEffect(() => {
    setNow(Date.now());
    setLead(Number(read(STORAGE_LEAD)) || 15);
    setAlertsOn(read(STORAGE_ON) === "1");
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Uyari penceresine giren olaylar icin tek seferlik bildirim.
  useEffect(() => {
    if (now === null || !alertsOn) return;
    const windowMs = lead * 60_000;
    for (const { event, at } of timed) {
      const delta = at - now;
      if (delta > windowMs || delta < -60_000) continue;
      if (fired.current.has(event.id)) continue;
      fired.current.add(event.id);
      setPopup(event);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const body = [
          `${event.time ?? "gün içi"} TRT${event.utc ? ` · ${nyTime(event.utc)} NY` : ""}`,
          event.affected
            .slice(0, 4)
            .map((a) => `${a.symbol}${DIRECTION_GLYPH[a.direction]}`)
            .join(" "),
        ].join("\n");
        try {
          new Notification(event.title, { body, tag: event.id });
        } catch {
          // Bazi tarayicilar servis worker olmadan reddeder; popup yine cikar.
        }
      }
    }
  }, [now, alertsOn, lead, timed]);

  const enable = useCallback(async () => {
    if (alertsOn) {
      setAlertsOn(false);
      write(STORAGE_ON, "0");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // Izin alinamadi; uyarilar yalnizca sayfa icinde gosterilir.
      }
    }
    setAlertsOn(true);
    write(STORAGE_ON, "1");
  }, [alertsOn]);

  const next = now === null ? null : timed.find((e) => e.at > now - 60_000);

  return (
    <>
      <section className="rounded-sm border border-[var(--hairline)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="t-label">Sıradaki haber</span>
          <div className="flex items-center gap-2">
            {alertsOn && (
              <select
                value={lead}
                onChange={(e) => {
                  setLead(Number(e.target.value));
                  write(STORAGE_LEAD, e.target.value);
                }}
                aria-label="Kaç dakika önce uyarılsın"
                className="t-num rounded-sm border border-[var(--hairline)] bg-[var(--bg-raise)] px-1.5 py-1 text-[0.6875rem] text-[var(--text)]"
              >
                {LEAD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} dk önce
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={enable}
              className={[
                "rounded-sm border px-2.5 py-1 text-[0.75rem] transition-colors",
                alertsOn
                  ? "border-[var(--amber)] text-[var(--amber)]"
                  : "border-[var(--hairline)] text-[var(--text-dim)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              {alertsOn ? "uyarılar açık" : "uyarıları aç"}
            </button>
          </div>
        </div>

        {next ? (
          <div className="mt-3">
            <div
              className="t-num text-[clamp(2rem,8vw,3.25rem)] leading-none"
              style={{ color: impactColor(next.event.impact) }}
            >
              {now === null ? "--:--:--" : (formatCountdown(next.at - now) ?? "şimdi")}
            </div>
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(next.event.id)}
                className="t-display mt-2.5 block text-left text-[1.125rem] text-[var(--text)] underline-offset-4 transition-colors hover:underline sm:text-[1.375rem]"
              >
                {next.event.title}
              </button>
            ) : (
              <h2 className="t-display mt-2.5 text-[1.125rem] text-[var(--text)] sm:text-[1.375rem]">
                {next.event.title}
              </h2>
            )}
            <p className="t-num mt-1.5 text-[0.8125rem] text-[var(--text-dim)]">
              {dayLabel(next.event.date)} {next.event.date ? shortDate(next.event.date) : ""}
              {" · "}
              {next.event.time ?? "gün içi"} TRT
              {next.event.utc ? ` · ${nyTime(next.event.utc)} NY` : ""}
              {" · "}
              {next.event.region}
            </p>

            {next.event.affected.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                {next.event.affected.slice(0, 6).map((a) => (
                  <span key={a.symbol} className="t-num text-[0.8125rem] text-[var(--text)]">
                    {a.symbol}
                    <span aria-hidden className="ml-0.5 text-[0.6875rem] opacity-60">
                      {DIRECTION_GLYPH[a.direction]}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {next.event.ai && (
              <p className="mt-3 border-l border-l-[var(--violet)] pl-2.5 text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
                {next.event.ai}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-[0.875rem] text-[var(--text-dim)]">
            {now === null
              ? "Yükleniyor…"
              : "Bu haftada bekleyen haber kalmadı. Yeni hafta pazar sabahı eklenir."}
          </p>
        )}
      </section>

      {popup && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-sm border border-l-[3px] border-[var(--hairline)] bg-[var(--bg-raise)] p-3.5 shadow-lg"
          style={{ borderLeftColor: impactColor(popup.impact) }}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="t-label" style={{ color: impactColor(popup.impact) }}>
              {lead} dakika içinde
            </span>
            <button
              type="button"
              onClick={() => setPopup(null)}
              aria-label="Uyarıyı kapat"
              className="-mt-1 px-1 text-[1rem] leading-none text-[var(--text-faint)] hover:text-[var(--text)]"
            >
              ×
            </button>
          </div>
          <h3 className="mt-1.5 text-[0.9375rem] font-medium leading-snug text-[var(--text)]">
            {popup.title}
          </h3>
          <p className="t-num mt-1 text-[0.75rem] text-[var(--text-dim)]">
            {popup.time ?? "gün içi"} TRT
            {popup.utc ? ` · ${nyTime(popup.utc)} NY` : ""} · {popup.region}
          </p>
          {(popup.forecast || popup.previous) && (
            <p className="t-num mt-1 text-[0.75rem] text-[var(--text-dim)]">
              {[
                popup.forecast && `beklenti ${popup.forecast}`,
                popup.previous && `önceki ${popup.previous}`,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
            {popup.affected.slice(0, 6).map((a) => (
              <span key={a.symbol} className="t-num text-[0.75rem] text-[var(--text)]">
                {a.symbol}
                <span aria-hidden className="ml-0.5 text-[0.625rem] opacity-60">
                  {DIRECTION_GLYPH[a.direction]}
                </span>
              </span>
            ))}
          </div>
          {popup.ai && (
            <p className="mt-2 border-l border-l-[var(--violet)] pl-2 text-[0.75rem] leading-relaxed text-[var(--text-dim)]">
              {popup.ai}
            </p>
          )}
        </div>
      )}
    </>
  );
}
