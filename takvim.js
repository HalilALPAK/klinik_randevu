"use strict";

/*
 * Takvim. Gün görünümü: doktorlar yan yana sütun. Hafta görünümü: tek doktorun 7 günü.
 * Her sütun (doktor, tarih) çiftidir; ikisi de aynı sütun çiziciyi kullanır.
 * Boş yere tıklayınca o saate yeni randevu açılır; kartlar sürüklenerek taşınır.
 */

const takvimSayfasi = document.getElementById("takvim-sayfasi");
const takvimKabi = document.getElementById("takvim");
const takvimBos = document.getElementById("takvim-bos");
const takvimBasligi = document.getElementById("takvim-basligi");
const takvimOzeti = document.getElementById("takvim-ozeti");
const takvimTarihKutusu = document.getElementById("takvim-tarih");
const haftaDoktoruSecimi = document.getElementById("hafta-doktoru");
const iptalleriGosterKutusu = document.getElementById("iptalleri-goster");

const ADIM_DK = 15; // ızgara ve sürükleme adımı
const SATIR_PX = 22; // 15 dakikanın yüksekliği
const PX_DK = SATIR_PX / ADIM_DK;

let takvimTarihi = bugununTarihi();
let takvimGorunumu = tercihOku("gorunum", "gun") === "hafta" ? "hafta" : "gun";
let haftaDoktoruId = tercihOku("haftaDoktoru", "");
iptalleriGosterKutusu.checked = tercihOku("iptaller", "0") === "1";

let surukleme = null; // { id, tutmaPx }

function takvimSutunlari() {
  if (takvimGorunumu === "hafta") {
    const doktorlar = aktifDoktorlar();
    let d = doktorBul(haftaDoktoruId);
    if (!d || !d.aktif) d = doktorlar[0];
    if (!d) return [];
    haftaDoktoruId = d.id;
    const bas = haftaBasi(takvimTarihi);
    return Array.from({ length: 7 }, (_, i) => ({ doktor: d, tarih: gunEkle(bas, i) }));
  }
  const doktorlar = aktifDoktorlar();
  // Pasif yapılmış doktorun o güne randevusu kaldıysa sütunu yine gösterilir
  for (const r of gununRandevulari(takvimTarihi)) {
    const d = doktorBul(r.doktor);
    if (d && !doktorlar.includes(d) && aktifMi(r)) doktorlar.push(d);
  }
  return doktorlar.map((d) => ({ doktor: d, tarih: takvimTarihi }));
}

const gorunenRandevular = (doktorId, tarih) => gununRandevulari(tarih, doktorId)
  .filter((r) => iptalleriGosterKutusu.checked || aktifMi(r));

// Görünen saat aralığı: sütunların çalışma saatleri ve randevuları kapsanır, saat başına yuvarlanır
function saatAraligi(sutunlar) {
  let bas = Infinity;
  let bit = -Infinity;
  for (const { doktor, tarih } of sutunlar) {
    const c = calismaSaati(doktor, tarih);
    if (c) {
      bas = Math.min(bas, c.bas);
      bit = Math.max(bit, c.bit);
    }
    for (const r of gorunenRandevular(doktor.id, tarih)) {
      bas = Math.min(bas, randevuBas(r));
      bit = Math.max(bit, randevuBit(r));
    }
  }
  if (bas === Infinity) [bas, bit] = [9 * 60, 18 * 60];
  return { bas: Math.floor(bas / 60) * 60, bit: Math.min(24 * 60, Math.ceil(bit / 60) * 60) };
}

// Çakışan randevular yan yana şeritlere bölünür
function seritlereAyir(liste) {
  const ogeler = liste.map((r) => ({ r, bas: randevuBas(r), bit: randevuBit(r) }))
    .sort((a, b) => a.bas - b.bas || b.bit - a.bit);
  let kume = [];
  let seritler = [];
  let kumeBit = -Infinity;
  const kapat = () => {
    kume.forEach((o) => {
      o.seritSayisi = seritler.length;
    });
    kume = [];
    seritler = [];
    kumeBit = -Infinity;
  };
  for (const o of ogeler) {
    if (o.bas >= kumeBit) kapat();
    let s = seritler.findIndex((b) => b <= o.bas);
    if (s < 0) {
      s = seritler.length;
      seritler.push(o.bit);
    } else seritler[s] = o.bit;
    o.serit = s;
    kume.push(o);
    kumeBit = Math.max(kumeBit, o.bit);
  }
  kapat();
  return ogeler;
}

function griBlok(aralik, bas, bit, metin, sinif = "") {
  const ust = Math.max(bas, aralik.bas);
  const alt = Math.min(bit, aralik.bit);
  if (alt <= ust) return null;
  return el("div", {
    className: `kapali-blok ${sinif}`,
    style: `top:${(ust - aralik.bas) * PX_DK}px;height:${(alt - ust) * PX_DK}px`,
    title: metin || "",
  }, metin && alt - ust >= 30 ? el("span", null, metin) : null);
}

function randevuKarti(o, aralik) {
  const { r } = o;
  const yukseklik = Math.max(SATIR_PX, (o.bit - o.bas) * PX_DK) - 2;
  const genislik = 100 / o.seritSayisi;
  const kisa = yukseklik < 40;
  const kart = el("div", {
    className: `randevu-kart durum-${r.durum}${kisa ? " kisa" : ""}`,
    style: `--renk:${doktorRengi(r.doktor)};top:${(o.bas - aralik.bas) * PX_DK + 1}px;height:${yukseklik}px;`
      + `left:calc(${o.serit * genislik}% + 2px);width:calc(${genislik}% - 4px)`,
    draggable: true,
    tabIndex: 0,
    title: `${r.saat}–${saatMetni(o.bit)} ${tamAd(r)}${r.islem ? ` · ${r.islem}` : ""} · ${DURUMLAR[r.durum]}`
      + `${r.not ? `\nNot: ${r.not}` : ""}\nTıklayın: aç · Sürükleyin: taşı`,
    dataset: { id: r.id },
    onclick: () => randevuPenceresiniAc({ kayit: r }),
    onkeydown: (olay) => {
      if (olay.key === "Enter") randevuPenceresiniAc({ kayit: r });
    },
    ondragstart: (olay) => {
      surukleme = { id: r.id, tutmaPx: olay.clientY - kart.getBoundingClientRect().top };
      olay.dataTransfer.effectAllowed = "move";
      olay.dataTransfer.setData("text/plain", r.id);
      requestAnimationFrame(() => kart.classList.add("suruklenen"));
    },
    ondragend: () => {
      kart.classList.remove("suruklenen");
      surukleme = null;
      document.querySelectorAll(".gun-sutunu.birakilir").forEach((s) => s.classList.remove("birakilir"));
    },
  });

  const durumIsareti = { geldi: "✓", gelmedi: "✗", iptal: "İptal", ertelendi: "Ertelendi" }[r.durum];
  const ust = el("div", { className: "kart-ust" },
    el("span", { className: "kart-saat" }, r.saat),
    el("span", { className: "kart-ad" }, tamAd(r)),
    durumIsareti ? el("span", { className: "kart-durum" }, durumIsareti) : null);
  kart.append(ust);
  if (!kisa && r.islem) kart.append(el("div", { className: "kart-islem" }, r.islem));
  if (r.ilkGelis) kart.classList.add("ilk-gelis");
  if (r.durum === "bekliyor") {
    const dugmeler = el("div", { className: "kart-dugmeler" },
      ikonDugmesi(IKON_ONAY, `${tamAd(r)} geldi`, (olay) => {
        olay.stopPropagation();
        durumDegistir(r, "geldi");
      }, "geldi-dugmesi"),
      ikonDugmesi(IKON_CARPI, `${tamAd(r)} gelmedi`, (olay) => {
        olay.stopPropagation();
        durumDegistir(r, "gelmedi");
      }, "gelmedi-dugmesi"));
    kart.append(dugmeler);
  }
  return kart;
}

function gunSutunu({ doktor, tarih }, aralik) {
  const sutun = el("div", {
    className: `gun-sutunu${tarih === bugununTarihi() ? " bugun" : ""}`,
    style: `height:${(aralik.bit - aralik.bas) * PX_DK}px`,
    dataset: { doktor: doktor.id, tarih },
  });

  // Çalışma dışı, öğle arası ve izinler gri
  const c = calismaSaati(doktor, tarih);
  if (!c) sutun.append(griBlok(aralik, aralik.bas, aralik.bit, "Çalışmıyor"));
  else {
    sutun.append(...[
      griBlok(aralik, aralik.bas, c.bas),
      griBlok(aralik, c.bit, aralik.bit),
      c.araBas !== null ? griBlok(aralik, c.araBas, c.araBit, "Öğle arası", "ara") : null,
    ].filter(Boolean));
  }
  for (const k of kapaliAraliklar(doktor.id, tarih)) {
    const blok = griBlok(aralik, k.bas, k.bit, k.aciklama, "izin");
    if (blok) sutun.append(blok);
  }

  // Şimdiki saat çizgisi
  if (tarih === bugununTarihi()) {
    const simdi = simdikiDakika();
    if (simdi >= aralik.bas && simdi <= aralik.bit) sutun.append(el("div", { className: "simdi-cizgisi", style: `top:${(simdi - aralik.bas) * PX_DK}px` }));
  }

  for (const o of seritlereAyir(gorunenRandevular(doktor.id, tarih))) sutun.append(randevuKarti(o, aralik));

  const yerdekiDakika = (olay, tutmaPx = 0) => {
    const y = olay.clientY - sutun.getBoundingClientRect().top - tutmaPx;
    const dk = aralik.bas + Math.round(y / PX_DK / ADIM_DK) * ADIM_DK;
    return Math.max(aralik.bas, Math.min(aralik.bit - ADIM_DK, dk));
  };

  sutun.addEventListener("click", (olay) => {
    if (olay.target.closest(".randevu-kart")) return;
    const y = olay.clientY - sutun.getBoundingClientRect().top;
    const dk = aralik.bas + Math.floor(y / PX_DK / ADIM_DK) * ADIM_DK;
    randevuPenceresiniAc({ yeni: { doktor: doktor.id, tarih, saat: saatMetni(dk) } });
  });
  sutun.addEventListener("dragover", (olay) => {
    if (!surukleme) return;
    olay.preventDefault();
    olay.dataTransfer.dropEffect = "move";
    sutun.classList.add("birakilir");
  });
  sutun.addEventListener("dragleave", (olay) => {
    if (!sutun.contains(olay.relatedTarget)) sutun.classList.remove("birakilir");
  });
  sutun.addEventListener("drop", (olay) => {
    if (!surukleme) return;
    olay.preventDefault();
    sutun.classList.remove("birakilir");
    const r = randevuBul(surukleme.id);
    if (r) randevuTasi(r, doktor.id, tarih, saatMetni(yerdekiDakika(olay, surukleme.tutmaPx)));
  });
  return sutun;
}

async function randevuTasi(r, doktorId, tarih, saat) {
  if (r.doktor === doktorId && r.tarih === tarih && r.saat === saat) return;
  const yeni = { doktor: doktorId, tarih, saat, sure: r.sure, durum: r.durum };
  const uyarilar = randevuUyarilari(yeni, r.id);
  const soru = `${tamAd(r)}: ${tarihGoster(r.tarih)} ${r.saat} (${doktorAdi(r.doktor)})\n→ ${tarihGoster(tarih)} ${saat} (${doktorAdi(doktorId)})`;
  if (!confirm(`${soru}${uyarilar.length ? `\n\nDikkat:\n${uyarilar.join("\n")}` : ""}\n\nRandevu taşınsın mı?`)) return;
  const alanlar = { doktor: doktorId, tarih, saat };
  if (r.tarih !== tarih || r.saat !== saat) alanlar.hatirlatildi = false;
  try {
    await kaydet("randevular", r.id, alanlar);
  } catch (hata) {
    hatayiBildir(hata);
  }
}

function saatSutunu(aralik) {
  const sutun = el("div", { className: "saat-sutunu", style: `height:${(aralik.bit - aralik.bas) * PX_DK}px` });
  for (let dk = aralik.bas; dk < aralik.bit; dk += 30) {
    sutun.append(el("span", { className: dk % 60 ? "yarim" : "", style: `top:${(dk - aralik.bas) * PX_DK}px` }, saatMetni(dk)));
  }
  return sutun;
}

function sutunBasligi({ doktor, tarih }, haftaMi) {
  const sayi = gununRandevulari(tarih, doktor.id).filter(aktifMi).length;
  const calismiyor = !calismaSaati(doktor, tarih);
  if (haftaMi) {
    return el("button", {
      type: "button",
      className: `sutun-baslik${tarih === bugununTarihi() ? " bugun" : ""}`,
      title: "Bu günü aç",
      onclick: () => {
        takvimGorunumu = "gun";
        tercihYaz("gorunum", "gun");
        takvimTarihi = tarih;
        takvimiCiz();
      },
    }, el("strong", null, `${GUN_KISA[haftaGunu(tarih) - 1]} ${tarihGoster(tarih).slice(0, 5)}`),
    el("span", { className: "soluk" }, calismiyor ? "çalışmıyor" : `${sayi} randevu`));
  }
  return el("div", { className: "sutun-baslik", style: `--renk:${doktor.renk || "#66727c"}` },
    el("strong", null, el("span", { className: "renk-noktasi" }), doktor.ad),
    el("span", { className: "soluk" }, calismiyor ? "bugün çalışmıyor" : `${sayi} randevu`));
}

function takvimiCiz() {
  const haftaMi = takvimGorunumu === "hafta";
  if (eskiTarihleriYukle(haftaMi ? haftaBasi(takvimTarihi) : takvimTarihi)) takvimOzeti.textContent = "Eski randevular yükleniyor...";

  document.getElementById("gorunum-gun").classList.toggle("secili", !haftaMi);
  document.getElementById("gorunum-hafta").classList.toggle("secili", haftaMi);
  haftaDoktoruSecimi.hidden = !haftaMi;
  takvimTarihKutusu.value = takvimTarihi;

  const doktorlar = aktifDoktorlar();
  if (haftaMi) {
    seceneklerDoldur(haftaDoktoruSecimi, doktorlar.map((d) => [d.id, d.ad]));
  }
  const sutunlar = takvimSutunlari();
  if (haftaMi) haftaDoktoruSecimi.value = haftaDoktoruId;

  if (haftaMi) {
    const bas = haftaBasi(takvimTarihi);
    const bit = gunEkle(bas, 6);
    takvimBasligi.textContent = `${tarihGoster(bas).slice(0, 5)} – ${tarihGoster(bit)}`;
  } else {
    takvimBasligi.textContent = uzunTarih(takvimTarihi);
  }

  if (!sutunlar.length) {
    takvimKabi.replaceChildren();
    takvimBos.hidden = false;
    takvimBos.replaceChildren("Henüz doktor yok. ", el("a", { href: "#doktorlar" }, "Doktorlar"), " ekranından doktor ekleyin.");
    takvimOzeti.textContent = "";
    return;
  }
  takvimBos.hidden = true;

  // Özet: görünen günün/haftanın sayıları
  const tarihler = [...new Set(sutunlar.map((s) => s.tarih))];
  const liste = veri.randevular.filter((r) => tarihler.includes(r.tarih) && (!haftaMi || r.doktor === haftaDoktoruId));
  const say = (d) => liste.filter((r) => r.durum === d).length;
  if (!eskiYukleme) {
    takvimOzeti.textContent = `${liste.filter(aktifMi).length} randevu · ${say("geldi")} geldi · ${say("gelmedi")} gelmedi · `
      + `${say("bekliyor")} bekliyor${say("iptal") ? ` · ${say("iptal")} iptal` : ""}`;
  }

  const aralik = saatAraligi(sutunlar);
  const kaydirma = takvimKabi.scrollLeft;
  const izgara = el("div", { className: "takvim-izgara", style: `--sutun:${sutunlar.length};--saat-px:${60 * PX_DK}px;--adim-px:${SATIR_PX}px` },
    el("div", { className: "kose" }),
    ...sutunlar.map((s) => sutunBasligi(s, haftaMi)),
    saatSutunu(aralik),
    ...sutunlar.map((s) => gunSutunu(s, aralik)));
  takvimKabi.replaceChildren(izgara);
  takvimKabi.scrollLeft = kaydirma;
}

function takvimdeGit(gun) {
  takvimTarihi = gunEkle(takvimTarihi, takvimGorunumu === "hafta" ? gun * 7 : gun);
  takvimiCiz();
}

document.getElementById("takvim-onceki").addEventListener("click", () => takvimdeGit(-1));
document.getElementById("takvim-sonraki").addEventListener("click", () => takvimdeGit(1));
document.getElementById("takvim-bugun").addEventListener("click", () => {
  takvimTarihi = bugununTarihi();
  takvimiCiz();
});
takvimTarihKutusu.addEventListener("change", () => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(takvimTarihKutusu.value)) {
    takvimTarihi = takvimTarihKutusu.value;
    takvimiCiz();
  }
});
document.getElementById("gorunum-gun").addEventListener("click", () => {
  takvimGorunumu = "gun";
  tercihYaz("gorunum", "gun");
  takvimiCiz();
});
document.getElementById("gorunum-hafta").addEventListener("click", () => {
  takvimGorunumu = "hafta";
  tercihYaz("gorunum", "hafta");
  takvimiCiz();
});
haftaDoktoruSecimi.addEventListener("change", () => {
  haftaDoktoruId = haftaDoktoruSecimi.value;
  tercihYaz("haftaDoktoru", haftaDoktoruId);
  takvimiCiz();
});
iptalleriGosterKutusu.addEventListener("change", () => {
  tercihYaz("iptaller", iptalleriGosterKutusu.checked ? "1" : "0");
  takvimiCiz();
});
document.getElementById("yeni-randevu").addEventListener("click", () => {
  const yeni = { tarih: takvimTarihi };
  if (takvimGorunumu === "hafta") yeni.doktor = haftaDoktoruId;
  randevuPenceresiniAc({ yeni });
});

/* Günlük liste yazdırma: takvimdeki günün randevuları doktor doktor tablo olarak */

function yazdirmaListesiniDoldur(tarih) {
  const kap = document.getElementById("yazdirma-listesi");
  const bolumler = [];
  for (const d of [...veri.doktorlar].sort(doktorSirasi)) {
    const liste = gununRandevulari(tarih, d.id).filter(aktifMi);
    if (!liste.length) continue;
    bolumler.push(el("section", { className: "yazdirma-doktor" },
      el("h2", null, `${d.ad} (${liste.length})`),
      el("table", { className: "tablo" },
        el("thead", null, el("tr", null, ...["Saat", "Ad Soyad", "Telefon", "İşlem", "Not", "Geldi"].map((b) => el("th", null, b)))),
        el("tbody", null, ...liste.map((r) => el("tr", null,
          el("td", { className: "tarih" }, `${r.saat}–${saatMetni(randevuBit(r))}`),
          el("td", null, tamAd(r), r.ilkGelis ? " (ilk geliş)" : ""),
          el("td", { className: "tarih" }, telefonGoster(r.telefon)),
          el("td", null, r.islem || ""),
          el("td", null, r.not || ""),
          el("td", null, r.durum === "bekliyor" ? "☐" : DURUMLAR[r.durum])))))));
  }
  kap.replaceChildren(
    el("h1", null, `Alpotech Klinik · Randevular · ${uzunTarih(tarih)}`),
    ...(bolumler.length ? bolumler : [el("p", null, "Bu gün için randevu yok.")]));
}

document.getElementById("gunu-yazdir").addEventListener("click", () => {
  yazdirmaListesiniDoldur(takvimTarihi);
  document.body.classList.add("gunluk-yazdir");
  window.print();
});
window.addEventListener("afterprint", () => document.body.classList.remove("gunluk-yazdir"));
