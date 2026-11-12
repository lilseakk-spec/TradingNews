"use client";

/**
 * Market defteri: gun gun gozlem. Donus gordugunde, tez kurdugunda ya da
 * ders cikardiginda buraya yazilir — islemden bagimsiz.
 */

import { useMemo, useState } from "react";
import { blankNote } from "@/lib/defter/defaults";
import { useDefter } from "@/lib/defter/store";
import { NOTE_KINDS } from "@/lib/defter/taxonomy";
import type { MarketNote, NoteKind } from "@/lib/defter/types";
import { longDate } from "@/lib/weeks";
import { ImageDrop, Lightbox, Thumb } from "./media";
import { ChipPick, Empty, Field, Modal, Panel, Stat } from "./ui";

const KIND_COLOR: Record<NoteKind, string> = {
  reversal: "var(--violet)",
  gozlem: "var(--text-faint)",
  ders: "var(--amber)",
  tez: "var(--sage)",
  hata: "var(--verm)",
};

export default function Notlar() {
  const { notes } = useDefter();
  const [kind, setKind] = useState("hepsi");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MarketNote | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    return [...notes]
      .filter((note) => kind === "hepsi" || note.kind === kind)
      .filter((note) =>
        needle
          ? `${note.title} ${note.body} ${note.symbol ?? ""} ${note.tags.join(" ")}`
              .toLocaleLowerCase("tr")
              .includes(needle)
          : true,
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [notes, kind, query]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of notes) map.set(note.kind, (map.get(note.kind) ?? 0) + 1);
    return map;
  }, [notes]);

  return (
    <div className="flex flex-col gap-4">
      <section className="panel">
        <div className="grid grid-cols-3 gap-5 p-4 sm:grid-cols-5 sm:p-5">
          <Stat label="Kayıt" value={notes.length} />
          {NOTE_KINDS.slice(0, 4).map((item) => (
            <Stat key={item.id} label={item.label} value={counts.get(item.id) ?? 0} size="sm" />
          ))}
        </div>
      </section>

      <Panel bodyClass="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="hepsi">Tüm türler</option>
            {NOTE_KINDS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Başlık, metin, etiket ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            + Not
          </button>
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <Panel>
          <Empty
            title="Defter boş"
            hint="Piyasada gördüğünü yaz: dönüş, likidite oyunu, haftalık tez. Not tutmayan trader aynı dersi üç kere öğrenir."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => {
                setEditing(note);
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <NoteForm open={open} note={editing} onClose={() => setOpen(false)} />
    </div>
  );
}

function NoteCard({ note, onEdit }: { note: MarketNote; onEdit: () => void }) {
  const [lightbox, setLightbox] = useState(-1);
  const color = KIND_COLOR[note.kind];

  return (
    <article className="panel edge" style={{ "--edge": color } as React.CSSProperties}>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="t-eyebrow">
              <span style={{ color }}>
                {NOTE_KINDS.find((k) => k.id === note.kind)?.label}
              </span>
              {" · "}
              {longDate(note.date)}
              {note.symbol ? ` · ${note.symbol}` : ""}
              {note.timeframe ? ` · ${note.timeframe}` : ""}
            </div>
            <h3 className="t-display mt-1 text-[1rem] text-[var(--text)]">{note.title || "—"}</h3>
          </div>
          <button type="button" className="btn" onClick={onEdit}>
            Düzenle
          </button>
        </div>

        {note.body && (
          <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[var(--text-dim)]">
            {note.body}
          </p>
        )}

        {note.imageIds.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {note.imageIds.map((id, index) => (
              <button
                key={id}
                type="button"
                className="aspect-[4/3] overflow-hidden border border-[var(--hairline)]"
                onClick={() => setLightbox(index)}
              >
                <Thumb id={id} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {lightbox >= 0 && (
        <Lightbox
          ids={note.imageIds}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(-1)}
          caption={`${note.title} · ${note.date}`}
        />
      )}
    </article>
  );
}

function NoteForm({
  open,
  note,
  onClose,
}: {
  open: boolean;
  note: MarketNote | null;
  onClose: () => void;
}) {
  const { saveNote, removeNote } = useDefter();
  const [draft, setDraft] = useState<MarketNote>(() => note ?? blankNote());
  const [key, setKey] = useState("");

  const signature = `${open}-${note?.id ?? "yeni"}`;
  if (key !== signature) {
    setKey(signature);
    setDraft(note ? { ...note } : blankNote());
  }

  if (!open) return null;

  const patch = (next: Partial<MarketNote>) => setDraft((prev) => ({ ...prev, ...next }));

  return (
    <Modal
      open={open}
      wide
      eyebrow={note ? "notu düzenle" : "yeni not"}
      title="Market notu"
      onClose={onClose}
      footer={
        <>
          {note && (
            <button
              type="button"
              className="btn btn-danger mr-auto"
              onClick={async () => {
                if (confirm("Bu not silinsin mi?")) {
                  await removeNote(note.id);
                  onClose();
                }
              }}
            >
              Sil
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              await saveNote(draft);
              onClose();
            }}
          >
            Kaydet
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Tarih">
            <input
              type="date"
              className="input t-num"
              value={draft.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </Field>
          <Field label="Sembol">
            <input
              className="input"
              value={draft.symbol ?? ""}
              onChange={(e) => patch({ symbol: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Zaman dilimi">
            <input
              className="input t-num"
              value={draft.timeframe ?? ""}
              onChange={(e) => patch({ timeframe: e.target.value })}
            />
          </Field>
          <Field label="Etiketler" hint="virgülle">
            <input
              className="input"
              value={draft.tags.join(", ")}
              onChange={(e) =>
                patch({
                  tags: e.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
        </div>

        <Field label="Tür">
          <ChipPick
            options={NOTE_KINDS}
            value={draft.kind}
            onChange={(kind) => patch({ kind: kind as NoteKind })}
          />
        </Field>

        <Field label="Başlık">
          <input
            className="input"
            placeholder="NQ günlük dönüş — haftalık high süpürüldü"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </Field>

        <Field label="Metin">
          <textarea
            className="textarea"
            style={{ minHeight: "10rem" }}
            placeholder="Ne oldu, neden önemli, bundan ne öğrendin."
            value={draft.body}
            onChange={(e) => patch({ body: e.target.value })}
          />
        </Field>

        <Field label="Görseller">
          <ImageDrop ids={draft.imageIds} onChange={(imageIds) => patch({ imageIds })} />
        </Field>
      </div>
    </Modal>
  );
}
