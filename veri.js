"use strict";

/*
 * Sunucudaki tabloların bellekteki kopyası; anlık olaylarla güncel tutulur.
 * Randevular büyüyen bir tablo olduğu için yalnızca son GERI_GUN gün + ilerisi ve
 * (geri aranacaklar için) tüm "gelmedi" randevular çekilir. Takvimde daha eski
 * bir güne gidilince o aralık ayrıca yüklenir (eskiTarihleriYukle).
 * hastalar ve iletisim yalnızca okunur (iletisim'e yalnızca hasta bağlarken telefon yazılır).
 */

const veri = { doktorlar: [], kapali_zamanlar: [], randevular: [], aramalar: [], hastalar: [], iletisim: [] };
const KOLEKSIYONLAR = Object.keys(veri);
const SIRALAMA = {
  doktorlar: "sira,ad",
  kapali_zamanlar: "tarih,bas",
  randevular: "tarih,saat",
  aramalar: "created",
  hastalar: "hastaNo",
  iletisim: "created",
};
const GERI_GUN = 60;
let yuklenenBaslangic = ""; // randevular ve kapalı zamanlar bu tarihten itibaren bellekte

const DURUMLAR = { bekliyor: "Bekliyor", geldi: "Geldi", gelmedi: "Gelmedi", iptal: "İptal", ertelendi: "Ertelendi" };
const ARAMA_SONUCLARI = {
  ulasilamadi: "Ulaşılamadı",
  sonra_ara: "Sonra aranacak",
  yeni_randevu: "Yeni randevu verildi",
  vazgecti: "Vazgeçti / gelmeyecek",
};
const KAPATAN_SONUCLAR = ["yeni_randevu", "vazgecti"];
const ISLEM_ONERILERI = ["Muayene", "Kontrol", "Dolgu", "Kanal tedavisi", "Diş çekimi", "Diş taşı temizliği",
  "İmplant", "Protez", "Ortodonti", "Beyazlatma", "Çocuk diş hekimliği", "Cerrahi"];
const SURELER = [15, 20, 30, 45, 60, 90, 120];
const VARSAYILAN_CALISMA = {
  1: { bas: "09:00", bit: "18:00", araBas: "12:30", araBit: "13:30" },
  2: { bas: "09:00", bit: "18:00", araBas: "12:30", araBit: "13:30" },
  3: { bas: "09:00", bit: "18:00", araBas: "12:30", araBit: "13:30" },
  4: { bas: "09:00", bit: "18:00", araBas: "12:30", araBit: "13:30" },
  5: { bas: "09:00", bit: "18:00", araBas: "12:30", araBit: "13:30" },
  6: { bas: "09:00", bit: "14:00", araBas: "", araBit: "" },
};
const DOKTOR_RENKLERI = ["#0f5660", "#b5523c", "#5b4a9e", "#2e7d4f", "#b58a3c", "#2f6db5", "#a0457a", "#5f6b2d"];

// Ekranı yeniden çizen işlev (uygulama.js atar)
let veriDegistiIsleyicisi = () => {};

function listeSorgusu(koleksiyon) {
  const secenek = { sort: SIRALAMA[koleksiyon] };
  if (koleksiyon === "randevular") secenek.filter = pb.filter("tarih >= {:t} || durum = 'gelmedi'", { t: yuklenenBaslangic });
  if (koleksiyon === "kapali_zamanlar") secenek.filter = pb.filter("tarih >= {:t}", { t: yuklenenBaslangic });
  return secenek;
}

async function veriyiYukle() {
  yuklenenBaslangic = gunEkle(bugununTarihi(), -GERI_GUN);
  const sonuclar = await Promise.all(KOLEKSIYONLAR.map((k) => (
    istek(() => pb.collection(k).getFullList(listeSorgusu(k)))
  )));
  KOLEKSIYONLAR.forEach((k, i) => {
    veri[k] = sonuclar[i];
  });
}

function veriyiBosalt() {
  KOLEKSIYONLAR.forEach((k) => {
    veri[k] = [];
  });
  yuklenenBaslangic = "";
}

// Takvimde yüklenmemiş eski bir güne gidilince o tarihten öncesi 30 gün ile birlikte çekilir
let eskiYukleme = null;
function eskiTarihleriYukle(tarih) {
  if (!yuklenenBaslangic || tarih >= yuklenenBaslangic) return null;
  if (eskiYukleme) return eskiYukleme;
  const bas = gunEkle(tarih, -30);
  const bit = yuklenenBaslangic;
  const filtre = pb.filter("tarih >= {:bas} && tarih < {:bit}", { bas, bit });
  eskiYukleme = Promise.all([
    istek(() => pb.collection("randevular").getFullList({ sort: SIRALAMA.randevular, filter: filtre })),
    istek(() => pb.collection("kapali_zamanlar").getFullList({ sort: SIRALAMA.kapali_zamanlar, filter: filtre })),
  ]).then(([randevular, kapalilar]) => {
    randevular.forEach((r) => onbellegeKoy("randevular", r));
    kapalilar.forEach((k) => onbellegeKoy("kapali_zamanlar", k));
    yuklenenBaslangic = bas;
    veriDegistiIsleyicisi();
  }).catch((hata) => {
    if (!genelHatayiIsle(hata) && hata.message !== "oturum yok") bildir(`Eski randevular alınamadı: ${hata.message}`);
  }).finally(() => {
    eskiYukleme = null;
  });
  return eskiYukleme;
}

// Daha eski bir sürüm (geç gelen anlık olay) yenisinin üstüne yazılmaz
function onbellegeKoy(koleksiyon, kayit) {
  const liste = veri[koleksiyon];
  const sira = liste.findIndex((x) => x.id === kayit.id);
  if (sira < 0) liste.push(kayit);
  else if (liste[sira].updated <= kayit.updated) liste[sira] = kayit;
  else return false;
  return true;
}

function onbellektenSil(koleksiyon, id) {
  const once = veri[koleksiyon].length;
  veri[koleksiyon] = veri[koleksiyon].filter((x) => x.id !== id);
  return veri[koleksiyon].length !== once;
}

function anlikOlay(koleksiyon, { action, record }) {
  let degisti = action === "delete" ? onbellektenSil(koleksiyon, record.id) : onbellegeKoy(koleksiyon, record);
  // Silinen randevunun aramaları sunucuda da silinir (cascade); bellekten de düşürülür
  if (koleksiyon === "randevular" && action === "delete") {
    const once = veri.aramalar.length;
    veri.aramalar = veri.aramalar.filter((a) => a.randevu !== record.id);
    degisti = degisti || once !== veri.aramalar.length;
  }
  if (degisti) veriDegistiIsleyicisi(koleksiyon);
}

/* Kaydetme: sunucuya yazar, cevabı hemen önbelleğe koyar (anlık olay da gelir, ikisi çakışmaz) */

async function kaydet(koleksiyon, id, alanlar) {
  const kayit = await istek(() => (id
    ? pb.collection(koleksiyon).update(id, alanlar)
    : pb.collection(koleksiyon).create(alanlar)));
  onbellegeKoy(koleksiyon, kayit);
  veriDegistiIsleyicisi(koleksiyon);
  return kayit;
}

async function sil(koleksiyon, id) {
  try {
    await istek(() => pb.collection(koleksiyon).delete(id));
  } catch (hata) {
    if (hata.status !== 404) throw hata; // başka bilgisayarda zaten silinmiş
  }
  anlikOlay(koleksiyon, { action: "delete", record: { id } });
}

/* Doktorlar ve çalışma saatleri */

const doktorBul = (id) => veri.doktorlar.find((d) => d.id === id) || null;
const doktorAdi = (id) => doktorBul(id)?.ad || "?";
const doktorSirasi = (a, b) => (a.sira || 0) - (b.sira || 0) || a.ad.localeCompare(b.ad, "tr");
const aktifDoktorlar = () => veri.doktorlar.filter((d) => d.aktif).sort(doktorSirasi);
const doktorRengi = (id) => doktorBul(id)?.renk || "#66727c";

// O gün için dakika cinsinden { bas, bit, araBas, araBit } ya da çalışmıyorsa null
function calismaSaati(doktor, tarih) {
  const gun = (doktor?.calismaSaatleri || {})[haftaGunu(tarih)];
  if (!gun || !gun.bas || !gun.bit) return null;
  return {
    bas: dakika(gun.bas),
    bit: dakika(gun.bit),
    araBas: gun.araBas ? dakika(gun.araBas) : null,
    araBit: gun.araBit ? dakika(gun.araBit) : null,
  };
}

// Doktorun o günkü izinleri ve kliniğin kapalı zamanları (doktor boşsa tüm klinik): [{ bas, bit, aciklama }]
function kapaliAraliklar(doktorId, tarih) {
  return veri.kapali_zamanlar
    .filter((k) => k.tarih === tarih && (!k.doktor || k.doktor === doktorId))
    .map((k) => ({ bas: k.bas ? dakika(k.bas) : 0, bit: k.bit ? dakika(k.bit) : 24 * 60, aciklama: k.aciklama || "Kapalı", kayit: k }));
}

// Randevu çalışma saati dışında ya da kapalı bir zamana denk geliyorsa nedenini döner, yoksa ""
function calismaDisiNedeni(doktorId, tarih, bas, bit) {
  const kapali = kapaliAraliklar(doktorId, tarih).find((k) => bas < k.bit && bit > k.bas);
  if (kapali) return `${kapali.aciklama} (${kapali.kayit.doktor ? "doktor izinli" : "klinik kapalı"})`;
  const c = calismaSaati(doktorBul(doktorId), tarih);
  if (!c) return `${doktorAdi(doktorId)} ${gunAdi(tarih)} günleri çalışmıyor`;
  if (bas < c.bas || bit > c.bit) return `çalışma saati dışında (${saatMetni(c.bas)}–${saatMetni(c.bit)})`;
  if (c.araBas !== null && bas < c.araBit && bit > c.araBas) return "öğle arasına denk geliyor";
  return "";
}

/* Randevular */

const randevuBul = (id) => veri.randevular.find((r) => r.id === id) || null;
const aktifMi = (r) => r.durum !== "iptal" && r.durum !== "ertelendi";
const randevuBas = (r) => dakika(r.saat);
const randevuBit = (r) => dakika(r.saat) + (r.sure || 30);
const saatSirasi = (a, b) => a.tarih.localeCompare(b.tarih) || a.saat.localeCompare(b.saat)
  || doktorSirasi(doktorBul(a.doktor) || { ad: "" }, doktorBul(b.doktor) || { ad: "" });

const gununRandevulari = (tarih, doktorId) => veri.randevular
  .filter((r) => r.tarih === tarih && (!doktorId || r.doktor === doktorId))
  .sort(saatSirasi);

// Aynı doktorun aynı saatlere düşen (iptal/ertelenmemiş) diğer randevuları
function cakisanRandevular({ doktor, tarih, saat, sure }, haricId) {
  const bas = dakika(saat);
  const bit = bas + sure;
  return veri.randevular.filter((r) => r.id !== haricId && r.doktor === doktor && r.tarih === tarih
    && aktifMi(r) && randevuBas(r) < bit && randevuBit(r) > bas);
}

/* Gelmeyenler ve aramalar */

const randevununAramalari = (id) => veri.aramalar.filter((a) => a.randevu === id)
  .sort((a, b) => a.created.localeCompare(b.created));
const sonrakiRandevu = (id) => veri.randevular.find((r) => r.oncekiRandevu === id) || null;

// Gelmeyen randevu kapandı mı: yeni randevu verildi ya da hasta vazgeçti
function kapanisBilgisi(r) {
  const kapatan = randevununAramalari(r.id).filter((a) => KAPATAN_SONUCLAR.includes(a.sonuc)).pop();
  if (kapatan) return kapatan;
  const yeni = sonrakiRandevu(r.id);
  return yeni ? { sonuc: "yeni_randevu", yeniRandevu: yeni.id } : null;
}

const gelmeyenler = () => veri.randevular.filter((r) => r.durum === "gelmedi");
const acikGelmeyenler = () => gelmeyenler().filter((r) => !kapanisBilgisi(r));

/* Hastalar ve telefon (iletisim: hasta başına tek kayıt, muhasebe ile ortak) */

const hastaBul = (id) => (id ? veri.hastalar.find((h) => h.id === id) || null : null);
const iletisimBul = (hastaId) => veri.iletisim.find((i) => i.hasta === hastaId) || null;
const telefonu = (hastaId) => iletisimBul(hastaId)?.telefon || "";
const telefonlaHasta = (telefon) => hastaBul(veri.iletisim.find((i) => i.telefon === telefon)?.hasta);
const hastaEtiketi = (h) => `${tamAd(h)} · Hasta No ${h.hastaNo ?? "-"}`;

/*
 * Yazılan numarayı uluslararası rakamlara çevirir (wa.me biçimi, + olmadan); geçersizse null, boşsa "".
 * Türkiye: "0532 123 45 67", "532 123 4567", "+90 532..." → "905321234567".
 * Başka ülke: "+49 ..." ile yazılır (8–15 rakam). Muhasebedeki telefonOku ile aynı.
 */
function telefonOku(metin) {
  const ham = String(metin || "").trim();
  if (!ham) return "";
  if (/[^\d\s()+\-./]/.test(ham)) return null;
  let r = ham.replace(/\D/g, "");
  if (ham.startsWith("+") || ham.startsWith("00")) {
    r = r.replace(/^00/, "");
    if (r.startsWith("90")) return r.length === 12 ? r : null;
    return r.length >= 8 && r.length <= 15 ? r : null;
  }
  if (r.length === 12 && r.startsWith("90")) return r;
  if (r.length === 11 && r.startsWith("0")) return `9${r}`;
  if (r.length === 10 && !r.startsWith("0")) return `90${r}`;
  return null;
}

// "905321234567" → "0532 123 45 67"; yabancı numara "+49 ..." olarak
function telefonGoster(r) {
  if (!r) return "";
  if (r.length === 12 && r.startsWith("90")) return `0${r.slice(2, 5)} ${r.slice(5, 8)} ${r.slice(8, 10)} ${r.slice(10)}`;
  return `+${r}`;
}

const whatsappAdresi = (r, mesaj = "") => `https://wa.me/${r}${mesaj ? `?text=${encodeURIComponent(mesaj)}` : ""}`;

/*
 * WhatsApp mesajları. KVKK: işlem adı ve not sağlık verisidir, mesaja girmez;
 * yalnızca ad, tarih ve saat gider (muhasebedeki kuralla aynı).
 */
function hatirlatmaMesaji(r) {
  const bugun = bugununTarihi();
  const gun = r.tarih === bugun ? "bugün"
    : r.tarih === gunEkle(bugun, 1) ? `yarın (${tarihGoster(r.tarih)} ${gunAdi(r.tarih)})`
      : `${tarihGoster(r.tarih)} ${gunAdi(r.tarih)} günü`;
  return `Merhaba ${tamAd(r)}, Alpotech Klinik'ten yazıyoruz. ${gun} saat ${r.saat} randevunuzu hatırlatırız. `
    + "Gelemeyecekseniz lütfen bize haber verin.";
}

function gelmeyenMesaji(r) {
  return `Merhaba ${tamAd(r)}, Alpotech Klinik'ten yazıyoruz. ${tarihGoster(r.tarih)} tarihli randevunuza gelemediğinizi gördük. `
    + "Size uygun yeni bir gün ve saat yazar mısınız?";
}
