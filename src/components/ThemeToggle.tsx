"use client";

import { useEffect, useState } from "react";

type Mode = "dark" | "light";

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("sismograf-theme");
    } catch {
      saved = null;
    }
    const initial: Mode =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    setMode(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  function toggle() {
    const next: Mode = mode === "light" ? "dark" : "light";
    setMode(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("sismograf-theme", next);
    } catch {
      // Gizli pencerede yazilamaz; tema yine de bu oturumda calisir.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "light" ? "Koyu temaya geç" : "Açık temaya geç"}
      className="t-label ml-1 rounded border border-[var(--hairline)] px-2 py-1.5 transition-colors hover:bg-[var(--bg-raise)] hover:text-[var(--text)]"
    >
      {mode === "light" ? "Koyu" : "Açık"}
    </button>
  );
}
