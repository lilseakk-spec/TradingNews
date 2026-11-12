"use client";

/**
 * Gorsel alani: panodan yapistir, surukle birak ya da dosya sec.
 *
 * Trader icin en hizli yol Ctrl+V — TradingView'de ekran goruntusu alip
 * forma yapistirmak. Onun icin form acikken pano dinlenir.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { filesFromTransfer, loadImageUrl } from "@/lib/defter/images";
import { useDefter } from "@/lib/defter/store";

export function Thumb({
  id,
  className = "",
  alt = "kayıt görseli",
}: {
  id: string;
  className?: string;
  alt?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadImageUrl(id).then((next) => {
      if (alive) setUrl(next);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (!url) {
    return <div className={`animate-pulse bg-[var(--bg-raise)] ${className}`} aria-hidden="true" />;
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

export function ImageDrop({
  ids,
  onChange,
  capturePaste = true,
  hint = "Ekran görüntüsünü Ctrl+V ile yapıştır, sürükle bırak ya da seç.",
}: {
  ids: string[];
  onChange: (next: string[]) => void;
  capturePaste?: boolean;
  hint?: string;
}) {
  const { addImage, removeImage } = useDefter();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const ingest = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      try {
        const added: string[] = [];
        for (const file of files) {
          added.push(await addImage(file, file.name));
        }
        onChange([...idsRef.current, ...added]);
      } finally {
        setBusy(false);
      }
    },
    [addImage, onChange],
  );

  useEffect(() => {
    if (!capturePaste) return;
    function onPaste(event: ClipboardEvent) {
      const files = filesFromTransfer(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      void ingest(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [capturePaste, ingest]);

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void ingest(filesFromTransfer(event.dataTransfer));
        }}
        className="border border-dashed px-3 py-3 transition-colors"
        style={{
          borderColor: over ? "var(--amber)" : "var(--hairline)",
          background: over ? "color-mix(in srgb, var(--amber) 8%, transparent)" : "transparent",
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Ekleniyor…" : "Görsel ekle"}
          </button>
          <span className="t-eyebrow normal-case tracking-[0.08em]">{hint}</span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void ingest(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />

        {ids.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ids.map((id) => (
              <div key={id} className="group relative aspect-[4/3] overflow-hidden border border-[var(--hairline)]">
                <Thumb id={id} className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="t-label absolute right-1 top-1 bg-[var(--bg)]/85 px-1.5 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  onClick={() => {
                    onChange(ids.filter((item) => item !== id));
                    void removeImage(id);
                  }}
                  aria-label="Görseli sil"
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Lightbox({
  ids,
  index,
  onClose,
  onIndex,
  caption,
}: {
  ids: string[];
  index: number;
  onClose: () => void;
  onIndex: (next: number) => void;
  caption?: string;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndex((index + 1) % ids.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + ids.length) % ids.length);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, ids.length, onClose, onIndex]);

  if (ids.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      <div className="scrim" onClick={onClose} role="presentation" />
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3">
        <span className="t-label truncate">{caption}</span>
        <div className="flex items-center gap-2">
          {ids.length > 1 && (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => onIndex((index - 1 + ids.length) % ids.length)}
              >
                ←
              </button>
              <span className="t-num text-[0.75rem] text-[var(--text-dim)]">
                {index + 1}/{ids.length}
              </span>
              <button type="button" className="btn" onClick={() => onIndex((index + 1) % ids.length)}>
                →
              </button>
            </>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
        <Thumb id={ids[index]} className="max-h-full max-w-full object-contain" />
      </div>
    </div>
  );
}
