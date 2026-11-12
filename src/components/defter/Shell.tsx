"use client";

/**
 * Defter kabugu: veri saglayici, bolum menusu ve her yerden acilabilen
 * islem formu. "y" tusu formu acar — grafikten cikip kaydetmek bir
 * tusluk is olsun.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DefterProvider, useDefter } from "@/lib/defter/store";
import type { Trade } from "@/lib/defter/types";
import TradeForm from "./TradeForm";

const SECTIONS = [
  { href: "/defter", label: "Kokpit" },
  { href: "/defter/hesaplar", label: "Hesaplar" },
  { href: "/defter/islemler", label: "İşlemler" },
  { href: "/defter/playbook", label: "Playbook" },
  { href: "/defter/notlar", label: "Notlar" },
  { href: "/defter/analiz", label: "Analiz" },
  { href: "/defter/ayarlar", label: "Ayarlar" },
];

interface QuickApi {
  openTrade: (trade?: Trade | null) => void;
}

const QuickCtx = createContext<QuickApi | null>(null);

export function useQuickAdd(): QuickApi {
  const ctx = useContext(QuickCtx);
  if (!ctx) throw new Error("useQuickAdd yalnızca Defter kabuğu içinde çalışır.");
  return ctx;
}

function Nav() {
  const pathname = usePathname();
  const normalized = pathname.replace(/\/$/, "") || "/defter";

  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {SECTIONS.map((section) => {
        const active = normalized === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className="t-label shrink-0 border-b-2 px-3 py-2 transition-colors"
            style={{
              borderColor: active ? "var(--amber)" : "transparent",
              color: active ? "var(--text)" : undefined,
            }}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Inner({ children }: { children: ReactNode }) {
  const { ready, error } = useDefter();
  const [editing, setEditing] = useState<Trade | null>(null);
  const [open, setOpen] = useState(false);

  const openTrade = useCallback((trade?: Trade | null) => {
    setEditing(trade ?? null);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      if (event.key === "y" || event.key === "Y") {
        event.preventDefault();
        openTrade(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTrade]);

  const api = useMemo<QuickApi>(() => ({ openTrade }), [openTrade]);

  return (
    <QuickCtx.Provider value={api}>
      <div className="pt-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="t-eyebrow">trade defteri · fon yönetimi</div>
            <h1 className="t-display mt-1.5 text-[1.625rem] text-[var(--text)]">Defter</h1>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => openTrade(null)}>
            + İşlem kaydet
          </button>
        </div>

        <Nav />

        {error && (
          <div className="mb-5 border border-[var(--verm)] px-3 py-2.5 text-[0.8125rem] text-[var(--verm)]">
            {error}
          </div>
        )}

        {ready ? (
          children
        ) : (
          <div className="flex items-center gap-3 py-20">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--amber)]" />
            <span className="t-label">defter açılıyor…</span>
          </div>
        )}
      </div>

      <TradeForm open={open} trade={editing} onClose={() => setOpen(false)} />
    </QuickCtx.Provider>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <DefterProvider>
      <Inner>{children}</Inner>
    </DefterProvider>
  );
}
