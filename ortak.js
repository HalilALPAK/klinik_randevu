"use strict";

/*
 * Ortak yardımcılar: tarih, saat, metin ve küçük DOM yardımcıları.
 * Tarih her yerde "YYYY-AA-GG", saat "SS:DD" metnidir.
 */

const iki = (n) => String(n).padStart(2, "0");
const tarihMetni = (d) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
const bugununTarihi = () => tarihMetni(new Date());

// "2026-11-19" → "19.11.2026"
const tarihGoster = (tarih) => (tarih ? tarih.split("-").reverse().join(".") : "-");

function tarihNesnesi(tarih) {
  const [y, a, g] = tarih.split("-").map(Number);
  return new Date(y, a - 1, g);
}

function gunEkle(tarih, gun) {
  const d = tarihNesnesi(tarih);
  d.setDate(d.getDate() + gun);
  return tarihMetni(d);
}

const GUN_ADLARI = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// Pazartesi = 1 ... Pazar = 7 (doktorların çalışma saatleri bu numarayla tutulur)
const haftaGunu = (tarih) => tarihNesnesi(tarih).getDay() || 7;
const gunAdi = (tarih) => GUN_ADLARI[haftaGunu(tarih) - 1];
const haftaBasi = (tarih) => gunEkle(tarih, 1 - haftaGunu(tarih));

// "19 Kasım 2026 Perşembe"
function uzunTarih(tarih) {
  const d = tarihNesnesi(tarih);
  return `${d.getDate()} ${AY_ADLARI[d.getMonth()]} ${d.getFullYear()} ${gunAdi(tarih)}`;
}

// "09:30" ↔ 570 (gece yarısından beri dakika)
function dakika(saat) {
  const [s, d] = String(saat || "").split(":").map(Number);
  return s * 60 + d;
}
const saatMetni = (dk) => `${iki(Math.floor(dk / 60))}:${iki(dk % 60)}`;
const simdikiDakika = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const SAAT_DESENI = /^([01]\d|2[0-3]):[0-5]\d$/;

// Panelle aynı eşleşme kuralı: Türkçe küçük harf, ı = i
const kucult = (metin) => String(metin || "").toLocaleLowerCase("tr").replace(/ı/g, "i").trim();
const tamAd = (kisi) => `${kisi.ad || ""} ${kisi.soyad || ""}`.trim();

// el("td", { className: "sayi" }, "metin", baskaDugum): metinler her zaman textContent olarak girer
function el(etiket, ozellikler, ...cocuklar) {
  const dugum = document.createElement(etiket);
  for (const [ad, deger] of Object.entries(ozellikler || {})) {
    if (deger === undefined || deger === null || deger === false) continue;
    if (ad === "dataset") Object.assign(dugum.dataset, deger);
    else if (ad === "style") dugum.style.cssText = deger;
    else if (ad.startsWith("on")) dugum.addEventListener(ad.slice(2), deger);
    else if (ad in dugum && ad !== "list") dugum[ad] = deger;
    else dugum.setAttribute(ad, deger === true ? "" : deger);
  }
  dugum.append(...cocuklar.flat().filter((c) => c !== null && c !== undefined && c !== false).map((c) => (
    typeof c === "number" ? String(c) : c
  )));
  return dugum;
}

const ikonSvg = (yol) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${yol}"/></svg>`;
const IKON_KALEM = ikonSvg("M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4");
const IKON_COP = ikonSvg("M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5");
const IKON_ONAY = ikonSvg("M5 12.5l4.5 4.5L19 7.5");
const IKON_CARPI = ikonSvg("M6 6l12 12M18 6L6 18");
const IKON_TELEFON = ikonSvg("M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z");
const IKON_WHATSAPP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20.5l1.3-4.1A8.6 8.6 0 1 1 8 19.3z"/>'
  + '<path class="dolgu" d="M9.2 7.4c-.4 0-.8.4-.9.9-.2 1.2.3 2.8 1.7 4.2 1.4 1.4 3 1.9 4.2 1.7.5-.1.9-.5.9-.9v-.6c0-.2-.1-.3-.3-.4l-1.5-.7c-.2-.1-.4 0-.5.1l-.6.7c-.9-.4-1.8-1.3-2.2-2.2l.7-.6c.1-.1.2-.3.1-.5l-.7-1.5c-.1-.2-.2-.3-.4-.3z"/></svg>';

function ikonDugmesi(ikon, etiket, tiklaninca, sinif = "") {
  const dugme = el("button", { type: "button", className: `ikon-dugme ${sinif}`, title: etiket, "aria-label": etiket, onclick: tiklaninca });
  dugme.innerHTML = ikon;
  return dugme;
}

function tabloyuDoldur(govde, bos, satirlar, bosMetni) {
  govde.replaceChildren(...satirlar);
  bos.hidden = satirlar.length > 0;
  if (bosMetni) bos.textContent = bosMetni;
}

// Numara + arama (tel:) + WhatsApp. tiklaninca: WhatsApp açılınca yapılacak iş (örn. "hatırlatıldı" işareti)
function telefonHucresi(telefon, mesaj, tiklaninca) {
  if (!telefon) return el("td", { className: "soluk" }, "-");
  const wa = el("a", {
    className: "whatsapp-dugme",
    title: "WhatsApp'ta yaz",
    "aria-label": "WhatsApp'ta yaz",
    href: whatsappAdresi(telefon, mesaj),
    target: "_blank",
    rel: "noopener noreferrer",
    onclick: (olay) => {
      olay.stopPropagation();
      if (tiklaninca) tiklaninca();
    },
  });
  wa.innerHTML = IKON_WHATSAPP;
  return el("td", { className: "telefon-hucresi" },
    el("a", { className: "telefon-numara", href: `tel:+${telefon}`, title: "Ara", onclick: (o) => o.stopPropagation() }, telefonGoster(telefon)),
    wa);
}

// Tarayıcıda yalnızca bu bilgisayara ait küçük tercihler (görünüm, seçili doktor)
function tercihOku(anahtar, varsayilan) {
  try {
    return localStorage.getItem(`randevu.${anahtar}`) ?? varsayilan;
  } catch {
    return varsayilan;
  }
}
function tercihYaz(anahtar, deger) {
  try {
    localStorage.setItem(`randevu.${anahtar}`, deger);
  } catch {}
}
