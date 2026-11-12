/**
 * Defterin ortak sozlugu: modeller, hatalar, seanslar, etiketler.
 * Tek yerde durur ki form, filtre, istatistik ve yapay zeka ayni dili
 * konussun.
 */

import type { FlowType, Grade, Market, NoteKind, Outcome, SessionName } from "./types";

export interface Option<T extends string = string> {
  id: T;
  label: string;
  hint?: string;
}

export const MARKETS: Option<Market>[] = [
  { id: "endeks", label: "Endeks", hint: "NQ, ES, DAX, US30" },
  { id: "kripto", label: "Kripto", hint: "BTC, ETH, altcoin" },
  { id: "forex", label: "Forex", hint: "major ve cross pariteler" },
  { id: "emtia", label: "Emtia", hint: "altın, gümüş, petrol" },
];

export const SESSIONS: Option<SessionName>[] = [
  { id: "asya", label: "Asya", hint: "02:00 – 09:00 TRT" },
  { id: "londra", label: "Londra", hint: "10:00 – 13:00 TRT" },
  { id: "ny-am", label: "NY AM", hint: "16:30 – 19:00 TRT" },
  { id: "ny-pm", label: "NY PM", hint: "20:00 – 23:00 TRT" },
];

export const OUTCOMES: Option<Outcome>[] = [
  { id: "tp", label: "Hedef" },
  { id: "sl", label: "Stop" },
  { id: "be", label: "Başa baş" },
  { id: "kismi", label: "Kısmi" },
  { id: "manuel", label: "Manuel kapanış" },
];

export const GRADES: Option<Grade>[] = [
  { id: "A", label: "A", hint: "plan birebir uygulandı" },
  { id: "B", label: "B", hint: "küçük sapma" },
  { id: "C", label: "C", hint: "plan bozuldu" },
  { id: "D", label: "D", hint: "tamamen dürtüsel" },
];

/** ICT / smart money model sozlugu. Playbook ve islem formu paylasir. */
export const MODELS: Option[] = [
  { id: "mmxm", label: "MMXM", hint: "market maker al/sat modeli" },
  { id: "silver-bullet", label: "Silver Bullet", hint: "17:00–18:00 TRT penceresi" },
  { id: "judas", label: "Judas Swing", hint: "açılış sahte hareketi" },
  { id: "turtle-soup", label: "Turtle Soup", hint: "likidite avı sonrası dönüş" },
  { id: "fvg", label: "FVG tepkisi", hint: "dengesizliğe geri dönüş" },
  { id: "ifvg", label: "IFVG", hint: "ters çevrilmiş FVG" },
  { id: "ob", label: "Order Block" },
  { id: "breaker", label: "Breaker Block" },
  { id: "mitigation", label: "Mitigation Block" },
  { id: "unicorn", label: "Unicorn", hint: "breaker + FVG çakışması" },
  { id: "sweep", label: "Likidite süpürmesi", hint: "SSL / BSL alımı" },
  { id: "smt", label: "SMT uyumsuzluğu", hint: "korele enstrüman ayrışması" },
  { id: "po3", label: "Power of 3", hint: "birikim – manipülasyon – dağıtım" },
  { id: "ote", label: "OTE", hint: "0.62 – 0.79 geri çekilme" },
  { id: "cisd", label: "CISD / MSS", hint: "yapı kırılımı teyidi" },
  { id: "range-reversal", label: "Range dönüşü", hint: "aralık dışı sapma" },
  { id: "org", label: "Opening Range Gap" },
  { id: "asia-sweep", label: "Asya range süpürmesi" },
  { id: "diger", label: "Diğer" },
];

export function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

/**
 * Hata etiketleri. Haftalik analiz ve yapay zeka raporu bunlarin
 * tekrarina bakar — en pahaliya mal olan aliskanlik burada gorunur.
 */
export const MISTAKES: Option[] = [
  { id: "kota-asimi", label: "Kota aşımı", hint: "haftalık sınırın dışında işlem" },
  { id: "plan-disi", label: "Plan dışı giriş" },
  { id: "erken-giris", label: "Erken giriş", hint: "teyit beklemeden" },
  { id: "gec-giris", label: "Geç giriş", hint: "hareket başladıktan sonra" },
  { id: "onay-yok", label: "Onay yok", hint: "alt zaman dilimi teyidi alınmadı" },
  { id: "karsi-trend", label: "HTF yönüne karşı" },
  { id: "stop-kaydirma", label: "Stop kaydırma" },
  { id: "erken-cikis", label: "Erken çıkış", hint: "hedefe varmadan korkuyla" },
  { id: "hedefte-cikmama", label: "Hedefte çıkmama", hint: "açgözlülük" },
  { id: "asiri-risk", label: "Aşırı risk", hint: "1R'den büyük pozisyon" },
  { id: "revenge", label: "Revenge trade", hint: "zararı geri alma hırsı" },
  { id: "fomo", label: "FOMO" },
  { id: "overtrading", label: "Aşırı işlem" },
  { id: "seans-disi", label: "Seans dışı işlem" },
  { id: "haber-riski", label: "Haber riski", hint: "yüksek etkili veri anında pozisyon" },
  { id: "kurali-zorlama", label: "Fon kuralını zorlama" },
  { id: "gunluk-limit", label: "Günlük limite yaklaşma" },
  { id: "kayit-yok", label: "Kayıt tutulmadı", hint: "ekran görüntüsü / not eksik" },
];

export function mistakeLabel(id: string): string {
  return MISTAKES.find((m) => m.id === id)?.label ?? id;
}

export const NOTE_KINDS: Option<NoteKind>[] = [
  { id: "reversal", label: "Dönüş", hint: "market reversal örneği" },
  { id: "gozlem", label: "Gözlem" },
  { id: "ders", label: "Ders" },
  { id: "tez", label: "Tez", hint: "haftalık yön beklentisi" },
  { id: "hata", label: "Hata" },
];

export const FLOW_TYPES: Option<FlowType>[] = [
  { id: "yatirim", label: "Para yatırma", hint: "bakiye artar, cepten çıkar" },
  { id: "cekim", label: "Para çekme", hint: "bakiye düşer, cebe girer" },
  { id: "payout", label: "Payout", hint: "fon ödemesi, cebe girer" },
  { id: "challenge-ucreti", label: "Challenge ücreti", hint: "cepten çıkar, bakiyeye dokunmaz" },
  { id: "ucret-iadesi", label: "Ücret iadesi", hint: "cebe girer" },
  { id: "bonus", label: "Bonus", hint: "bakiye artar" },
];

export function flowLabel(id: FlowType): string {
  return FLOW_TYPES.find((f) => f.id === id)?.label ?? id;
}

/** Bakiyeye etkisi: +1 artirir, -1 dusurur, 0 dokunmaz. */
export function balanceSign(type: FlowType): number {
  switch (type) {
    case "yatirim":
    case "bonus":
      return 1;
    case "cekim":
    case "payout":
      return -1;
    default:
      return 0;
  }
}

/** Gercek nakde etkisi: cebe giren +, cepten cikan -. */
export function cashSign(type: FlowType): number {
  switch (type) {
    case "cekim":
    case "payout":
    case "ucret-iadesi":
      return 1;
    case "yatirim":
    case "challenge-ucreti":
      return -1;
    default:
      return 0;
  }
}

export const ACCENTS = [
  "#6fae9f",
  "#e8a33d",
  "#9b7fe8",
  "#e8503c",
  "#5aa9d6",
  "#d682a8",
  "#8fb84f",
  "#c9975a",
];

export const PHASES: Option[] = [
  { id: "faz-1", label: "Faz 1" },
  { id: "faz-2", label: "Faz 2" },
  { id: "funded", label: "Funded" },
  { id: "beklemede", label: "Beklemede" },
  { id: "yandi", label: "Yandı" },
  { id: "kapandi", label: "Kapandı" },
];

export const ACCOUNT_KINDS: Option[] = [
  { id: "challenge", label: "Challenge" },
  { id: "funded", label: "Funded" },
  { id: "kisisel", label: "Kişisel" },
];

export const BIASES: Option[] = [
  { id: "boga", label: "Boğa" },
  { id: "ayi", label: "Ayı" },
  { id: "notr", label: "Nötr" },
];

export const CHECKLIST_ITEMS: { id: keyof import("./types").TradeChecklist; label: string }[] = [
  { id: "htfBias", label: "HTF yönü belirlendi" },
  { id: "liquidity", label: "Likidite alındı" },
  { id: "poi", label: "POI işaretlendi" },
  { id: "confirmation", label: "LTF teyidi geldi" },
  { id: "riskOk", label: "Risk 1R'yi aşmıyor" },
  { id: "rrOk", label: "Hedef en az 2R" },
  { id: "newsChecked", label: "Takvim kontrol edildi" },
];
