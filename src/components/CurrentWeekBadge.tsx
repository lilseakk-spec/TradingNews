"use client";

import { useEffect, useState } from "react";
import { trTodayISO } from "@/lib/weeks";

/**
 * "bu hafta" rozeti. Site statik kuruldugu icin tarih karsilastirmasi
 * tarayicida yapilir, yoksa rozet kurulum gunune sabitlenirdi.
 */
export default function CurrentWeekBadge({
  start,
  end,
}: {
  start: string;
  end: string;
}) {
  const [isCurrent, setIsCurrent] = useState(false);

  useEffect(() => {
    const check = () => {
      const today = trTodayISO();
      setIsCurrent(today >= start && today <= end);
    };
    check();
    const id = setInterval(check, 10 * 60_000);
    return () => clearInterval(id);
  }, [start, end]);

  if (!isCurrent) return null;

  return (
    <span
      className="t-label rounded-sm px-1.5 py-0.5"
      style={{ background: "var(--amber)", color: "#0f1626" }}
    >
      bu hafta
    </span>
  );
}
