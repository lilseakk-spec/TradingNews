"use client";

/**
 * Defterin tek veri kapisi. Butun ekranlar buradan okur ve buraya yazar;
 * her yazma once hafizaya, sonra IndexedDB'ye gider — arayuz beklemez.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { bulkPut, clearAll, getAll, getOne, put, remove, type StoreName } from "./db";
import { dropImage, imageAsBase64, storeImage } from "./images";
import { DEFAULT_SETTINGS } from "./types";
import type {
  Account,
  AiReport,
  CashFlow,
  DefterData,
  MarketNote,
  PlaybookItem,
  Settings,
  StoredImage,
  Trade,
  WeeklyReview,
} from "./types";

interface Actions {
  saveAccount: (value: Account) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  saveTrade: (value: Trade) => Promise<void>;
  removeTrade: (id: string) => Promise<void>;
  saveFlow: (value: CashFlow) => Promise<void>;
  removeFlow: (id: string) => Promise<void>;
  saveNote: (value: MarketNote) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
  savePlaybook: (value: PlaybookItem) => Promise<void>;
  removePlaybook: (id: string) => Promise<void>;
  saveReview: (value: WeeklyReview) => Promise<void>;
  saveReport: (value: AiReport) => Promise<void>;
  removeReport: (id: string) => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  addImage: (file: Blob, name?: string) => Promise<string>;
  removeImage: (id: string) => Promise<void>;
  exportAll: () => Promise<Blob>;
  importAll: (file: File) => Promise<void>;
  wipe: () => Promise<void>;
}

interface DefterStore extends DefterData, Actions {
  ready: boolean;
  error: string | null;
}

const Ctx = createContext<DefterStore | null>(null);

const EMPTY: DefterData = {
  accounts: [],
  trades: [],
  flows: [],
  notes: [],
  playbook: [],
  reviews: [],
  reports: [],
  settings: DEFAULT_SETTINGS,
};

function upsert<T extends { id: string }>(list: T[], value: T): T[] {
  const at = list.findIndex((item) => item.id === value.id);
  if (at === -1) return [...list, value];
  const copy = [...list];
  copy[at] = value;
  return copy;
}

export function DefterProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DefterData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [accounts, trades, flows, notes, playbook, reviews, reports, settings] =
          await Promise.all([
            getAll<Account>("accounts"),
            getAll<Trade>("trades"),
            getAll<CashFlow>("flows"),
            getAll<MarketNote>("notes"),
            getAll<PlaybookItem>("playbook"),
            getAll<WeeklyReview>("reviews"),
            getAll<AiReport>("reports"),
            getOne<Settings>("meta", "settings"),
          ]);
        if (!alive) return;
        setData({
          accounts,
          trades,
          flows,
          notes,
          playbook,
          reviews,
          reports,
          settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
        });
        setReady(true);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Veri yüklenemedi.");
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const write = useCallback(
    async <T extends { id: string }>(store: StoreName, value: T, key: keyof DefterData) => {
      setData((prev) => ({
        ...prev,
        [key]: upsert(prev[key] as unknown as T[], value),
      }));
      await put(store, value);
    },
    [],
  );

  const erase = useCallback(
    async (store: StoreName, id: string, key: keyof DefterData) => {
      setData((prev) => ({
        ...prev,
        [key]: (prev[key] as unknown as { id: string }[]).filter((item) => item.id !== id),
      }));
      await remove(store, id);
    },
    [],
  );

  const actions = useMemo<Actions>(
    () => ({
      saveAccount: (value) =>
        write("accounts", { ...value, updatedAt: new Date().toISOString() }, "accounts"),
      removeAccount: async (id) => {
        // Hesap silinince ona bagli islem ve hareketler de gider — yoksa
        // toplamlar sahipsiz kayitla sismeye devam eder.
        const orphanTrades = data.trades.filter((t) => t.accountId === id);
        const orphanFlows = data.flows.filter((f) => f.accountId === id);
        for (const trade of orphanTrades) await remove("trades", trade.id);
        for (const flow of orphanFlows) await remove("flows", flow.id);
        setData((prev) => ({
          ...prev,
          accounts: prev.accounts.filter((a) => a.id !== id),
          trades: prev.trades.filter((t) => t.accountId !== id),
          flows: prev.flows.filter((f) => f.accountId !== id),
        }));
        await remove("accounts", id);
      },
      saveTrade: (value) =>
        write("trades", { ...value, updatedAt: new Date().toISOString() }, "trades"),
      removeTrade: (id) => erase("trades", id, "trades"),
      saveFlow: (value) => write("flows", value, "flows"),
      removeFlow: (id) => erase("flows", id, "flows"),
      saveNote: (value) =>
        write("notes", { ...value, updatedAt: new Date().toISOString() }, "notes"),
      removeNote: (id) => erase("notes", id, "notes"),
      savePlaybook: (value) =>
        write("playbook", { ...value, updatedAt: new Date().toISOString() }, "playbook"),
      removePlaybook: (id) => erase("playbook", id, "playbook"),
      saveReview: (value) =>
        write("reviews", { ...value, updatedAt: new Date().toISOString() }, "reviews"),
      saveReport: (value) => write("reports", value, "reports"),
      removeReport: (id) => erase("reports", id, "reports"),
      saveSettings: async (patch) => {
        const next: Settings = {
          ...data.settings,
          ...patch,
          id: "settings",
          updatedAt: new Date().toISOString(),
        };
        setData((prev) => ({ ...prev, settings: next }));
        await put("meta", next);
      },
      addImage: (file, name) => storeImage(file, name),
      removeImage: (id) => dropImage(id),

      exportAll: async () => {
        const images = await getAll<StoredImage>("images");
        const encoded = [];
        for (const image of images) {
          const payload = await imageAsBase64(image.id);
          if (payload) {
            encoded.push({
              id: image.id,
              name: image.name,
              createdAt: image.createdAt,
              type: payload.media_type,
              data: payload.data,
            });
          }
        }
        const dump = {
          format: "defter",
          version: 1,
          exportedAt: new Date().toISOString(),
          accounts: data.accounts,
          trades: data.trades,
          flows: data.flows,
          notes: data.notes,
          playbook: data.playbook,
          reviews: data.reviews,
          reports: data.reports,
          // Anahtar yedege yazilmaz: dosya paylasilirsa sizmasin.
          settings: { ...data.settings, apiKey: "" },
          images: encoded,
        };
        return new Blob([JSON.stringify(dump)], { type: "application/json" });
      },

      importAll: async (file) => {
        const text = await file.text();
        const dump = JSON.parse(text);
        if (dump?.format !== "defter") {
          throw new Error("Bu dosya bir defter yedeği değil.");
        }
        await clearAll();

        const images: StoredImage[] = (dump.images ?? []).map(
          (item: { id: string; name: string; createdAt: string; type: string; data: string }) => {
            const binary = atob(item.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            return {
              id: item.id,
              name: item.name,
              createdAt: item.createdAt,
              type: item.type,
              blob: new Blob([bytes], { type: item.type }),
            };
          },
        );

        const next: DefterData = {
          accounts: dump.accounts ?? [],
          trades: dump.trades ?? [],
          flows: dump.flows ?? [],
          notes: dump.notes ?? [],
          playbook: dump.playbook ?? [],
          reviews: dump.reviews ?? [],
          reports: dump.reports ?? [],
          settings: {
            ...DEFAULT_SETTINGS,
            ...(dump.settings ?? {}),
            // Yerel anahtar korunur; yedek onu tasimaz.
            apiKey: data.settings.apiKey,
            id: "settings",
          },
        };

        await bulkPut("accounts", next.accounts);
        await bulkPut("trades", next.trades);
        await bulkPut("flows", next.flows);
        await bulkPut("notes", next.notes);
        await bulkPut("playbook", next.playbook);
        await bulkPut("reviews", next.reviews);
        await bulkPut("reports", next.reports);
        await bulkPut("images", images);
        await put("meta", next.settings);
        setData(next);
      },

      wipe: async () => {
        await clearAll();
        setData({ ...EMPTY, settings: { ...DEFAULT_SETTINGS } });
      },
    }),
    [data, write, erase],
  );

  const value = useMemo<DefterStore>(
    () => ({ ...data, ready, error, ...actions }),
    [data, ready, error, actions],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDefter(): DefterStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDefter yalnızca DefterProvider içinde kullanılır.");
  return ctx;
}
