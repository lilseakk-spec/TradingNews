# Sismograf — haftalık volatilite takvimi

Haftanın piyasa hareketi yaratacak haberlerini, her haberin etkilediği pariteleri
ve yapay zeka yorumunu tek ekranda toplayan yerel bir web uygulaması.

İşlem haftası **pazar** açılışından **cuma** kapanışına kadar beş kolon olarak
dizilir (PAZAR · SALI · ÇARŞAMBA · PERŞEMBE · CUMA). Takvimde pazartesi ya da
cumartesi olay varsa o günler de kendiliğinden eklenir, hiçbir haber düşmez.

## Kurulum

```bash
npm install
```

## Haftalık akış

Her hafta üç komut. İkincisi ve üçüncüsü aynı dosyayı büyütür.

```bash
npm run new-week
```

Ekonomik takvimi çeker, gürültüyü ayıklar, her haberi etkilediği paritelere eşler
ve `src/data/weeks/<hafta>.json` dosyasını yazar.

```bash
npm run ai
```

Yapay zeka yorumunu üretir: hafta tezi, risk rejimi, üç senaryo, izleme listesi,
riskler, her gün için bir odak cümlesi ve her haber için tek cümlelik yorum.
Aynı hafta dosyasına işler.

```bash
npm run dev
```

`http://localhost:3000` adresinde açar.

Takvim feed'i pazar günü yeni haftaya döner. Haftayı pazar ya da pazartesi
üretmek en doğru sonucu verir. `npm run new-week` ikinci kez çalıştığında
mevcut yapay zeka yorumlarını korur, yalnızca takvimi günceller.

### Diğer komutlar

```bash
npm run calendar
```

Takvimi indirip yalnızca önbelleğe yazar. `npm run new-week -- --offline` bu
önbellekten çalışır, ağa çıkmaz.

```bash
node scripts/new-week.ts --id 2026-W46
node scripts/ai-commentary.ts --id 2026-W46
node scripts/ai-commentary.ts --dry
```

`--id` belirli bir haftayı hedefler. `--dry` modele gidecek istek metnini yazar,
çağrı yapmaz — isteği gözden geçirmek için.

```bash
npm run apply-ai -- --file yorum.json
```

Yorumu API'siz girmek ya da üretilen yorumu elle düzeltmek için. Dosya biçimi
`npm run ai` çıktısıyla aynı.

## Yapay zeka yorumu

`npm run ai` Anthropic API'sini kullanır. Kimlik iki yoldan birinden gelir:

- `ANTHROPIC_API_KEY` ortam değişkeni
- `ant auth login` ile açılmış bir profil

Model `claude-opus-5-5`. Değiştirmek için `AI_MODEL` ortam değişkenini kullan.
İstek, yalnızca o haftanın takvimine dayanması, fiyat hedefi ve al/sat önerisi
vermemesi, mekanizmayı yazması için kısıtlanmıştır.

## Veri kaynakları

| Katman | Kaynak | Kapsam |
| --- | --- | --- |
| Makro takvim | Forex Factory haftalık JSON feed'i (ücretsiz, anahtarsız) | Faiz kararları, enflasyon, istihdam, PMI, petrol stokları |
| Elle giriş | `src/data/manual/<hafta>.json` | Kripto olayları, bilançolar, jeopolitik, ETF akışları |
| Yorum | Anthropic API | Hafta tezi, senaryolar, gün odakları, haber yorumları |

Feed kripto olayı taşımaz. Kripto tarafı iki kanaldan gelir: makro haberlerin
kriptoya eşlenmesi (TÜFE → BTCUSD gibi) ve elle giriş katmanı.

### Elle giriş katmanı

`src/data/manual/ORNEK.json` dosyası şablondur ve hiçbir haftaya karışmaz.
Kullanmak için hafta kimliğiyle kopyala:

```bash
cp src/data/manual/ORNEK.json src/data/manual/2026-W46.json
```

Düzenle, sonra `npm run new-week` çalıştır. Zorunlu alan yalnızca `title`;
kategori, oynaklık ve pariteler boş bırakılırsa kurallardan tamamlanır.
Alan listesi dosyanın içinde.

## Gürültü filtresi

Uygulama bilerek az haber gösterir. Bir haberin listeye girmesi için:

- feed'de **yüksek etkili** olması, ya da
- özel bir kurala takılması ve feed'de **en az orta etkili** olması, ya da
- `always` işaretli bir kurala takılması (kripto, OPEC, jeopolitik, NFP, TÜFE, FOMC)

Bunu geçen haber, takip evrenindeki en az bir enstrümana değmek zorundadır;
değmiyorsa listeye hiç girmez. Düşük etkili veriler ve ikinci kademe merkez
bankası konuşmaları da düşer.
Aynı gün, aynı para birimi ve aynı kategoride birbirine yakın saatte açıklanan
olaylar tek satırda toplanır — bir faiz kararı feed'de dört beş satıra bölünür,
trader için tek olaydır. Katlanan başlıklar kartta "aynı anda" satırında durur.

Tipik sonuç: 110-120 satırlık feed'den 15-25 haber.

## Takip evreni

28 enstrüman, dört grup:

| Grup | Enstrümanlar |
| --- | --- |
| Kripto | BTCUSD, ETHUSD, SOLUSD, XRPUSD, TOTAL, TOTAL3, BTC.D |
| Endeks | US100, US500, DAX40, NIKKEI225, FTSE100, VIX |
| Forex | DXY, EURUSD, USDJPY, GBPUSD, AUDUSD, USDCAD, USDCHF, NZDUSD, EURJPY |
| Emtia & tahvil | XAUUSD, WTI, BRENT, US10Y, US02Y, DE10Y |

`src/lib/instruments.ts` bu listenin tek doğruluk kaynağıdır. Daraltmak için
satır sil, genişletmek için satır ekle — başka hiçbir yeri değiştirmek gerekmez.
Sildiğin bir sembol `impact.ts` kurallarında geçse bile eşlemeden otomatik
düşer, hiçbir paritesi kalmayan haber de listeye hiç girmez. Yani evreni
daraltmak haber sayısını da düşürür.

Listeyi değiştirdikten sonra:

```bash
npm run check
```

Kurallarda geçip kayıt defterinde olmayan sembolleri, hiçbir kuralın
dokunmadığı enstrümanları ve arşivdeki haftalarda her enstrümana kaç haberin
değdiğini raporlar. Bir sonraki daraltmayı bu rapora bakarak yap.

## Haber → parite eşlemesi

`src/lib/impact.ts` iki kademeli çalışır:

1. **Özel kural** — FOMC, TÜFE, tarım dışı istihdam, OPEC, ETF akışı gibi
   tanımlı olaylar. Kategoriyi, oynaklık tabanını ve parite listesini verir.
2. **Para birimi haritası** — özel kural yoksa olayın para birimine göre
   varsayılan pariteler atanır. USD haberi DXY, EURUSD, USDJPY, XAUUSD, US500,
   BTCUSD ve US10Y'ye düşer.

Oynaklık skoru, kuralın tabanının feed etkisiyle ağırlıklandırılmasıyla çıkar.
Yeni bir kural eklemek `RULES` dizisine bir nesne yazmaktır; sıra önemlidir,
özelden genele gider.

## Ekran

Sayfanın üstündeki **sismograf** haftanın tamamını tek grafikte gösterir.
Dört yatay şerit dört varlık grubudur, yatay eksen haftanın zamanıdır, her tik
bir haberin o gruba etkisidir. Tik yüksekliği beklenen oynaklık, rengi etki
şiddeti. Tike tıklamak aşağıdaki habere gider. Kesikli dikey çizgi şu anki TRT
saatidir.

Altında yapay zeka yorumu, sonra grup filtreleri ve gün gün haber listesi.
`Arşiv` geçmiş haftaları, `Pariteler` takip evrenini listeler.

## Dosya düzeni

```
src/
  app/                 sayfalar: ana ekran, hafta/[id], arsiv, pariteler
  components/          sismograf, haber kartı, yorum paneli, filtreler
  lib/
    types.ts           veri modeli
    instruments.ts     takip evreni
    impact.ts          haber → parite kuralları ve gürültü filtresi
    calendar.ts        feed ingest, Türkçeleştirme, kümeleme
    weeks.ts           hafta matematiği ve tarih biçimleri
    labels.ts          etiketler ve renk eşlemesi
    store.ts           hafta dosyalarını okuma
  data/
    weeks/             haftalık veri, hafta başına bir JSON
    manual/            elle girilen olaylar
    cache/             indirilen ham feed
scripts/
  fetch-calendar.ts    feed indir
  new-week.ts          hafta dosyası üret
  ai-commentary.ts     yorum üret (Anthropic API)
  apply-commentary.ts  elle yazılmış yorumu işle
  check-universe.ts    takip evrenini denetle
```

Scriptler Node 24'ün yerleşik TypeScript desteğiyle doğrudan çalışır, derleme
adımı yok.

## Yayın

Site GitHub Pages'te statik olarak yayınlanır. `next build` tüm sayfaları
`out/` klasörüne üretir; veri dosyaları depoda durduğu için sayfalar kurulum
anında oluşur.

İki iş akışı var:

| Dosya | Ne yapar |
| --- | --- |
| `.github/workflows/yayinla.yml` | `main`'e her push'ta siteyi kurar ve Pages'e gönderir. Taban yolunu depo adından kendi hesaplar. |
| `.github/workflows/haftalik-veri.yml` | Her pazar 09:00 TRT'de takvimi çeker, hafta dosyasını üretir ve commit eder. Bu commit de yayını tetikler. |

Haftalık veri iş akışının yapay zeka adımı için depoya bir secret ekle:
**Settings → Secrets and variables → Actions → New repository secret**, ad
`ANTHROPIC_API_KEY`. Secret yoksa o adım atlanır, takvim yine güncellenir.

Yani kurulumdan sonra uygulama kendi kendine işler: pazar sabahı yeni hafta
gelir, site yenilenir. Elle müdahale yalnızca manuel kripto olaylarını girmek
için gerekir.

Yerelde taban yolu boştur, `npm run dev` olduğu gibi çalışır. Proje
sayfalarında taban yolu `/<depo-adı>` olur ve iş akışı bunu otomatik verir.

## Uyarı

Takvim verisi üçüncü taraf bir feed'den gelir, hata ve gecikme içerebilir.
Saatler TRT'ye çevrilir. Yorumlar yapay zeka tarafından üretilir ve yatırım
tavsiyesi değildir.
