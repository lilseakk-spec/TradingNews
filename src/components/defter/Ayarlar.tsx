"use client";

/**
 * Ayarlar: kurallar, yapay zeka anahtari ve veri yedegi.
 *
 * Veri tarayicida durdugu icin yedek almak kullanicinin sorumlulugunda.
 * Bu ekran bunu saklamaz, acikca soyler.
 */

import { useEffect, useState } from "react";
import { MODEL_OPTIONS } from "@/lib/defter/ai";
import { storageEstimate } from "@/lib/defter/db";
import { useDefter } from "@/lib/defter/store";
import { MARKETS } from "@/lib/defter/taxonomy";
import type { Market } from "@/lib/defter/types";
import { Banner, ChipPick, Field, Panel, Stat } from "./ui";

export default function Ayarlar() {
  const {
    settings,
    saveSettings,
    exportAll,
    importAll,
    wipe,
    accounts,
    trades,
    notes,
    playbook,
    reports,
  } = useDefter();

  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    void storageEstimate().then(setUsage);
  }, [trades.length, playbook.length, notes.length]);

  async function download() {
    const blob = await exportAll();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `defter-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Yedek indirildi. Bulut klasörüne kopyalamayı unutma.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Kurallar" eyebrow="kendi şartların">
          <div className="flex flex-col gap-4">
            <Field label="Trader adı" hint="yapay zeka raporunda kullanılır">
              <input
                className="input"
                value={settings.traderName}
                onChange={(e) => void saveSettings({ traderName: e.target.value })}
              />
            </Field>

            <div>
              <span className="t-label block pb-2">Haftalık işlem kotası</span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {MARKETS.map((market) => (
                  <Field key={market.id} label={market.label}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input t-num"
                      value={settings.weeklyLimits[market.id as Market] ?? 0}
                      onChange={(e) =>
                        void saveSettings({
                          weeklyLimits: {
                            ...settings.weeklyLimits,
                            [market.id]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <p className="t-eyebrow mt-2 normal-case tracking-[0.08em]">
                0 yazarsan o piyasada işlem beklenmiyor demektir; yine de kaydedebilirsin,
                kota aşımı olarak işaretlenir.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Varsayılan risk %" hint="bakiyenin yüzdesi">
                <input
                  type="number"
                  step="0.1"
                  className="input t-num"
                  value={settings.defaultRiskPct}
                  onChange={(e) => void saveSettings({ defaultRiskPct: Number(e.target.value) })}
                />
              </Field>
              <Field label="En az hedef (R)">
                <input
                  type="number"
                  step="0.5"
                  className="input t-num"
                  value={settings.minR}
                  onChange={(e) => void saveSettings({ minR: Number(e.target.value) })}
                />
              </Field>
              <Field label="En çok hedef (R)">
                <input
                  type="number"
                  step="0.5"
                  className="input t-num"
                  value={settings.maxR}
                  onChange={(e) => void saveSettings({ maxR: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Field label="Ana para birimi" hint="toplamlar bu birimle gösterilir">
              <select
                className="select"
                value={settings.baseCurrency}
                onChange={(e) => void saveSettings({ baseCurrency: e.target.value })}
              >
                {["USD", "EUR", "TRY", "GBP"].map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Panel>

        <Panel title="Yapay zeka" eyebrow="dış göz">
          <div className="flex flex-col gap-4">
            <Banner>
              Anahtar yalnızca bu tarayıcıda saklanır ve istek doğrudan senin cihazından
              Anthropic&apos;e gider. Yedek dosyasına yazılmaz. Anahtarı{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                console.anthropic.com
              </a>{" "}
              üzerinden alırsın.
            </Banner>

            <Field label="API anahtarı">
              <div className="flex gap-2">
                <input
                  className="input"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-ant-…"
                  autoComplete="off"
                  value={settings.apiKey}
                  onChange={(e) => void saveSettings({ apiKey: e.target.value.trim() })}
                />
                <button type="button" className="btn" onClick={() => setShowKey((prev) => !prev)}>
                  {showKey ? "Gizle" : "Göster"}
                </button>
              </div>
            </Field>

            <Field label="Model">
              <select
                className="select"
                value={settings.model}
                onChange={(e) => void saveSettings({ model: e.target.value })}
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} — {option.hint}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ton" hint="sert: övgü yok, hatayı yüzüne söyler">
              <ChipPick
                options={[
                  { id: "sert", label: "Dobra" },
                  { id: "dengeli", label: "Dengeli" },
                ]}
                value={settings.tone}
                onChange={(tone) => void saveSettings({ tone: tone as "sert" | "dengeli" })}
              />
            </Field>

            <p className="text-[0.8125rem] leading-relaxed text-[var(--text-faint)]">
              Analiz yalnızca sen düğmeye bastığında çalışır. Gönderilen veri: o döneme ait
              işlemler, hesap durumları, notlar ve senin yazdığın değerlendirme. Tek işlem
              incelemesinde ekli grafikler de gider.
            </p>
          </div>
        </Panel>
      </div>

      <Panel title="Veri" eyebrow="yedek ve bakım">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
            <Stat label="Hesap" value={accounts.length} size="sm" />
            <Stat label="İşlem" value={trades.length} size="sm" />
            <Stat label="Not" value={notes.length} size="sm" />
            <Stat label="Playbook" value={playbook.length} size="sm" />
            <Stat
              label="Depolama"
              value={usage ? `${(usage.usage / 1024 / 1024).toFixed(1)} MB` : "—"}
              size="sm"
              sub={usage && usage.quota ? `kota ${(usage.quota / 1024 / 1024 / 1024).toFixed(1)} GB` : undefined}
            />
          </div>

          <Banner tone="warn">
            Tüm veri bu tarayıcının deposunda. Tarayıcı verisini temizlersen ya da cihaz
            değiştirirsen kayıtlar gider. Haftada bir yedek al — bir tıklık iş.
          </Banner>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={download}>
              Yedek indir
            </button>

            <label className="btn cursor-pointer">
              Yedekten yükle
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  if (
                    !confirm(
                      "Yedekten yükleme mevcut tüm kayıtların yerine geçer. Devam edilsin mi?",
                    )
                  ) {
                    return;
                  }
                  try {
                    await importAll(file);
                    setMessage("Yedek yüklendi.");
                    setError(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Yedek okunamadı.");
                  }
                }}
              />
            </label>

            <button
              type="button"
              className="btn btn-danger ml-auto"
              onClick={async () => {
                if (!confirm("Bütün defter silinecek. Bu geri alınamaz. Emin misin?")) return;
                if (!confirm("Son uyarı: hesaplar, işlemler, notlar ve görseller gidecek.")) return;
                await wipe();
                setMessage("Defter sıfırlandı.");
              }}
            >
              Her şeyi sil
            </button>
          </div>

          {message && <Banner>{message}</Banner>}
          {error && <Banner tone="error">{error}</Banner>}

          <div className="border-t border-[var(--hairline)] pt-3">
            <span className="t-label block pb-1.5">Kısayollar</span>
            <p className="text-[0.8125rem] leading-relaxed text-[var(--text-dim)]">
              <strong className="t-num">Y</strong> — yeni işlem kaydı ·{" "}
              <strong className="t-num">Ctrl+V</strong> — form açıkken panodaki ekran
              görüntüsünü ekler · <strong className="t-num">Esc</strong> — pencereyi kapatır ·{" "}
              <strong className="t-num">← →</strong> — görsel görüntüleyicide gezinir
            </p>
          </div>

          <p className="t-eyebrow normal-case tracking-[0.08em]">
            {reports.length} yapay zeka raporu saklanıyor. Raporlar da yedeğe dahildir.
          </p>
        </div>
      </Panel>
    </div>
  );
}
