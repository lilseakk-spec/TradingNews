import type { AffectedInstrument, EventBrief, NewsEvent } from "@/lib/types";
import { instrumentName } from "@/lib/instruments";

/**
 * Çatal.
 *
 * Her haberin iki yolu vardir. Beklenti ortada bir cizgi; ustu bir kol,
 * alti bir kol. Sismografin sifir ekseni gibi: sapma hangi yone
 * olacaksa oraya acilir.
 *
 * Haber aciklanmadan once iki kol esit agirlikta durur — hangisi olacagi
 * bilinmiyor. Aciklandiktan sonra catal kapanir: gerceklesen kol one
 * cikar, digeri soner. Boylece ayni gorsel hem beklentiyi hem sonucu
 * tasir, iki ayri bilesene gerek kalmaz.
 */

type Side = "above" | "below";

const SIDE_COLOR: Record<Side, string> = {
  above: "var(--amber)",
  below: "var(--sage)",
};

const SIDE_LABEL: Record<Side, string> = {
  above: "beklentinin üstü",
  below: "beklentinin altı",
};

const GLYPH: Record<Side, string> = { above: "▲", below: "▼" };

function Chips({ items }: { items: AffectedInstrument[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
      {items.slice(0, 6).map((a) => (
        <li
          key={a.symbol}
          className="t-num text-[0.6875rem] text-[var(--text-faint)]"
          title={instrumentName(a.symbol)}
        >
          {a.symbol}
        </li>
      ))}
    </ul>
  );
}

function Branch({
  side,
  text,
  items,
  state,
}: {
  side: Side;
  text: string;
  items: AffectedInstrument[];
  /** "open": henüz açıklanmadı. "hit": gerçekleşen kol. "miss": diğeri. */
  state: "open" | "hit" | "miss";
}) {
  const color = SIDE_COLOR[side];
  const dim = state === "miss";

  return (
    <div
      className="relative pl-5 transition-opacity"
      style={{ opacity: dim ? 0.38 : 1 }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-[1px] text-[0.625rem] leading-[1.4]"
        style={{ color: dim ? "var(--text-faint)" : color }}
      >
        {GLYPH[side]}
      </span>
      <p
        className="text-[0.6875rem] tracking-[0.08em] uppercase"
        style={{ color: dim ? "var(--text-faint)" : color }}
      >
        {SIDE_LABEL[side]}
        {state === "hit" && <span className="ml-1.5 normal-case tracking-normal">· gerçekleşen</span>}
      </p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">{text}</p>
      <Chips items={items} />
    </div>
  );
}

export default function EventFork({
  event,
  brief,
}: {
  event: NewsEvent;
  brief: EventBrief;
}) {
  const up = event.affected.filter((a) => a.direction === "yukari");
  const down = event.affected.filter((a) => a.direction === "asagi");

  // Sonuc geldiyse hangi kolun gerceklestigini ana olcunun sapmasi soyler.
  const primary = event.results?.[0];
  const surprise = primary?.surprise;
  const landed: Side | null =
    surprise === undefined || surprise === null
      ? null
      : Math.abs(surprise) < 1e-9
        ? null
        : surprise > 0
          ? "above"
          : "below";

  const stateFor = (side: Side): "open" | "hit" | "miss" =>
    landed === null ? "open" : landed === side ? "hit" : "miss";

  return (
    <section className="mt-6">
      <div className="flex items-center gap-3">
        <span className="t-label shrink-0">çatal</span>
        <span className="h-px flex-1 bg-[var(--hairline)]" />
        {event.forecast ? (
          <span className="t-num shrink-0 text-[0.75rem] text-[var(--text-dim)]">
            beklenti {event.forecast}
          </span>
        ) : (
          <span className="shrink-0 text-[0.75rem] text-[var(--text-faint)]">
            beklenti yok
          </span>
        )}
      </div>

      <div className="mt-3.5 space-y-4">
        <Branch side="above" text={brief.above} items={up} state={stateFor("above")} />
        <div className="ml-5 h-px bg-[var(--hairline)]" />
        <Branch side="below" text={brief.below} items={down} state={stateFor("below")} />
      </div>

      {landed === null && event.results?.length ? (
        <p className="mt-3 ml-5 text-[0.6875rem] text-[var(--text-faint)]">
          Gelen değer beklentiyle aynı — çatal açık kaldı.
        </p>
      ) : null}
    </section>
  );
}
