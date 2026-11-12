# Sismograf — haftalık volatilite takvimi

Haftanın piyasa hareketi yaratacak haberlerini, her haberin etkilediği pariteleri
ve yapay zeka yorumunu tek ekranda toplayan web uygulaması.

**Canlı:** https://lilseakk-spec.github.io/TradingNews/

Sitenin ikinci bölümü **Defter**: trade günlüğü, fon hesapları, görsel
playbook ve yapay zeka analizi — `/defter` adresinde, verisi tarayıcıda
duran ayrı bir uygulama. Ayrıntı için [Defter bölümü](#defter).

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
| Makro takvim | Forex Factory haftalık JSON feed'i (ücretsiz, anahtarsız) | Faiz kararları, enflasyon, istihdam, PMI, petrol stokları — yalnızca bu hafta |
| Gelecek hafta | biquote.io (ücretsiz, anahtarsız) | Aynı kapsam, tarih aralığı sorgulanabilir — ön izleme için |
| Kripto takvimi | OKX açık API'si (ücretsiz, anahtarsız) | BTC ve ETH opsiyon vadeleri, açık pozisyon ağırlığıyla |
| Elle giriş | `src/data/manual/<hafta>.json` | ETF akışları, token unlock, bilançolar, jeopolitik |
| Yorum | Anthropic API | Hafta tezi, senaryolar, gün odakları, haber yorumları |

Ekonomik takvim feed'i kripto olayı taşımaz. Kripto tarafı üç kanaldan gelir:
makro haberlerin kriptoya eşlenmesi (TÜFE → BTCUSD gibi), otomatik opsiyon
vadesi kaynağı ve elle giriş katmanı.

### Gelecek hafta ön izlemesi

Forex Factory feed'i yalnızca içinde bulunulan haftayı verir — `nextweek`
ucu yok (404). Hafta ortasında gelecek haftaya bakabilmek için tarih aralığı
sorgulanabilen ikinci bir kaynak kullanılıyor: **biquote.io**, anahtarsız,
UTC zamanlı, önem seviyeli.

```bash
node scripts/new-week.ts --next
```

Çıktı Forex Factory satır biçimine çevrildiği için aynı ayıklama hattından
geçer: sınıflandırma, Türkçeleştirme, kümeleme ve gürültü filtresi aynen
çalışır.

Ön izleme haftası `preliminary: true` işaretlenir; ekranda mor bir **ön
izleme** rozeti ve "takvim henüz kesinleşmedi" uyarısı görünür. Pazar sabahı
Forex Factory'den kesin hali üretilince işaret kalkar.

Yapay zeka yorumu ön izleme için **cuma sabahı** üretilir, böylece hafta sonu
analizinde hazır olur. Hafta içi ön izleme her gün tazelenir ama yorumsuz
kalır — takvim değişirken yorum üretmenin anlamı yok.

### Opsiyon vadeleri

Kriptoda tarihi önceden belli, gerçekten oynaklık yaratan olayların başında
opsiyon vadeleri gelir: vade öncesi fiyat en büyük açık pozisyonun olduğu
seviyeye yapışır, vadeden sonra o baskı kalkar.

`src/lib/crypto-events.ts` OKX'in açık API'sinden BTC ve ETH opsiyon
vadelerini açık pozisyonlarıyla birlikte çeker. Açık pozisyon payı vadeyi
ağırlıklandırır — küçük bir günlük vade ile çeyreklik vade aynı muameleyi
görmez:

| Tip | Taban oynaklık | Etki |
| --- | --- | --- |
| Çeyreklik (Mart/Haziran/Eylül/Aralık son cuma) | 74 | yüksek |
| Aylık (ayın son cuması) | 66 | yüksek |
| Haftalık (diğer cumalar) | 48 | orta |

Takvimi kalabalıklaştırmamak için yalnızca cuma vadeleri listeye girer; cuma
dışı bir vade ancak açık pozisyon payı %12'yi geçerse eklenir. Tipik sonuç
haftada tek satır.

Kaynak erişilemezse hafta yine üretilir, sadece uyarı düşer. Tamamen atlamak
için `node scripts/new-week.ts --no-crypto`.

> Deribit en büyük opsiyon borsası ama Türkiye'den erişilemiyor. Aylık ve
> çeyreklik vadeler bütün borsalarda aynı gün ve saatte (son cuma 08:00 UTC =
> 11:00 TRT) olduğu için OKX aynı takvimi veriyor.

### Ani haberler

Takvim önceden bilinen olayları taşır. Takvimde olmayan, aniden olan şeyler
için `src/lib/breaking.ts` iki kaynağı tarayıcıdan doğrudan yoklar — ikisi de
ücretsiz, anahtarsız ve CORS'a açık:

| Kaynak | Ne verir | Gecikme | Yoklama |
| --- | --- | --- | --- |
| DefiLlama hack listesi | İsimli güvenlik ihlali, zincir, dolar tutarı | Saatler | 15 dk |
| Coinpaprika fiyat değişimi | BTC/ETH 1 saatlik sert hareket | Anlık | 2 dk |

Hack kaydı kurumsal ve doğrulanmış ama saatler içinde giriliyor: "oldu"
bilgisi kesin, "şu anda oluyor" değil. Fiyat şoku ise gerçekten anlık — kriz
çoğu zaman haber yazılmadan önce fiyatta görünür. İkisi birlikte hem hızı hem
doğrulamayı veriyor.

Eşikler: ihlal 100 mn $ üstü kritik, 10 mn $ üstü yüksek, borsa kaynaklı olay
tutar bilinmese de yüksek. Fiyat şoku 1 saatte %5 kritik, %3 yüksek, 24 saatte
%10 yüksek. Yalnızca yüksek ve kritik olanlar bildirim gönderir; görülen her
olay tarayıcıda saklanır, aynı şey iki kez bildirilmez.

Sayfa açıkken çalışır. Sekme kapalıyken bildirim için sunucu tarafında push
gerekir — GitHub Pages bunu yapamaz.

### Otomatikleştirilemeyen kısım

Token unlock ve ETF akışı için ücretsiz, anahtarsız ve birincil bir kaynak
bulunamadı. DefiLlama'nın unlock uçları Pro katmanına taşınmış (402 döner),
CoinGecko'nun etkinlik ucu kaldırılmış, geri kalan araçlar da DefiLlama'nın
ücretli verisini yeniden paketliyor. Bunlar elle giriş katmanında kalıyor.

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

Ekran yukarıdan aşağıya: ani haber şeridi, sıradaki haber kartı, görünüm
sekmeleri, sonra liste.

**Sıradaki haber** canlı geri sayımla en yakın olayı gösterir. "Uyarıları aç"
düğmesi tarayıcı bildirimini açar; kaç dakika önce uyarılacağı seçilebilir
(5 / 15 / 30 / 60). Süre gelince hem tarayıcı bildirimi gider hem sağ altta
bir kart çıkar.

**Bugün · Yarın · Hafta** sekmeleri listeyi daraltır. Varsayılan içinde
bulunulan gündür; arşiv haftalarında yalnızca "Hafta" görünür.

**Gün şeridi** (Hafta görünümünde) yedi kolonda haftanın şeklini verir: her
olay bir nokta, rengi etki şiddeti. Bir kolona tıklamak o güne filtreler.

**Liste ve detay** iki panellidir. Soldaki satırlarda yalnızca taramak için
gerekenler var: saat (TRT ve NY), başlık, bölge, en güçlü üç parite. Bir satıra
tıklayınca sağda detay açılır — tüm etkilenen pariteler yön yön gruplanmış ve
tam isimleriyle, beklenti ve önceki değerler, aynı anda açıklanan diğer
başlıklar, oynaklık çubuğu, yapay zeka yorumu ve kaynak.

Klavyeyle de gezilir: `↑` `↓` (ya da `k` `j`) haberler arasında, `Esc` detayı
kapatır. Dar ekranda detay alttan açılan bir sayfa olarak gelir.

`Arşiv` geçmiş haftaları, `Pariteler` takip evrenini listeler.

## Defter

`/defter` altındaki ikinci uygulama: trade günlüğü, fon hesapları ve kasa
muhasebesi. Takvim haftayı önden okur, defter haftayı geriye dönük hesaba
çeker.

**Veri tarayıcıda durur.** Sunucu yok, hesap yok, kayıt dışarı çıkmaz. Kayıtlar
IndexedDB'de tutulur, ekran görüntüleri Blob olarak saklanır. Tek istisna yapay
zeka analizidir: yalnızca düğmeye basıldığında, kullanıcının kendi anahtarıyla,
doğrudan tarayıcıdan Anthropic'e gider.

### Ekranlar

| Bölüm | Ne yapar |
| --- | --- |
| **Kokpit** | Toplam özkaynak, ay/hafta kâr-zararı, cebe giren gerçek para, haftalık kota halkaları, disiplin skoru, özkaynak eğrisi, bugün riske atılabilecek azami tutar ve takvimden gelen risk penceresi. |
| **Hesaplar** | Fon fon hesap kartları: bakiye, getiri, kural ölçerleri (günlük zarar, düşüş, kâr hedefi, işlem günü, süre, tutarlılık) ve kasa defteri. |
| **İşlemler** | Süzgeçli işlem listesi, R dağılımı, hafta özeti; her satırdan tek işlem incelemesi. |
| **Playbook** | Görsel kurulum kütüphanesi — işlem alınsın alınmasın her örnek: MMXM, dönüş, FVG tepkisi, kalite notu ve sonucuyla. |
| **Notlar** | Gün gün market defteri: dönüş, gözlem, ders, tez, hata. |
| **Analiz** | Haftalık ve aylık döküm, disiplin kırılımı, hata maliyeti, modele / seansa / güne göre dağılım, hafta kapanış değerlendirmesi ve yapay zeka raporu. |
| **Ayarlar** | Kotalar, risk kuralları, API anahtarı, model ve ton seçimi, yedek al / yükle. |

### Kurallar ölçüttür

Haftalık kota (varsayılan: 1 endeks + 1 kripto), 1R risk ve en az 2R hedef
Ayarlar'dan değiştirilir. Kota doluyken işlem kaydedilirse kayıt engellenmez —
**kota aşımı** olarak işaretlenir ve disiplin skorunu düşürür. Defterin işi
gerçeği tutmak, gerçeği güzelleştirmek değil.

Disiplin skoru 100 üzerinden altı başlıktan toplanır: kota uyumu (30), plan
uyumu (20), hedef disiplini (15), risk disiplini (15), kayıt disiplini (10),
kontrol listesi (10). Kârlı ama kuralsız bir hafta düşük skor alır.

### Kasa muhasebesi

Her para hareketi iki ayrı sütunu etkiler: **hesap bakiyesi** ve **cebe giren
gerçek para**.

| Hareket | Bakiye | Cep |
| --- | --- | --- |
| Para yatırma | artar | azalır |
| Para çekme · payout | azalır | artar |
| Challenge ücreti | değişmez | azalır |
| Ücret iadesi | değişmez | artar |
| Bonus | artar | değişmez |

Böylece "kâğıt üstünde ne kadar kazandım" ile "cebime ne girdi" ayrı durur —
challenge ücretleri dahil.

### Yapay zeka

Analiz Anthropic API'siyle çalışır. Anahtar Ayarlar'dan girilir, yalnızca o
tarayıcıda saklanır ve yedek dosyasına yazılmaz. Model seçilebilir
(`claude-opus-5-5` varsayılan), ton **dobra** ya da **dengeli**.

Dobra tonda sistem istemi açıktır: övgü yalnızca sayıyla kanıtlanıyorsa
yazılır, hata yumuşatılmaz, genel geçer tavsiye yasaktır, veride olmayan
uydurulmaz. Fiyat tahmini ve yatırım tavsiyesi her iki tonda da yasaktır.

Üç analiz tipi var:

- **Haftalık** — o haftanın işlemleri, disiplin skoru, hata etiketleri, hesap
  durumları, notlar ve traderın kendi değerlendirmesi gider. Rapor: hüküm,
  sayılar, disiplin, tekrarlayan hata, en kötü karar, üç kural, bir soru.
- **Aylık** — hafta hafta seyir, modele / seansa / güne göre performans, kasa
  hareketleri. Rapor: ayın hükmü, para gerçeği, ne işe yarıyor, ne yaramıyor,
  tek değişiklik, ölçüt.
- **Tek işlem** — ekli grafik görselleriyle birlikte gider; kurulum, giriş,
  stop, yönetim ve tek cümlelik hüküm döner.

### Kısayollar

`Y` yeni işlem · `Ctrl+V` form açıkken panodaki ekran görüntüsünü ekler ·
`Esc` pencereyi kapatır · `← →` görsel görüntüleyicide gezinir.

### Yedek

Veri bu tarayıcının deposunda olduğu için yedek kullanıcının sorumluluğunda.
Ayarlar → **Yedek indir** her şeyi tek JSON dosyasına yazar (görseller base64
olarak dahil, API anahtarı hariç). **Yedekten yükle** mevcut defterin yerine
geçer.

## Dosya düzeni

```
src/
  app/                 sayfalar: ana ekran, hafta/[id], arsiv, pariteler
    defter/            kokpit, hesaplar, islemler, playbook, notlar, analiz
  components/          gün şeridi, haber satırı, detay paneli, uyarılar
    defter/            kabuk, işlem formu, hesap kartı, grafikler, görsel alanı
  lib/
    types.ts           veri modeli
    instruments.ts     takip evreni
    impact.ts          haber → parite kuralları ve gürültü filtresi
    calendar.ts        feed ingest, Türkçeleştirme, kümeleme
    weeks.ts           hafta matematiği ve tarih biçimleri
    clock.ts           TRT ve New York saatleri, geri sayım
    breaking.ts        ani haber kaynakları
    biquote.ts         ileriye dönük takvim (ön izleme)
    labels.ts          etiketler ve renk eşlemesi
    store.ts           hafta dosyalarını okuma
    defter/
      types.ts         defter veri modeli
      db.ts            IndexedDB sarmalayıcısı
      store.tsx        React veri katmanı
      calc.ts          kâr/zarar, R istatistiği, fon kuralları, disiplin
      ai.ts            yapay zeka istemleri ve Anthropic çağrısı
      images.ts        ekran görüntüsü deposu
      taxonomy.ts      model, hata ve etiket sözlüğü
      defaults.ts      boş kayıt iskeletleri
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
| `.github/workflows/haftalik-veri.yml` | Her gün 08:00 TRT'de takvimi ve gelecek hafta ön izlemesini tazeler. Pazar 09:00'da yeni hafta kurulur ve yorumlanır, cuma 08:00'da ön izleme yorumlanır. Her commit yayını tetikler. |

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
