"use client";

/**
 * Yapay zeka analizi — disaridan bakan, memnun etmeye calismayan bir goz.
 *
 * Cagri dogrudan tarayicidan Anthropic'e gider. Anahtar kullanicinin
 * kendi anahtaridir, IndexedDB'de durur ve baska hicbir yere gonderilmez.
 * Analiz yalnizca kullanici dugmeye bastiginda calisir.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  accountState,
  disciplineScore,
  mistakeStats,
  money,
  monthIdOf,
  monthLabel,
  net,
  rStats,
  signedR,
  todayLocal,
  weekIdOf,
  weekLabel,
  bucketBy,
  byWeekday,
} from "./calc";
import { modelLabel, mistakeLabel } from "./taxonomy";
import type {
  Account,
  AiReport,
  CashFlow,
  MarketNote,
  PlaybookItem,
  Settings,
  Trade,
  WeeklyReview,
} from "./types";
import { imageAsBase64 } from "./images";
import { newId } from "./db";
import { rangeLabel, weekRange } from "@/lib/weeks";

export const MODEL_OPTIONS = [
  { id: "claude-opus-5-5", label: "Opus 5.5", hint: "en keskin analiz" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "hızlı ve ucuz" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", hint: "en ucuz" },
];

const HARSH = `Sen 15 yıldır prop fon masalarında çalışmış, ICT / smart money yöntemini
kemiğine kadar bilen bir kıdemli trader koçusun. Bir traderın defterini dışarıdan
inceliyorsun.

Tavrın:
- Dobra ol. Kullanıcıyı memnun etmeye çalışma, moral verme, "güzel gidiyorsun" deme.
- Övgü yalnızca sayılarla kanıtlanıyorsa yazılır; kanıt yoksa yazılmaz.
- Hatayı yumuşatmadan yüzüne söyle. Ama hakaret etme; sert ol, aşağılama.
- Genel geçer tavsiye yazma. Her cümle bu kişinin verisine dayansın.
- Veride olmayan şeyi uydurma. Veri azsa "bu kadar örnekle şunu söyleyemem" de.
- Kısa yaz. Dolgu cümle, giriş-gelişme-sonuç nutku yok.

Yasaklar:
- Fiyat tahmini, al/sat önerisi, yatırım tavsiyesi verme. Geçmiş icrayı değerlendir.
- Yapamayacağı sözler verme ("bunu yaparsan kazanırsın" gibi).

Dil: Türkçe. Biçim: sade markdown, yalnızca ## başlık, kısa paragraf ve - madde.`;

const SOFT = `Sen deneyimli bir prop fon trader koçusun. ICT / smart money yöntemini
biliyorsun. Bir traderın defterini dışarıdan inceliyorsun. Dürüst ve net ol,
hatayı açıkça söyle, ama dengeli bir dille yaz. Her cümle verilen veriye dayansın;
veride olmayanı uydurma. Fiyat tahmini ve yatırım tavsiyesi verme. Türkçe yaz,
sade markdown kullan.`;

export function systemPrompt(settings: Settings): string {
  const base = settings.tone === "sert" ? HARSH : SOFT;
  const who = settings.traderName ? `\n\nTraderın adı: ${settings.traderName}.` : "";
  return `${base}${who}

Traderın kendi kuralları:
- Haftalık işlem kotası: ${Object.entries(settings.weeklyLimits)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ")}
- Her işlemde risk 1R.
- Hedef en az ${settings.minR}R, en çok ${settings.maxR}R.

Bu kurallar ölçüttür. Kuralın dışına çıkılmışsa sonuç kârlı olsa bile hata sayılır.`;
}

/* ── Veri ozetleri ───────────────────────────────────────────────── */

function tradeLine(trade: Trade, accounts: Account[]): string {
  const account = accounts.find((a) => a.id === trade.accountId);
  const parts = [
    trade.date,
    trade.symbol || trade.market,
    trade.direction === "long" ? "AL" : "SAT",
    modelLabel(trade.model),
    trade.session,
    `hedef ${trade.rTarget}R`,
    `sonuç ${signedR(trade.rResult)}`,
    money(net(trade)),
    `not ${trade.grade}`,
    trade.planned ? "planlı" : "PLAN DIŞI",
  ];
  if (trade.mistakes.length) {
    parts.push(`hata: ${trade.mistakes.map(mistakeLabel).join(", ")}`);
  }
  if (account) parts.push(`hesap: ${account.name}`);
  if (trade.emotion) parts.push(`ruh hali: ${trade.emotion}`);
  if (trade.note) parts.push(`not: ${trade.note.slice(0, 220)}`);
  return `- ${parts.join(" · ")}`;
}

function statsBlock(trades: Trade[]): string {
  const s = rStats(trades);
  if (s.count === 0) return "İşlem yok.";
  return [
    `İşlem: ${s.count} · Kazanan: ${s.wins} · Kaybeden: ${s.losses} · BE: ${s.breakeven}`,
    `Toplam: ${signedR(s.totalR)} (${money(s.netPnl)}) · Beklenti: ${signedR(s.expectancy)}/işlem`,
    `Kazanma oranı: %${Math.round(s.winRate * 100)} · Ortalama kazanç ${signedR(
      s.avgWinR,
    )} · Ortalama kayıp ${signedR(s.avgLossR)}`,
    `Profit factor: ${s.profitFactor ?? "—"} · Ortalama planlanan hedef: ${s.avgTargetR}R`,
    `En iyi ${signedR(s.bestR)} · En kötü ${signedR(s.worstR)} · Üst üste kayıp: ${s.maxLossStreak}`,
  ].join("\n");
}

function accountsBlock(accounts: Account[], trades: Trade[], flows: CashFlow[]): string {
  if (accounts.length === 0) return "Kayıtlı hesap yok.";
  const today = todayLocal();
  return accounts
    .map((account) => {
      const state = accountState(account, trades, flows, today);
      const rules = state.gauges
        .map((g) => `${g.label} ${g.value}${g.level === "tamam" ? "" : ` [${g.level.toUpperCase()}]`}`)
        .join(" · ");
      return [
        `- ${account.name} (${account.firm || "—"}, ${account.kind}, ${account.phase})`,
        `  bakiye ${money(state.balance)} · başlangıç ${money(account.startBalance)} · net ${money(
          state.netPnl,
        )} (%${state.returnPct})`,
        `  cebe giren net: ${money(state.realCash)} · ödenen ücret ${money(state.feesPaid)}`,
        rules ? `  kurallar: ${rules}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

function mistakeBlock(trades: Trade[]): string {
  const rows = mistakeStats(trades);
  if (rows.length === 0) return "Etiketlenmiş hata yok.";
  return rows
    .map((row) => `- ${row.label}: ${row.count} kez, ${row.rCost}R kayıp (${money(row.moneyCost)})`)
    .join("\n");
}

function notesBlock(notes: MarketNote[], playbook: PlaybookItem[]): string {
  const lines: string[] = [];
  for (const note of notes.slice(0, 20)) {
    lines.push(`- [${note.kind}] ${note.date} ${note.title}: ${note.body.slice(0, 240)}`);
  }
  for (const item of playbook.slice(0, 20)) {
    lines.push(
      `- [playbook] ${item.date} ${modelLabel(item.model)} ${item.symbol} ${item.timeframe} — ${
        item.title
      } (kalite ${item.quality}/5, ${item.outcome}${item.tookTrade ? ", işlem alındı" : ""})`,
    );
  }
  return lines.length ? lines.join("\n") : "Not ve playbook kaydı yok.";
}

export interface AnalysisContext {
  accounts: Account[];
  trades: Trade[];
  flows: CashFlow[];
  notes: MarketNote[];
  playbook: PlaybookItem[];
  reviews: WeeklyReview[];
  settings: Settings;
}

export function weeklyPayload(ctx: AnalysisContext, weekId: string): string {
  const weekTrades = ctx.trades.filter((t) => weekIdOf(t.date) === weekId);
  const discipline = disciplineScore(weekTrades, ctx.settings);
  const review = ctx.reviews.find((r) => r.id === weekId);
  const weekNotes = ctx.notes.filter((n) => weekIdOf(n.date) === weekId);
  const weekPlaybook = ctx.playbook.filter((p) => weekIdOf(p.date) === weekId);

  const previous = ctx.trades
    .filter((t) => weekIdOf(t.date) < weekId)
    .slice(-40);

  return `# HAFTA: ${weekId} (${weekLabel(weekId)})

## Bu haftanın işlemleri
${weekTrades.length ? weekTrades.map((t) => tradeLine(t, ctx.accounts)).join("\n") : "Hiç işlem alınmadı."}

## Bu haftanın sayıları
${statsBlock(weekTrades)}

## Disiplin skoru: ${discipline.total}/100
${discipline.components.map((c) => `- ${c.label}: ${c.score}/${c.max} — ${c.detail}`).join("\n")}

## Hata etiketleri (bu hafta)
${mistakeBlock(weekTrades)}

## Hesaplar ve fon kuralları
${accountsBlock(ctx.accounts, ctx.trades, ctx.flows)}

## Bu haftanın notları ve playbook kayıtları
${notesBlock(weekNotes, weekPlaybook)}

## Traderın kendi haftalık değerlendirmesi
${
  review
    ? [
        `İyi gidenler: ${review.wins || "—"}`,
        `Hatalar: ${review.mistakes || "—"}`,
        `Ders: ${review.lesson || "—"}`,
        `Gelecek hafta odağı: ${review.focus || "—"}`,
        `Kendine verdiği not: ${review.selfGrade}/10`,
      ].join("\n")
    : "Trader bu hafta için değerlendirme yazmadı."
}

## Geçmiş işlemler (karşılaştırma için, en fazla son 40)
${previous.length ? previous.map((t) => tradeLine(t, ctx.accounts)).join("\n") : "Geçmiş kayıt yok."}

---

Şu başlıklarla yaz:

## Hüküm
İki üç cümle. Bu hafta gerçekte ne oldu.

## Sayılar ne diyor
Kazanç/kayıp değil, beklenti ve icra üzerinden oku. Örneklem küçükse söyle.

## Disiplin
Kurala uyuldu mu. Kârlı ama kuralsız işlem varsa özellikle göster.

## Tekrarlayan hata
Geçmiş haftalarla kıyasla. Aynı hata tekrar ediyorsa adını koy.

## En kötü karar
Sonucu değil, kararı seç. Neden kötü olduğunu tek paragrafta anlat.

## Gelecek hafta: 3 kural
Ölçülebilir, bu veriden çıkan üç madde.

## Sana bir soru
Traderın kendine dürüstçe cevap vermesi gereken tek soru.`;
}

export function monthlyPayload(ctx: AnalysisContext, monthId: string): string {
  const monthTrades = ctx.trades.filter((t) => monthIdOf(t.date) === monthId);
  const weeks = [...new Set(monthTrades.map((t) => weekIdOf(t.date)))].sort();
  const weekRows = weeks
    .map((id) => {
      const list = monthTrades.filter((t) => weekIdOf(t.date) === id);
      const s = rStats(list);
      const d = disciplineScore(list, ctx.settings);
      return `- ${weekLabel(id)}: ${list.length} işlem · ${signedR(s.totalR)} · ${money(
        s.netPnl,
      )} · disiplin ${d.total}/100`;
    })
    .join("\n");

  const byModel = bucketBy(monthTrades, (t) => t.model, modelLabel)
    .map(
      (b) =>
        `- ${b.label}: ${b.stats.count} işlem · ${signedR(b.stats.totalR)} · kazanma %${Math.round(
          b.stats.winRate * 100,
        )}`,
    )
    .join("\n");

  const bySession = bucketBy(monthTrades, (t) => t.session)
    .map((b) => `- ${b.label}: ${b.stats.count} işlem · ${signedR(b.stats.totalR)}`)
    .join("\n");

  const byDay = byWeekday(monthTrades)
    .map((b) => `- ${b.label}: ${b.stats.count} işlem · ${signedR(b.stats.totalR)}`)
    .join("\n");

  const cash = ctx.flows.filter((f) => monthIdOf(f.date) === monthId);
  const cashRows = cash.length
    ? cash.map((f) => `- ${f.date} ${f.type} ${money(f.amount)}${f.note ? ` (${f.note})` : ""}`).join("\n")
    : "Bu ay para giriş çıkışı yok.";

  return `# AY: ${monthId} (${monthLabel(monthId)})

## Ayın sayıları
${statsBlock(monthTrades)}

## Hafta hafta
${weekRows || "İşlem yok."}

## Modele göre
${byModel || "—"}

## Seansa göre
${bySession || "—"}

## Haftanın gününe göre
${byDay || "—"}

## Hata etiketleri (ay geneli)
${mistakeBlock(monthTrades)}

## Kasa hareketleri
${cashRows}

## Hesaplar ve fon kuralları
${accountsBlock(ctx.accounts, ctx.trades, ctx.flows)}

## Tüm işlemler (bu ay)
${monthTrades.length ? monthTrades.map((t) => tradeLine(t, ctx.accounts)).join("\n") : "Yok."}

---

Şu başlıklarla yaz:

## Ayın hükmü
Üç cümle. Süslemeden.

## Para gerçeği
Hesap bakiyeleri, ödenen ücretler ve cebe giren net para. Kâğıt üstündeki kârla
gerçek nakit aynı mı.

## Ne işe yarıyor
Hangi model, seans ve gün gerçekten para kazandırıyor. Örneklem yetersizse söyle.

## Ne işe yaramıyor
Bırakılması gereken model, seans ya da alışkanlık. Net ol.

## Tekrar eden desen
Aylık ölçekte görünen davranış kalıbı.

## Gelecek ay: tek değişiklik
Sadece bir tane. En çok fark yaratacak olan.

## Ölçüt
Gelecek ay bunun işe yarayıp yaramadığını nasıl anlayacağı — sayıyla.`;
}

export function tradePayload(trade: Trade, accounts: Account[]): string {
  const account = accounts.find((a) => a.id === trade.accountId);
  return `# TEK İŞLEM İNCELEMESİ

${tradeLine(trade, accounts)}

Ayrıntı:
- Tarih / saat: ${trade.date} ${trade.time || ""}
- Enstrüman: ${trade.symbol} (${trade.market})
- Yön: ${trade.direction} · Seans: ${trade.session} · Giriş zaman dilimi: ${trade.entryTf}
- Model: ${modelLabel(trade.model)} · HTF yönü: ${trade.htfBias}
- Giriş ${trade.entry ?? "—"} · Stop ${trade.stop ?? "—"} · Hedef ${trade.target ?? "—"} · Çıkış ${
    trade.exit ?? "—"
  }
- Risk: ${money(trade.riskAmount)} (1R) · Planlanan hedef ${trade.rTarget}R
- Sonuç: ${signedR(trade.rResult)} · ${money(net(trade))} · ${trade.outcome}
- Kontrol listesi: ${Object.entries(trade.checklist)
    .map(([k, v]) => `${k}=${v ? "evet" : "HAYIR"}`)
    .join(", ")}
- Hatalar: ${trade.mistakes.length ? trade.mistakes.map(mistakeLabel).join(", ") : "etiketlenmemiş"}
- Traderın notu: ${trade.note || "—"}
- Hesap: ${account ? `${account.name} (${account.firm}, ${account.phase})` : "—"}

Ekli görsel varsa grafiği oku: yapı, likidite, FVG/OB konumu, giriş yeri ve stop
yerleşimi hakkında ne görüyorsun.

Şu başlıklarla yaz, toplam 250 kelimeyi geçme:

## Kurulum
Model gerçekten oradaydı mı.

## Giriş ve stop
Zamanlama ve yerleşim doğru muydu.

## Yönetim
Hedef mantıklı mıydı, çıkış kararı doğru muydu.

## Hüküm
Tek cümle: bu işlem alınmalı mıydı, alındıysa doğru mu uygulandı.`;
}

/* ── Cagri ───────────────────────────────────────────────────────── */

export class AiError extends Error {}

interface AskOptions {
  settings: Settings;
  prompt: string;
  imageIds?: string[];
  maxTokens?: number;
}

export async function askClaude({
  settings,
  prompt,
  imageIds = [],
  maxTokens = 4000,
}: AskOptions): Promise<{ text: string; usage: { input: number; output: number } }> {
  if (!settings.apiKey) {
    throw new AiError("Önce Ayarlar ekranından Anthropic API anahtarını gir.");
  }

  const client = new Anthropic({
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const content: Anthropic.ContentBlockParam[] = [];
  for (const id of imageIds.slice(0, 6)) {
    const image = await imageAsBase64(id);
    if (!image) continue;
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.media_type as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: image.data,
      },
    });
  }
  content.push({ type: "text", text: prompt });

  try {
    const response = await client.messages.create({
      model: settings.model || "claude-opus-5-5",
      max_tokens: maxTokens,
      system: systemPrompt(settings),
      messages: [{ role: "user", content }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) throw new AiError("Model boş yanıt döndü.");

    return {
      text,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiError("API anahtarı geçersiz. Ayarlardan kontrol et.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiError("Anthropic sınırı doldu, biraz sonra tekrar dene.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiError(`Anthropic hatası (${error.status}): ${error.message}`);
    }
    throw new AiError(
      error instanceof Error ? error.message : "Analiz sırasında bilinmeyen bir hata oldu.",
    );
  }
}

export function makeReport(
  scope: AiReport["scope"],
  refId: string,
  label: string,
  model: string,
  content: string,
  usage: { input: number; output: number },
): AiReport {
  return {
    id: newId("rpt"),
    scope,
    refId,
    label,
    model,
    content,
    createdAt: new Date().toISOString(),
    usage,
  };
}

export function weekTitle(weekId: string): string {
  const parts = weekId.split("-W");
  const year = Number(parts[0]);
  const week = Number(parts[1]);
  // Hafta kimliginden okunabilir tarih araligi uretmek icin o haftanin
  // bir gunune geri don: 4 Ocak her zaman 1. haftadadir.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  const iso = monday.toISOString().slice(0, 10);
  const range = weekRange(iso);
  return `${weekLabel(weekId)} · ${rangeLabel(range.start, range.end)}`;
}
