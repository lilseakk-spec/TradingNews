"use client";

/** Defterin ortak arayuz parcalari. Tek yerde dursun ki ekranlar tutarli kalsin. */

import { useEffect, type ReactNode } from "react";
import type { RuleLevel } from "@/lib/defter/calc";

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
  bodyClass = "panel-body",
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="panel-head">
          <div className="min-w-0">
            {eyebrow && <div className="t-eyebrow mb-1">{eyebrow}</div>}
            {title && (
              <h2 className="t-display text-[0.9375rem] text-[var(--text)]">{title}</h2>
            )}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  size = "md",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "up" | "down" | "warn";
  size?: "sm" | "md" | "lg";
}) {
  const color =
    tone === "up"
      ? "var(--sage)"
      : tone === "down"
        ? "var(--verm)"
        : tone === "warn"
          ? "var(--amber)"
          : "var(--text)";
  const text = size === "lg" ? "text-[2rem]" : size === "sm" ? "text-[1.0625rem]" : "text-[1.375rem]";
  return (
    <div className="min-w-0">
      <div className="t-label truncate">{label}</div>
      <div className={`stat-num mt-1.5 ${text}`} style={{ color }}>
        {value}
      </div>
      {sub && <div className="t-eyebrow mt-1.5 normal-case tracking-[0.1em]">{sub}</div>}
    </div>
  );
}

const LEVEL_COLOR: Record<RuleLevel, string> = {
  tamam: "var(--sage)",
  uyari: "var(--amber)",
  ihlal: "var(--verm)",
};

export function Meter({ ratio, level = "tamam" }: { ratio: number; level?: RuleLevel }) {
  const width = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="meter" role="presentation">
      <span style={{ width: `${width}%`, background: LEVEL_COLOR[level] }} />
    </div>
  );
}

export function levelColor(level: RuleLevel): string {
  return LEVEL_COLOR[level];
}

export function Field({
  label,
  hint,
  children,
  wide = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="t-label block pb-1.5">{label}</span>
      {children}
      {hint && <span className="t-eyebrow mt-1 block normal-case tracking-[0.08em]">{hint}</span>}
    </label>
  );
}

export interface ChipOption {
  id: string;
  label: string;
  hint?: string;
}

export function ChipPick<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          title={option.hint}
          aria-pressed={option.id === value}
          className={`chip ${option.id === value ? "chip-on" : ""}`}
          onClick={() => onChange(option.id as T)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ChipMulti({
  options,
  value,
  onChange,
}: {
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = value.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            title={option.hint}
            aria-pressed={on}
            className={`chip ${on ? "chip-on" : ""}`}
            onClick={() =>
              onChange(on ? value.filter((id) => id !== option.id) : [...value, option.id])
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  title,
  eyebrow,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="scrim" onClick={onClose} role="presentation" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`sheet-in relative z-10 flex max-h-[92dvh] w-full flex-col border border-[var(--hairline)] bg-[var(--bg-surface)] ${
          wide ? "sm:max-w-[920px]" : "sm:max-w-[620px]"
        }`}
      >
        <header className="panel-head shrink-0">
          <div>
            {eyebrow && <div className="t-eyebrow mb-1">{eyebrow}</div>}
            <h2 className="t-display text-[1rem] text-[var(--text)]">{title}</h2>
          </div>
          <button type="button" className="btn" onClick={onClose} aria-label="Kapat">
            Kapat
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--hairline)] px-4 py-3 sm:px-5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="t-display text-[1.125rem] text-[var(--text-dim)]">{title}</div>
      {hint && <p className="max-w-[46ch] text-[0.875rem] leading-relaxed text-[var(--text-faint)]">{hint}</p>}
      {action}
    </div>
  );
}

/** Kota halkasi: kac islem kullanildi, kac kaldi. */
export function Ring({
  used,
  limit,
  label,
  size = 68,
}: {
  used: number;
  limit: number;
  label: string;
  size?: number;
}) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const ratio = limit > 0 ? Math.min(1, used / limit) : used > 0 ? 1 : 0;
  const over = limit > 0 && used > limit;
  const color = over ? "var(--verm)" : ratio >= 1 ? "var(--amber)" : "var(--sage)";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-raise)"
          strokeWidth="5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="butt"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="t-num"
          fontSize={size / 3.4}
          fill="var(--text)"
        >
          {used}
        </text>
      </svg>
      <div className="t-label text-center leading-tight">{label}</div>
      <div className="t-eyebrow leading-none">{limit > 0 ? `sınır ${limit}` : "sınırsız"}</div>
    </div>
  );
}

/** R degerini yatay tik olarak gosterir: sifir ortada. */
export function RBar({ value, max = 4 }: { value: number; max?: number }) {
  const clamped = Math.max(-max, Math.min(max, value));
  const half = 50;
  const width = (Math.abs(clamped) / max) * half;
  const positive = clamped >= 0;
  return (
    <div className="relative h-3 w-full min-w-[72px]">
      <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--hairline)]" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2"
        style={{
          left: positive ? "50%" : `${half - width}%`,
          width: `${width}%`,
          background: positive ? "var(--sage)" : "var(--verm)",
        }}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 border border-[var(--hairline)] px-3 py-2 text-left transition-colors hover:bg-[var(--bg-raise)]"
    >
      <span className="t-label">{label}</span>
      <span
        className="relative h-4 w-8 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "var(--sage)" : "var(--bg-raise)" }}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full bg-[var(--bg)] transition-all"
          style={{ left: checked ? "1.125rem" : "0.125rem" }}
        />
      </span>
    </button>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error";
  children: ReactNode;
}) {
  const color = tone === "error" ? "var(--verm)" : tone === "warn" ? "var(--amber)" : "var(--violet)";
  return (
    <div
      className="flex items-start gap-2.5 border px-3 py-2.5 text-[0.8125rem] leading-relaxed"
      style={{
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <span className="mt-[0.3rem] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0 text-[var(--text-dim)]">{children}</div>
    </div>
  );
}
