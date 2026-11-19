"use strict";

/* Doktorlar ve izinler / kapalı günler */

const doktorlarSayfasi = document.getElementById("doktorlar-sayfasi");

function calismaOzeti(d) {
  const c = d.calismaSaatleri || {};
  const gunler = Object.keys(c).map(Number).sort();
  if (!gunler.length) return "—";
  return gunler.map((g) => `${GUN_KISA[g - 1]} ${c[g].bas}–${c[g].bit}`).join(", ");
}

async function doktorSil(d) {
  if (veri.randevular.some((r) => r.doktor === d.id)) {
    bildir("Bu doktorun randevuları var; silinemez. Takvimde görünmesin istiyorsanız Düzelt → Aktif işaretini kaldırın.");
    return;
  }
  if (!confirm(`${d.ad} silinsin mi?`)) return;
  try {
    await sil("doktorlar", d.id);
  } catch (hata) {
    if (hata.status === 400) bildir("Bu doktorun randevuları var; silinemez. Silmek yerine pasif yapın.");
    else hatayiBildir(hata);
  }
}

async function izinSil(k) {
  if (!confirm(`${tarihGoster(k.tarih)} · ${k.aciklama || "Kapalı"} silinsin mi?`)) return;
  try {
    await sil("kapali_zamanlar", k.id);
  } catch (hata) {
    hatayiBildir(hata);
  }
}

function doktorlariCiz() {
  const doktorlar = [...veri.doktorlar].sort(doktorSirasi);
  tabloyuDoldur(document.getElementById("doktor-satirlari"), document.getElementById("doktor-bos"), doktorlar.map((d) => el("tr", { className: d.aktif ? "" : "pasif-satir" },
    el("td", null, el("span", { className: "renk-noktasi", style: `--renk:${d.renk || "#66727c"}` }), el("strong", null, d.ad)),
    el("td", null, calismaOzeti(d)),
    el("td", null, sureMetni(d.randevuSuresi || 30)),
    el("td", null, el("span", { className: `durum ${d.aktif ? "geldi" : ""}` }, d.aktif ? "Aktif" : "Pasif")),
    el("td", { className: "eylem" },
      ikonDugmesi(IKON_KALEM, `${d.ad} düzelt`, () => doktorPenceresiniAc(d)),
      ikonDugmesi(IKON_COP, `${d.ad} sil`, () => doktorSil(d))))));

  const bugun = bugununTarihi();
  const izinler = veri.kapali_zamanlar.filter((k) => k.tarih >= bugun)
    .sort((a, b) => a.tarih.localeCompare(b.tarih) || (a.bas || "").localeCompare(b.bas || ""));
  tabloyuDoldur(document.getElementById("izin-satirlari"), document.getElementById("izin-bos"), izinler.map((k) => el("tr", null,
    el("td", { className: "tarih" }, `${tarihGoster(k.tarih)} ${GUN_KISA[haftaGunu(k.tarih) - 1]}`),
    el("td", null, k.doktor ? doktorAdi(k.doktor) : el("strong", null, "Tüm klinik")),
    el("td", { className: "tarih" }, k.bas ? `${k.bas}–${k.bit}` : "Bütün gün"),
    el("td", null, k.aciklama || ""),
    el("td", { className: "eylem" }, ikonDugmesi(IKON_COP, "Sil", () => izinSil(k))))));
}

document.getElementById("doktor-ekle").addEventListener("click", () => doktorPenceresiniAc());
document.getElementById("izin-ekle").addEventListener("click", izinPenceresiniAc);
