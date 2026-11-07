"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHacks, fetchShocks, type BreakingItem } from "@/lib/breaking";

/**
 * Ani haber seridi.
 *
 * Fiyat sokları iki dakikada bir, hack kayitlari on bes dakikada bir
 * yoklanir — hack listesi buyuk bir dosya, siklastirmanin anlami yok.
 * Gorulen her olay localStorage'a yazilir, ayni sey iki kez bildirilmez.
 */

const SHOCK_MS = 2 * 60_000;
const HACK_MS = 15 * 60_000;
const SEEN_KEY = "sismograf-breaking-seen";
const ALERTS_KEY = "sismograf-alerts";
const MAX_SEEN = 200;

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-MAX_SEEN)));
  } catch {
    // Gizli pencere: tekrar bildirim gelebilir, kritik degil.
  }
}

function sevColor(s: number): string {
  return s >= 3 ? "var(--verm)" : s === 2 ? "var(--amber)" : "var(--sage)";
}

function sinceLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

export default function BreakingWatch() {
  const [items, setItems] = useState<BreakingItem[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  const notify = useCallback((fresh: BreakingItem[]) => {
    let alertsOn = false;
    try {
      alertsOn = localStorage.getItem(ALERTS_KEY) === "1";
    } catch {
      alertsOn = false;
    }
    if (!alertsOn) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const item of fresh) {
      if (item.severity < 2) continue;
      try {
        new Notification(item.title, { body: item.detail, tag: item.id });
      } catch {
        // Bildirim reddedildi; serit zaten sayfada gorunuyor.
      }
    }
  }, []);

  const merge = useCallback(
    (incoming: BreakingItem[]) => {
      const fresh = incoming.filter((i) => !seen.current.has(i.id));
      for (const i of fresh) seen.current.add(i.id);
      if (fresh.length > 0) {
        writeSeen([...seen.current]);
        notify(fresh);
      }
      setItems((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        for (const i of incoming) byId.set(i.id, i);
        return [...byId.values()]
          .sort((a, b) => b.severity - a.severity || b.at.localeCompare(a.at))
          .slice(0, 6);
      });
    },
    [notify],
  );

  useEffect(() => {
    // StrictMode gelistirmede iki kez baglar; guard koymak yerine
    // iptal bayragina guveniyoruz, yoksa ikinci baglama bos kalir.
    seen.current = new Set(readSeen());

    let alive = true;
    const pullShocks = async () => {
      try {
        const s = await fetchShocks();
        if (alive) merge(s);
      } catch {
        if (alive) setFailed(true);
      }
    };
    const pullHacks = async () => {
      try {
        const h = await fetchHacks(7);
        if (alive) merge(h);
      } catch {
        if (alive) setFailed(true);
      }
    };

    pullShocks();
    pullHacks();
    const a = setInterval(pullShocks, SHOCK_MS);
    const b = setInterval(pullHacks, HACK_MS);
    return () => {
      alive = false;
      clearInterval(a);
      clearInterval(b);
    };
  }, [merge]);

  const visible = items.filter((i) => !hidden.has(i.id));
  if (visible.length === 0) {
    if (!failed) return null;
    return (
      <p className="text-[0.75rem] text-[var(--text-faint)]">
        Ani haber kaynağına ulaşılamadı; takvim etkilenmez.
      </p>
    );
  }

  return (
    <section aria-label="Ani haberler" className="space-y-1.5">
      {visible.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-sm border border-l-[3px] border-[var(--hairline)] bg-[var(--bg-surface)] px-3 py-2"
          style={{ borderLeftColor: sevColor(item.severity) }}
        >
          <span
            className="t-label mt-[0.15rem] shrink-0"
            style={{ color: sevColor(item.severity) }}
          >
            {item.kind === "hack" ? "ihlal" : "sert hareket"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.875rem] leading-snug text-[var(--text)]">{item.title}</p>
            <p className="t-num mt-0.5 text-[0.75rem] text-[var(--text-dim)]">
              {item.detail}
              <span className="text-[var(--text-faint)]"> · {sinceLabel(item.at)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHidden((h) => new Set(h).add(item.id))}
            aria-label="Bu bildirimi gizle"
            className="-mt-0.5 shrink-0 px-1 text-[1rem] leading-none text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            ×
          </button>
        </div>
      ))}
    </section>
  );
}
