"use strict";

/*
 * Hatırlatma: seçilen günün (varsayılan yarın) randevuları; WhatsApp ile hazır mesaj.
 * "Hatırlatıldı" işareti sunucuda (randevular.hatirlatildi) tutulur: hangi bilgisayardan
 * gönderildiyse diğerleri de görür.
 */

const hatirlatmaSayfasi = document.getElementById("hatirlatma-sayfasi");
const hatirlatmaTarihKutusu = document.getElementById("hatirlatma-tarih");
let hatirlatmaTarihi = "";

async function hatirlatildiYap(r, deger) {
  if (!!r.hatirlatildi === deger) return;
  try {
    await kaydet("randevular", r.id, { hatirlatildi: deger });
  } catch (hata) {
    hatayiBildir(hata);
  }
}

function hatirlatmaCiz() {
  if (!hatirlatmaTarihi) hatirlatmaTarihi = gunEkle(bugununTarihi(), 1);
  hatirlatmaTarihKutusu.value = hatirlatmaTarihi;
  eskiTarihleriYukle(hatirlatmaTarihi);
  document.getElementById("hatirlatma-yazdirma-tarihi").textContent = uzunTarih(hatirlatmaTarihi);

  // Gelmedi işaretlenenler Gelmeyenler ekranında takip edilir; burada yalnızca gelecek/gelmiş olanlar
  const liste = gununRandevulari(hatirlatmaTarihi).filter((r) => aktifMi(r) && r.durum !== "gelmedi");
  const bekleyen = liste.filter((r) => r.durum === "bekliyor");
  const hatirlatilan = bekleyen.filter((r) => r.hatirlatildi).length;
  document.getElementById("hatirlatma-ozeti").textContent = liste.length
    ? `${gunAdi(hatirlatmaTarihi)} · ${liste.length} randevu · ${hatirlatilan}/${bekleyen.length} hatırlatıldı`
    : gunAdi(hatirlatmaTarihi);

  const satirlar = liste.map((r) => el("tr", { className: r.hatirlatildi ? "hatirlatildi" : "" },
    el("td", { className: "tarih" }, r.saat),
    el("td", null, el("span", { className: "renk-noktasi", style: `--renk:${doktorRengi(r.doktor)}` }), doktorAdi(r.doktor)),
    el("td", null, el("strong", null, tamAd(r)), r.ilkGelis ? el("span", { className: "soluk" }, " · ilk geliş") : null),
    telefonHucresi(r.telefon, hatirlatmaMesaji(r), () => hatirlatildiYap(r, true)),
    el("td", null, r.islem || ""),
    el("td", null, el("span", { className: `durum ${r.durum}` }, DURUMLAR[r.durum])),
    el("td", null, el("label", { className: "secenek" },
      el("input", {
        type: "checkbox",
        checked: !!r.hatirlatildi,
        "aria-label": `${tamAd(r)} hatırlatıldı`,
        onchange: (olay) => hatirlatildiYap(r, olay.target.checked),
      }),
      r.hatirlatildi ? "Evet" : ""))));

  tabloyuDoldur(document.getElementById("hatirlatma-satirlari"), document.getElementById("hatirlatma-bos"), satirlar,
    `${tarihGoster(hatirlatmaTarihi)} için randevu yok.`);
}

hatirlatmaTarihKutusu.addEventListener("change", () => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(hatirlatmaTarihKutusu.value)) {
    hatirlatmaTarihi = hatirlatmaTarihKutusu.value;
    hatirlatmaCiz();
  }
});
document.getElementById("hatirlatma-bugun").addEventListener("click", () => {
  hatirlatmaTarihi = bugununTarihi();
  hatirlatmaCiz();
});
document.getElementById("hatirlatma-yarin").addEventListener("click", () => {
  hatirlatmaTarihi = gunEkle(bugununTarihi(), 1);
  hatirlatmaCiz();
});
document.getElementById("hatirlatma-yazdir").addEventListener("click", () => window.print());
