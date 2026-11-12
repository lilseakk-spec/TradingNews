/**
 * IndexedDB sarmalayicisi — bagimliliksiz, ince.
 *
 * Neden IndexedDB: ekran goruntuleri Blob olarak saklanir, localStorage'in
 * 5 MB siniri bir haftalik grafik arsivini bile tasimaz. Butun cagrilar
 * yalnizca tarayicida calisir; sunucu tarafinda cagrilirsa hata firlatir.
 */

export const DB_NAME = "defter";
export const DB_VERSION = 1;

export const STORES = [
  "accounts",
  "trades",
  "flows",
  "notes",
  "playbook",
  "reviews",
  "reports",
  "images",
  "meta",
] as const;

export type StoreName = (typeof STORES)[number];

let handle: Promise<IDBDatabase> | null = null;

export function browserReady(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export function openDB(): Promise<IDBDatabase> {
  if (!browserReady()) {
    return Promise.reject(new Error("IndexedDB yalnızca tarayıcıda açılır."));
  }
  if (handle) return handle;

  handle = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Baska bir sekme surum yukseltirse bu baglantiyi kapat, yoksa
      // yukseltme bloke olur.
      db.onversionchange = () => {
        db.close();
        handle = null;
      };
      resolve(db);
    };

    request.onerror = () => reject(request.error ?? new Error("Veritabanı açılamadı."));
    request.onblocked = () =>
      reject(new Error("Veritabanı başka bir sekmede açık, o sekmeyi kapatın."));
  });

  return handle;
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error("İşlem başarısız."));
      }),
  );
}

export function getAll<T>(store: StoreName): Promise<T[]> {
  return run<T[]>(store, "readonly", (s) => s.getAll());
}

export function getOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  return run<T | undefined>(store, "readonly", (s) => s.get(id));
}

export function put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
  return run<IDBValidKey>(store, "readwrite", (s) => s.put(value)).then(() => undefined);
}

export function remove(store: StoreName, id: string): Promise<void> {
  return run<undefined>(store, "readwrite", (s) => s.delete(id)).then(() => undefined);
}

export function bulkPut<T extends { id: string }>(
  store: StoreName,
  values: T[],
): Promise<void> {
  if (values.length === 0) return Promise.resolve();
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        const target = tx.objectStore(store);
        for (const value of values) target.put(value);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Toplu yazma başarısız."));
      }),
  );
}

export function clearStore(store: StoreName): Promise<void> {
  return run<undefined>(store, "readwrite", (s) => s.clear()).then(() => undefined);
}

export async function clearAll(): Promise<void> {
  for (const name of STORES) await clearStore(name);
}

/** Kaba depolama kullanimi — ayarlar ekraninda gosterilir. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!browserReady() || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}
