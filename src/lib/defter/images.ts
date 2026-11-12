"use client";

/**
 * Gorsel deposu: ekran goruntuleri Blob olarak IndexedDB'de durur.
 *
 * Kaydetmeden once olcek dusurulur ve WebP'ye cevrilir. TradingView'den
 * alinan 3 MB'lik bir PNG, 200 KB civarina iner: hem veritabani sismez
 * hem yapay zekaya gonderilen istek hizli kalir.
 */

import { getOne, newId, put, remove } from "./db";
import type { StoredImage } from "./types";

const MAX_EDGE = 1800;
const QUALITY = 0.86;

const urlCache = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();

async function shrink(file: Blob): Promise<{ blob: Blob; type: string }> {
  // GIF ve SVG'yi oldugu gibi birak: biri animasyon, digeri vektor.
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return { blob: file, type: file.type };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, type: file.type || "image/png" };
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!encoded || encoded.size >= file.size) {
      return { blob: file, type: file.type || "image/png" };
    }
    return { blob: encoded, type: "image/webp" };
  } catch {
    return { blob: file, type: file.type || "image/png" };
  }
}

export async function storeImage(file: Blob, name = "ekran"): Promise<string> {
  const { blob, type } = await shrink(file);
  const record: StoredImage = {
    id: newId("img"),
    blob,
    type,
    name,
    createdAt: new Date().toISOString(),
  };
  await put("images", record);
  urlCache.set(record.id, URL.createObjectURL(blob));
  return record.id;
}

export async function dropImage(id: string): Promise<void> {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
  loading.delete(id);
  await remove("images", id);
}

export function cachedUrl(id: string): string | undefined {
  return urlCache.get(id);
}

export function loadImageUrl(id: string): Promise<string | null> {
  const hit = urlCache.get(id);
  if (hit) return Promise.resolve(hit);
  const inflight = loading.get(id);
  if (inflight) return inflight;

  const task = getOne<StoredImage>("images", id)
    .then((record) => {
      if (!record) return null;
      const url = URL.createObjectURL(record.blob);
      urlCache.set(id, url);
      return url;
    })
    .catch(() => null);

  loading.set(id, task);
  return task;
}

export async function imageAsBase64(
  id: string,
): Promise<{ media_type: string; data: string } | null> {
  const record = await getOne<StoredImage>("images", id);
  if (!record) return null;
  const buffer = await record.blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { media_type: record.type || "image/webp", data: btoa(binary) };
}

/** Panoya yapistirilan ya da surukle-birak ile gelen gorselleri toplar. */
export function filesFromTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file && file.type.startsWith("image/")) out.push(file);
    }
  }
  if (out.length === 0) {
    for (const file of Array.from(data.files ?? [])) {
      if (file.type.startsWith("image/")) out.push(file);
    }
  }
  return out;
}
