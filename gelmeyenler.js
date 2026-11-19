"use strict";

/*
 * Gelmeyenler: "Gelmedi" işaretlenen randevular, geri aranmak üzere.
 * Hasta yeni randevu alınca ya da "Vazgeçti" kaydedilince kapanır ve listeden düşer.
 */

const gelmeyenlerSayfasi = document.getElementById("gelmeyenler-sayfasi");
const gelmeyenAramaKutusu = document.getElementById("gelmeyen-arama");
const gelmeyenSiralama = document.getElementById("gelmeyen-siralama");
const kapananlariGosterKutusu = document.getElementById("kapananlari-goster");
gelmeyenSiralama.value = tercihOku("gelmeyenSiralama", "yeni") === "eski" ? "eski" : "yeni";

function gelmeyenEslesir(r, aranan, rakam) {
  if (!aranan) return true;
  if (kucult(tamAd(r)).includes(aranan)) return true;
  return rakam.length >= 3 && r.telefon.includes(rakam);
}

function aramaOzeti(r, kapanis) {
  const aramalar = randevununAramalari(r.id).filter((a) => a.sonuc !== "yeni_randevu");
  const parcalar = [];
  if (kapanis) {
    const yeni = randevuBul(kapanis.yeniRandevu);
    parcalar.push(el("span", { className: "durum geldi" }, kapanis.sonuc === "yeni_randevu"
      ? `Yeni randevu${yeni ? `: ${tarihGoster(yeni.tarih)} ${yeni.saat}` : ""}`
      : ARAMA_SONUCLARI[kapanis.sonuc]));
  }
  if (!aramalar.length) {
    if (!kapanis) parcalar.push(el("span", { className: "durum aranmadi" }, "Henüz aranmadı"));
    return parcalar;
  }
  const son = aramalar[aramalar.length - 1];
  const zaman = new Date(son.created.replace(" ", "T"));
  const zamanMetni = Number.isNaN(zaman.getTime()) ? "" : ` (${tarihGoster(tarihMetni(zaman))} ${iki(zaman.getHours())}:${iki(zaman.getMinutes())})`;
  parcalar.push(el("div", null,
    el("strong", null, `${aramalar.length} kez arandı`),
    ` · son: ${ARAMA_SONUCLARI[son.sonuc]}${zamanMetni}`));
  if (son.not) parcalar.push(el("div", { className: "arama-notu" }, son.not));
  return parcalar;
}

function gelmeyenleriCiz() {
  const aranan = kucult(gelmeyenAramaKutusu.value);
  const rakam = gelmeyenAramaKutusu.value.replace(/\D/g, "").replace(/^0/, "");
  const yeniOnce = gelmeyenSiralama.value === "yeni";
  const liste = gelmeyenler()
    .map((r) => ({ r, kapanis: kapanisBilgisi(r) }))
    .filter(({ r, kapanis }) => (kapananlariGosterKutusu.checked || !kapanis) && gelmeyenEslesir(r, aranan, rakam))
    .sort((a, b) => (yeniOnce ? -1 : 1) * saatSirasi(a.r, b.r));

  const satirlar = liste.map(({ r, kapanis }) => el("tr", { className: kapanis ? "kapanan" : "" },
    el("td", { className: "tarih" }, `${tarihGoster(r.tarih)} ${r.saat}`, el("div", { className: "soluk" }, gunAdi(r.tarih))),
    el("td", null, el("strong", null, tamAd(r)), r.hasta && hastaBul(r.hasta) ? el("div", { className: "soluk" }, `Hasta No ${hastaBul(r.hasta).hastaNo ?? "-"}`) : null),
    telefonHucresi(r.telefon, gelmeyenMesaji(r)),
    el("td", null, doktorAdi(r.doktor)),
    el("td", null, r.islem || ""),
    el("td", { className: "arama-hucresi" }, aramaOzeti(r, kapanis)),
    el("td", { className: "eylem" },
      kapanis ? null : el("button", { type: "button", className: "dugme kucuk", onclick: () => aramaPenceresiniAc(r) }, "Arama kaydet"),
      kapanis ? null : el("button", {
        type: "button",
        className: "dugme kucuk birincil",
        onclick: () => randevuPenceresiniAc({ kaynak: { randevu: r, tur: "gelmedi" } }),
      }, "Yeniden randevu"),
      ikonDugmesi(IKON_KALEM, "Randevuyu aç", () => randevuPenceresiniAc({ kayit: r })))));

  const bosMetni = aranan ? "Aramaya uyan kayıt yok."
    : kapananlariGosterKutusu.checked ? "Gelmeyen hasta kaydı yok." : "Geri aranacak hasta yok.";
  tabloyuDoldur(document.getElementById("gelmeyen-satirlari"), document.getElementById("gelmeyen-bos"), satirlar, bosMetni);
}

function gelmeyenRozetiniGuncelle() {
  const rozet = document.getElementById("gelmeyen-rozeti");
  const sayi = acikGelmeyenler().length;
  rozet.hidden = !sayi;
  rozet.textContent = sayi;
}

gelmeyenAramaKutusu.addEventListener("input", gelmeyenleriCiz);
gelmeyenSiralama.addEventListener("change", () => {
  tercihYaz("gelmeyenSiralama", gelmeyenSiralama.value);
  gelmeyenleriCiz();
});
kapananlariGosterKutusu.addEventListener("change", gelmeyenleriCiz);
