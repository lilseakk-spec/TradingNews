import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sismograf — haftalık volatilite takvimi",
  description:
    "Haftanın piyasa hareketi yaratacak haberleri, etkilediği pariteler ve yapay zeka yorumuyla tek ekranda.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1626" },
    { media: "(prefers-color-scheme: light)", color: "#f1ece1" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} min-h-dvh`}
      >
        <div className="relative z-10 flex min-h-dvh flex-col">
          <header className="border-b border-[var(--hairline)]">
            <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-3.5 sm:px-6">
              <Link href="/" className="group flex items-baseline gap-2.5">
                <span className="t-display text-[1.0625rem] text-[var(--text)]">
                  Sismograf
                </span>
                <span className="t-eyebrow hidden sm:inline">
                  haftalık volatilite takvimi
                </span>
              </Link>
              <nav className="ml-auto flex items-center gap-1">
                <Link
                  href="/defter"
                  className="t-label rounded border border-[var(--hairline)] px-2.5 py-1.5 transition-colors hover:border-[var(--amber)] hover:bg-[var(--bg-raise)] hover:text-[var(--text)]"
                >
                  Defter
                </Link>
                <Link
                  href="/arsiv"
                  className="t-label rounded px-2.5 py-1.5 transition-colors hover:bg-[var(--bg-raise)] hover:text-[var(--text)]"
                >
                  Arşiv
                </Link>
                <Link
                  href="/cot"
                  className="t-label rounded px-2.5 py-1.5 transition-colors hover:bg-[var(--bg-raise)] hover:text-[var(--text)]"
                >
                  COT
                </Link>
                <Link
                  href="/maliyet"
                  className="t-label rounded px-2.5 py-1.5 transition-colors hover:bg-[var(--bg-raise)] hover:text-[var(--text)]"
                >
                  Maliyet
                </Link>
                <Link
                  href="/pariteler"
                  className="t-label rounded px-2.5 py-1.5 transition-colors hover:bg-[var(--bg-raise)] hover:text-[var(--text)]"
                >
                  Pariteler
                </Link>
                <ThemeToggle />
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-24 sm:px-6">
            {children}
          </main>

          <footer className="border-t border-[var(--hairline)]">
            <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-6 sm:px-6">
              <p className="t-label leading-relaxed">
                Takvim verisi Forex Factory haftalık feed&apos;inden alınır, saatler
                TRT&apos;ye çevrilir. Yorumlar yapay zeka tarafından üretilir ve
                yatırım tavsiyesi değildir.
              </p>
              <p className="t-eyebrow">Sismograf · yerel kurulum</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
