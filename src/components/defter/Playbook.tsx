"use client";

/**
 * Gorsel playbook: islem alinmis olsun olmasin, gorulen her kurulum
 * ornegi. Yuz ornek biriktikten sonra bu sayfa kisisel bir ders kitabi
 * olur — model model, calisan ve calismayan ornekleriyle.
 */

import { useMemo, useState } from "react";
import { blankPlaybook } from "@/lib/defter/defaults";
import { useDefter } from "@/lib/defter/store";
import { MODELS, modelLabel } from "@/lib/defter/taxonomy";
import type { PlaybookItem, SetupOutcome } from "@/lib/defter/types";
import { shortDate } from "@/lib/weeks";
import { ImageDrop, Lightbox, Thumb } from "./media";
import { ChipPick, Empty, Field, Modal, Panel, Stat } from "./ui";

const OUTCOME_OPTIONS = [
  { id: "calisti", label: "Çalıştı" },
  { id: "calismadi", label: "Çalışmadı" },
  { id: "izlendi", label: "İzlendi" },
];

const OUTCOME_COLOR: Record<SetupOutcome, string> = {
  calisti: "var(--sage)",
  calismadi: "var(--verm)",
  izlendi: "var(--text-faint)",
};

export default function Playbook() {
  const { playbook } = useDefter();
  const [model, setModel] = useState("hepsi");
  const [outcome, setOutcome] = useState("hepsi");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PlaybookItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<PlaybookItem | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    return [...playbook]
      .filter((item) => model === "hepsi" || item.model === model)
      .filter((item) => outcome === "hepsi" || item.outcome === outcome)
      .filter((item) =>
        needle
          ? `${item.title} ${item.symbol} ${item.context} ${item.tags.join(" ")}`
              .toLocaleLowerCase("tr")
              .includes(needle)
          : true,
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [playbook, model, outcome, query]);

  const byModel = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of playbook) counts.set(item.model, (counts.get(item.model) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [playbook]);

  const worked = playbook.filter((item) => item.outcome === "calisti").length;

  return (
    <div className="flex flex-col gap-4">
      <section className="panel">
        <div className="grid grid-cols-2 gap-5 p-4 sm:grid-cols-4 sm:p-5">
          <Stat label="Örnek" value={playbook.length} sub="kayıtlı kurulum" />
          <Stat
            label="Çalışan"
            value={worked}
            tone="up"
            sub={playbook.length ? `%${Math.round((worked / playbook.length) * 100)}` : "—"}
          />
          <Stat
            label="İşleme dönen"
            value={playbook.filter((item) => item.tookTrade).length}
            sub="gördüğünün kaçını aldın"
          />
          <Stat
            label="En çok"
            value={byModel[0] ? modelLabel(byModel[0][0]) : "—"}
            size="sm"
            sub={byModel[0] ? `${byModel[0][1]} örnek` : undefined}
          />
        </div>
      </section>

      <Panel bodyClass="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
          <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="hepsi">Tüm modeller</option>
            {MODELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <select className="select" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="hepsi">Tüm sonuçlar</option>
            {OUTCOME_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Başlık, sembol, etiket ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + Örnek
          </button>
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <Panel>
          <Empty
            title="Playbook boş"
            hint="Gördüğün her kurulumu buraya at: MMXM, reversal, FVG tepkisi… İşlem almasan bile kaydet. Yüz örnek, yüz derstir."
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                İlk örneği ekle
              </button>
            }
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDetail(item)}
              className="panel group overflow-hidden text-left transition-colors hover:bg-[var(--bg-raise)]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[var(--hairline)] bg-[var(--bg-raise)]">
                {item.imageIds[0] ? (
                  <Thumb id={item.imageIds[0]} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="t-label">görsel yok</span>
                  </div>
                )}
                <span
                  className="t-label absolute left-0 top-0 bg-[var(--bg)]/85 px-1.5 py-1"
                  style={{ color: OUTCOME_COLOR[item.outcome] }}
                >
                  {OUTCOME_OPTIONS.find((o) => o.id === item.outcome)?.label}
                </span>
                {item.imageIds.length > 1 && (
                  <span className="t-label absolute right-0 top-0 bg-[var(--bg)]/85 px-1.5 py-1">
                    {item.imageIds.length}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <div className="t-eyebrow truncate">
                  {modelLabel(item.model)} · {item.timeframe}
                </div>
                <div className="mt-1 truncate text-[0.8125rem] font-medium text-[var(--text)]">
                  {item.title || item.symbol || "—"}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="t-num text-[0.625rem] text-[var(--text-faint)]">
                    {item.symbol} · {shortDate(item.date)}
                  </span>
                  <span className="t-num text-[0.625rem]" style={{ color: "var(--amber)" }}>
                    {"★".repeat(item.quality)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <PlaybookDetail
        item={detail}
        onClose={() => setDetail(null)}
        onEdit={(item) => {
          setDetail(null);
          setEditing(item);
          setFormOpen(true);
        }}
      />
      <PlaybookForm open={formOpen} item={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function PlaybookDetail({
  item,
  onClose,
  onEdit,
}: {
  item: PlaybookItem | null;
  onClose: () => void;
  onEdit: (item: PlaybookItem) => void;
}) {
  const [lightbox, setLightbox] = useState(-1);
  if (!item) return null;

  return (
    <Modal
      open
      wide
      eyebrow={`${modelLabel(item.model)} · ${item.timeframe} · ${item.date}`}
      title={item.title || item.symbol || "Kurulum"}
      onClose={onClose}
      footer={
        <button type="button" className="btn" onClick={() => onEdit(item)}>
          Düzenle
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {item.imageIds.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {item.imageIds.map((id, index) => (
              <button
                key={id}
                type="button"
                className="border border-[var(--hairline)]"
                onClick={() => setLightbox(index)}
              >
                <Thumb id={id} className="w-full object-contain" />
              </button>
            ))}
          </div>
        )}

        {item.context && (
          <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[var(--text-dim)]">
            {item.context}
          </p>
        )}

        {item.criteria.length > 0 && (
          <div>
            <span className="t-label block pb-1.5">Şartlar</span>
            <ul className="flex flex-col gap-1">
              {item.criteria.map((line) => (
                <li key={line} className="text-[0.875rem] leading-relaxed text-[var(--text-dim)]">
                  — {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <span className="chip" style={{ color: OUTCOME_COLOR[item.outcome] }}>
            {OUTCOME_OPTIONS.find((o) => o.id === item.outcome)?.label}
          </span>
          <span className="chip">kalite {item.quality}/5</span>
          <span className="chip">{item.tookTrade ? "işlem alındı" : "işlem alınmadı"}</span>
          {item.tags.map((tag) => (
            <span key={tag} className="chip">
              {tag}
            </span>
          ))}
        </div>

        {lightbox >= 0 && (
          <Lightbox
            ids={item.imageIds}
            index={lightbox}
            onIndex={setLightbox}
            onClose={() => setLightbox(-1)}
            caption={`${item.symbol} · ${modelLabel(item.model)}`}
          />
        )}
      </div>
    </Modal>
  );
}

function PlaybookForm({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: PlaybookItem | null;
  onClose: () => void;
}) {
  const { savePlaybook, removePlaybook } = useDefter();
  const [draft, setDraft] = useState<PlaybookItem>(() => item ?? blankPlaybook());
  const [key, setKey] = useState("");

  // Form her acilista yeniden kurulur.
  const signature = `${open}-${item?.id ?? "yeni"}`;
  if (key !== signature) {
    setKey(signature);
    setDraft(item ? { ...item } : blankPlaybook());
  }

  if (!open) return null;

  const patch = (next: Partial<PlaybookItem>) => setDraft((prev) => ({ ...prev, ...next }));

  return (
    <Modal
      open={open}
      wide
      eyebrow={item ? "örneği düzenle" : "yeni örnek"}
      title="Playbook kaydı"
      onClose={onClose}
      footer={
        <>
          {item && (
            <button
              type="button"
              className="btn btn-danger mr-auto"
              onClick={async () => {
                if (confirm("Bu örnek silinsin mi?")) {
                  await removePlaybook(item.id);
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
              await savePlaybook({ ...draft, symbol: draft.symbol.trim().toUpperCase() });
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
          <Field label="Model">
            <select
              className="select"
              value={draft.model}
              onChange={(e) => patch({ model: e.target.value })}
            >
              {MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sembol">
            <input
              className="input"
              value={draft.symbol}
              onChange={(e) => patch({ symbol: e.target.value })}
            />
          </Field>
          <Field label="Zaman dilimi">
            <input
              className="input t-num"
              value={draft.timeframe}
              onChange={(e) => patch({ timeframe: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Başlık">
          <input
            className="input"
            placeholder="Asya high süpürüldü, 15m FVG'ye dönüş"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </Field>

        <Field label="Bağlam">
          <textarea
            className="textarea"
            placeholder="Ne gördün, hangi şartlar vardı, ne bekledin."
            value={draft.context}
            onChange={(e) => patch({ context: e.target.value })}
          />
        </Field>

        <Field label="Şartlar" hint="her satır bir şart">
          <textarea
            className="textarea"
            value={draft.criteria.join("\n")}
            onChange={(e) =>
              patch({
                criteria: e.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Sonuç">
            <ChipPick
              options={OUTCOME_OPTIONS}
              value={draft.outcome}
              onChange={(outcome) => patch({ outcome: outcome as SetupOutcome })}
            />
          </Field>
          <Field label="Kalite">
            <ChipPick
              options={[1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: "★".repeat(n) }))}
              value={String(draft.quality)}
              onChange={(quality) => patch({ quality: Number(quality) })}
            />
          </Field>
          <Field label="İşlem alındı mı">
            <ChipPick
              options={[
                { id: "evet", label: "Alındı" },
                { id: "hayir", label: "Alınmadı" },
              ]}
              value={draft.tookTrade ? "evet" : "hayir"}
              onChange={(value) => patch({ tookTrade: value === "evet" })}
            />
          </Field>
        </div>

        <Field label="Etiketler" hint="virgülle ayır">
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

        <Field label="Görseller">
          <ImageDrop ids={draft.imageIds} onChange={(imageIds) => patch({ imageIds })} />
        </Field>
      </div>
    </Modal>
  );
}
