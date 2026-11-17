"use client";

import { useEffect, useState } from "react";

/**
 * "Şimdi" çizgisi.
 *
 * Zaman rayinin uzerinde, gunun icinde bulundugumuz ani isaretler.
 * Ustundeki olaylar gecmis, altindakiler onumuzde. Gun ici islem yapan
 * biri icin listedeki en isine yarar tek cizgi budur: nerede
 * durdugunu aramadan gorur.
 *
 * Yalnizca bugunun blogunda cizilir.
 */
export default function NowLine() {
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Istanbul",
        }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (clock === null) return null;

  return (
    <div
      className="relative grid grid-cols-[3.25rem_3.5rem_1fr] items-center gap-x-2 py-1 sm:grid-cols-[3.75rem_4rem_1fr] sm:gap-x-3"
      role="separator"
      aria-label={`Şu an ${clock}`}
    >
      <span className="t-num pl-3 text-[0.6875rem] text-[var(--verm)] sm:pl-4">{clock}</span>
      <span aria-hidden className="relative h-3">
        <span className="absolute top-1/2 left-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--verm)]" />
      </span>
      <span aria-hidden className="relative h-px">
        <span className="absolute inset-0 bg-[var(--verm)] opacity-45" />
      </span>
    </div>
  );
}
