"use strict";

/*
 * Randevu, arama, doktor ve izin pencereleri. Kayıt başarısızsa pencere açık kalır,
 * kullanıcının yazdığı kaybolmaz; hata pencerenin altında yazar.
 */

const TUM_PENCERELER = [...document.querySelectorAll("dialog")];

// Kapanmamış ve içinde değişiklik olan pencere var mı (sayfadan çıkarken sorulur)
const acikFormDegisti = () => TUM_PENCERELER.some((p) => p.open && p.dataset.degisti === "1");

function pencereleriKapat() {
  TUM_PENCERELER.forEach((p) => p.open && p.close());
}

// Sunucunun 400 cevabındaki alan hatalarını okunur metne çevirir
function sunucuHatasiMetni(hata, alanAdlari = {}) {
  if (agHatasiMi(hata)) return "Sunucuya bağlanılamıyor. Bağlantı gelince tekrar Kaydet'e basın.";
  if (hata.status === 404) return "Bu kayıt başka bir bilgisayarda silinmiş.";
  const alanlar = Object.entries(hata.response?.data || {});
  if (alanlar.length) {
    return alanlar.map(([alan, a]) => `${alanAdlari[alan] || alan}: ${a.code === "validation_not_unique" ? "zaten kayıtlı" : a.message}`).join(" · ");
  }
  return `Kaydedilemedi: ${hata.message}`;
}

function hatayiBildir(hata) {
  if (!genelHatayiIsle(hata) && hata.message !== "oturum yok") bildir(sunucuHatasiMetni(hata));
}

/*
 * Ortak pencere davranışı. kur.kaydet(form) kaydı yapar; doğrulama hatasında
 * string atarsa o metin gösterilir. Başarılıysa pencere kapanır.
 */
function pencereKur(pencere, kur) {
  const form = pencere.querySelector("form");
  const mesaj = pencere.querySelector(".pencere-mesaji");
  const kaydetDugmesi = form.querySelector('button[type="submit"]');

  form.addEventListener("input", () => {
    pencere.dataset.degisti = "1";
    mesaj.textContent = "";
  });
  const kapatilsinMi = () => pencere.dataset.degisti !== "1" || confirm("Yazdıklarınız kaydedilmeyecek. Kapatılsın mı?");
  form.querySelector(".vazgec").addEventListener("click", () => {
    if (kapatilsinMi()) pencere.close();
  });
  pencere.addEventListener("cancel", (olay) => {
    if (!kapatilsinMi()) olay.preventDefault();
  });

  form.addEventListener("submit", async (olay) => {
    olay.preventDefault();
    if (kaydetDugmesi.disabled) return;
    kaydetDugmesi.disabled = true;
    mesaj.textContent = "Kaydediliyor...";
    try {
      await kur.kaydet(form);
      pencere.dataset.degisti = "0";
      pencere.close();
    } catch (hata) {
      if (typeof hata === "string") mesaj.textContent = hata;
      else if (hata && hata.message === "oturum yok") mesaj.textContent = "";
      else mesaj.textContent = sunucuHatasiMetni(hata, kur.alanAdlari);
    } finally {
      kaydetDugmesi.disabled = false;
    }
  });

  return {
    form,
    kapatilsinMi,
    ac(baslik) {
      pencere.querySelector("h2").textContent = baslik;
      mesaj.textContent = "";
      pencere.dataset.degisti = "0";
      pencere.showModal();
    },
    kapat() {
      pencere.dataset.degisti = "0";
      pencere.close();
    },
  };
}

const benzersizHatasiMi = (hata) => hata && hata.status === 400
  && Object.values(hata.response?.data || {}).some((a) => a && a.code === "validation_not_unique");

function tarihOku(kutu, ad = "Tarih") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(kutu.value)) throw `${ad} seçin.`;
  return kutu.value;
}

function seceneklerDoldur(secim, secenekler) {
  secim.replaceChildren(...secenekler.map(([deger, metin]) => el("option", { value: deger }, metin)));
}

const sureMetni = (dk) => (dk < 60 ? `${dk} dk` : dk % 60 ? `${Math.floor(dk / 60)} sa ${dk % 60} dk` : `${dk / 60} saat`);

document.getElementById("islem-onerileri").replaceChildren(...ISLEM_ONERILERI.map((ad) => el("option", { value: ad })));

/* Randevu */

const randevuPenceresi = document.getElementById("randevu-penceresi");
const telefonBilgisi = document.getElementById("telefon-bilgisi");
const hastaBagAlani = document.getElementById("hasta-bag");
const randevuUyarisi = document.getElementById("randevu-uyari");
const randevuKaynakNotu = document.getElementById("randevu-kaynak");
let randevuBaglami = { kayit: null, kaynak: null }; // kaynak: { randevu, tur: "ertele" | "gelmedi" }
let secilenHastaId = "";
let bagKaldirildi = false; // kullanıcı bağı elle kaldırdıysa telefondan yeniden bağlanmaz
let sureDokunuldu = false;

function formAlanlari() {
  const e = randevuP.form.elements;
  return { doktor: e.doktor.value, tarih: e.tarih.value, saat: e.saat.value, sure: Number(e.sure.value) || 30, durum: e.durum.value };
}

// Çakışma ve çalışma saati uyarıları (engel değil; kaydederken ayrıca sorulur)
function randevuUyarilari(a, haricId) {
  if (!doktorBul(a.doktor) || !/^\d{4}-\d{2}-\d{2}$/.test(a.tarih) || !SAAT_DESENI.test(a.saat) || !aktifMi(a)) return [];
  const uyarilar = cakisanRandevular(a, haricId).map((r) => `${r.saat} ${tamAd(r)} ile çakışıyor`);
  const bas = dakika(a.saat);
  const neden = calismaDisiNedeni(a.doktor, a.tarih, bas, bas + a.sure);
  if (neden) uyarilar.push(neden.charAt(0).toUpperCase() + neden.slice(1));
  return uyarilar;
}

function uyariGoster() {
  const uyarilar = randevuUyarilari(formAlanlari(), randevuBaglami.kayit?.id);
  randevuUyarisi.hidden = !uyarilar.length;
  randevuUyarisi.textContent = uyarilar.join(" · ");
}

function hastaBagiGoster() {
  const h = hastaBul(secilenHastaId);
  const bagla = el("button", { type: "button", className: "dugme kucuk", onclick: hastaBaglamayiAc }, h ? "Değiştir" : "Panel kaydına bağla");
  if (h) {
    const tel = telefonu(h.id);
    const formTel = telefonOku(randevuP.form.elements.telefon.value);
    hastaBagAlani.replaceChildren(
      el("span", null, "Panel kaydı: ", el("strong", null, hastaEtiketi(h)),
        tel && formTel && tel !== formTel ? el("span", { className: "soluk" }, ` (kayıtlı telefonu ${telefonGoster(tel)})`) : null),
      bagla,
      el("button", {
        type: "button",
        className: "dugme kucuk",
        onclick: () => {
          secilenHastaId = "";
          bagKaldirildi = true;
          randevuPenceresi.dataset.degisti = "1";
          hastaBagiGoster();
        },
      }, "Bağı kaldır"),
    );
  } else {
    hastaBagAlani.replaceChildren(el("span", { className: "soluk" }, "Panel kaydına bağlı değil (yeni hasta olabilir)."), bagla);
  }
}

// Telefon yazılınca: panelde kayıtlıysa hasta bağlanır, bu numaranın önceki randevuları gösterilir
let gecmisSorguNo = 0;
let gecmisZamanlayici = null;

function telefonBilgisiniGoster() {
  const e = randevuP.form.elements;
  const telefon = telefonOku(e.telefon.value);
  clearTimeout(gecmisZamanlayici);
  gecmisSorguNo++;
  if (!telefon) {
    telefonBilgisi.hidden = true;
    hastaBagiGoster();
    return;
  }
  const hasta = telefonlaHasta(telefon);
  if (hasta && !secilenHastaId && !bagKaldirildi) {
    secilenHastaId = hasta.id;
    if (!e.ad.value.trim() && !e.soyad.value.trim()) {
      e.ad.value = hasta.ad || "";
      e.soyad.value = hasta.soyad || "";
    }
  }
  hastaBagiGoster();
  telefonBilgisi.hidden = false;
  telefonBilgisi.replaceChildren(el("span", { className: "soluk" }, "Önceki randevulara bakılıyor..."));
  gecmisZamanlayici = setTimeout(() => gecmisiGetir(telefon), 250);
}

async function gecmisiGetir(telefon) {
  const sorguNo = gecmisSorguNo;
  let liste;
  try {
    liste = await istek(() => pb.collection("randevular").getFullList({
      filter: pb.filter("telefon = {:t}", { t: telefon }),
      sort: "-tarih,-saat",
    }));
  } catch {
    if (sorguNo === gecmisSorguNo) telefonBilgisi.hidden = true;
    return;
  }
  if (sorguNo !== gecmisSorguNo) return;
  const kendisi = randevuBaglami.kayit?.id;
  liste = liste.filter((r) => r.id !== kendisi);
  if (!liste.length) {
    telefonBilgisi.replaceChildren(el("span", { className: "soluk" }, "Bu numarayla daha önce randevu yok."));
    return;
  }
  const e = randevuP.form.elements;
  if (!e.ad.value.trim() && !e.soyad.value.trim()) {
    e.ad.value = liste[0].ad || "";
    e.soyad.value = liste[0].soyad || "";
  }
  if (!secilenHastaId && !bagKaldirildi) {
    const bagli = liste.find((r) => hastaBul(r.hasta));
    if (bagli) {
      secilenHastaId = bagli.hasta;
      hastaBagiGoster();
    }
  }
  const sayi = (d) => liste.filter((r) => r.durum === d).length;
  const bugun = bugununTarihi();
  const gecmis = liste.filter((r) => r.tarih < bugun || r.durum === "geldi" || r.durum === "gelmedi");
  const ileride = liste.filter((r) => r.tarih >= bugun && r.durum === "bekliyor").sort(saatSirasi);
  const son = gecmis[0];
  const satirlar = [
    el("span", null, `Bu numarayla ${liste.length} randevu: ${sayi("geldi")} geldi`,
      sayi("gelmedi") ? el("strong", { className: "kirmizi" }, ` · ${sayi("gelmedi")} gelmedi`) : null,
      sayi("iptal") ? ` · ${sayi("iptal")} iptal` : null,
      son ? ` · son: ${tarihGoster(son.tarih)} (${doktorAdi(son.doktor)}, ${DURUMLAR[son.durum]})` : null),
  ];
  for (const r of ileride) {
    satirlar.push(el("strong", { className: "uyari-metni" },
      `Zaten randevusu var: ${tarihGoster(r.tarih)} ${gunAdi(r.tarih)} ${r.saat} · ${doktorAdi(r.doktor)}`));
  }
  telefonBilgisi.replaceChildren(...satirlar);
}

const randevuP = pencereKur(randevuPenceresi, {
  alanAdlari: { telefon: "Telefon", ad: "Ad", soyad: "Soyad", doktor: "Doktor", tarih: "Tarih", saat: "Saat", sure: "Süre", hasta: "Hasta" },
  async kaydet(form) {
    const { kayit, kaynak } = randevuBaglami;
    const e = form.elements;
    const telefon = telefonOku(e.telefon.value);
    if (telefon === "") throw "Telefon yazın.";
    if (!telefon) throw "Telefon numarası geçersiz. Örnek: 0532 123 45 67";
    const ad = e.ad.value.trim();
    if (!ad) throw "Ad yazın.";
    if (!doktorBul(e.doktor.value)) throw "Doktor seçin.";
    const tarih = tarihOku(e.tarih);
    if (!SAAT_DESENI.test(e.saat.value)) throw "Saat seçin.";
    const alanlar = {
      doktor: e.doktor.value,
      hasta: hastaBul(secilenHastaId) ? secilenHastaId : "",
      ad,
      soyad: e.soyad.value.trim(),
      telefon,
      tarih,
      saat: e.saat.value,
      sure: Number(e.sure.value) || 30,
      islem: e.islem.value.trim(),
      not: e.not.value.trim(),
      ilkGelis: e.ilkGelis.checked,
      durum: e.durum.value || "bekliyor",
    };
    const yerDegisti = !kayit || kayit.doktor !== alanlar.doktor || kayit.tarih !== tarih || kayit.saat !== alanlar.saat || kayit.sure !== alanlar.sure;
    if (yerDegisti) {
      const uyarilar = randevuUyarilari(alanlar, kayit?.id);
      if (uyarilar.length && !confirm(`${uyarilar.join("\n")}\n\nYine de kaydedilsin mi?`)) throw "Kaydedilmedi. Saati ya da doktoru değiştirebilirsiniz.";
    }
    if (!kayit) {
      alanlar.hatirlatildi = false;
      alanlar.oncekiRandevu = kaynak ? kaynak.randevu.id : "";
    } else if (kayit.tarih !== tarih || kayit.saat !== alanlar.saat) {
      alanlar.hatirlatildi = false; // yeni gün/saat için yeniden hatırlatılmalı
    }
    const yeni = await kaydet("randevular", kayit?.id, alanlar);
    if (kaynak) await kaynagiKapat(kaynak, yeni);
    if (alanlar.durum === "geldi" && !alanlar.hasta) {
      bildir("Kaydedildi. Hasta panel kaydına bağlı değil: panelde kaydını açtıktan sonra randevudan bağlayabilirsiniz.");
    }
  },
});

// Ertelenen randevu "Ertelendi" olur; gelmeyenin aramalarına "yeni randevu verildi" yazılır
async function kaynagiKapat({ randevu: eski, tur }, yeni) {
  try {
    if (tur === "ertele") await kaydet("randevular", eski.id, { durum: "ertelendi" });
    else await kaydet("aramalar", null, { randevu: eski.id, sonuc: "yeni_randevu", yeniRandevu: yeni.id, not: "" });
  } catch (hata) {
    bildir(`Yeni randevu kaydedildi ama eski randevu güncellenemedi: ${sunucuHatasiMetni(hata)}`);
  }
}

function randevuPenceresiniAc({ kayit = null, yeni = {}, kaynak = null } = {}) {
  if (!aktifDoktorlar().length && !kayit) {
    bildir("Önce Doktorlar ekranından doktor ekleyin.");
    location.hash = "doktorlar";
    return;
  }
  randevuBaglami = { kayit, kaynak };
  const form = randevuP.form;
  const e = form.elements;
  form.reset();
  const kaynakR = kaynak?.randevu || null;
  const temel = kayit || kaynakR || {};

  const doktorlar = aktifDoktorlar();
  const seciliDoktor = doktorBul(kayit?.doktor || yeni.doktor || kaynakR?.doktor) || doktorlar[0];
  if (seciliDoktor && !doktorlar.includes(seciliDoktor)) doktorlar.push(seciliDoktor);
  seceneklerDoldur(e.doktor, doktorlar.map((d) => [d.id, d.aktif ? d.ad : `${d.ad} (pasif)`]));
  e.doktor.value = seciliDoktor?.id || "";

  const sure = kayit?.sure || kaynakR?.sure || seciliDoktor?.randevuSuresi || 30;
  seceneklerDoldur(e.sure, [...new Set([...SURELER, sure])].sort((a, b) => a - b).map((dk) => [dk, sureMetni(dk)]));
  e.sure.value = sure;
  sureDokunuldu = !!(kayit || kaynakR);

  e.telefon.value = telefonGoster(temel.telefon || "");
  e.ad.value = temel.ad || "";
  e.soyad.value = temel.soyad || "";
  e.islem.value = temel.islem || "";
  e.tarih.value = kayit?.tarih || yeni.tarih || (kaynak?.tur === "ertele" ? kaynakR.tarih : bugununTarihi());
  e.saat.value = kayit?.saat || yeni.saat || (kaynak?.tur === "ertele" ? kaynakR.saat : "");
  e.not.value = kayit?.not || "";
  e.ilkGelis.checked = !!kayit?.ilkGelis;
  e.durum.value = kayit?.durum || "bekliyor";
  document.getElementById("durum-ertelendi").hidden = kayit?.durum !== "ertelendi";

  secilenHastaId = temel.hasta || "";
  bagKaldirildi = false;

  let not = "";
  if (kaynak?.tur === "ertele") not = `Ertelenen randevu: ${tarihGoster(kaynakR.tarih)} ${kaynakR.saat} · ${doktorAdi(kaynakR.doktor)}. Kaydedince eskisi "Ertelendi" olur.`;
  else if (kaynak) not = `Gelmediği randevu: ${tarihGoster(kaynakR.tarih)} ${kaynakR.saat} · ${doktorAdi(kaynakR.doktor)}. Kaydedince gelmeyenler listesinden düşer.`;
  else if (kayit?.oncekiRandevu) {
    const onceki = randevuBul(kayit.oncekiRandevu);
    if (onceki) not = `Önceki randevu: ${tarihGoster(onceki.tarih)} ${onceki.saat} (${DURUMLAR[onceki.durum]})`;
  }
  randevuKaynakNotu.textContent = not;
  randevuKaynakNotu.hidden = !not;
  document.getElementById("randevu-sil").hidden = !kayit;
  document.getElementById("randevu-ertele").hidden = !kayit || !aktifMi(kayit) || kayit.durum === "geldi";

  const baslik = kayit ? "Randevuyu Düzelt" : kaynak?.tur === "ertele" ? "Randevuyu Ertele" : kaynak ? "Yeniden Randevu" : "Yeni Randevu";
  randevuP.ac(baslik);
  telefonBilgisi.hidden = true;
  if (e.telefon.value) telefonBilgisiniGoster();
  else hastaBagiGoster();
  uyariGoster();
  (kayit || kaynak ? (e.saat.value ? e.tarih : e.saat) : e.telefon).focus();
}

randevuP.form.elements.telefon.addEventListener("input", telefonBilgisiniGoster);
randevuP.form.elements.telefon.addEventListener("blur", () => {
  const kutu = randevuP.form.elements.telefon;
  const t = telefonOku(kutu.value);
  if (t) kutu.value = telefonGoster(t);
});
randevuP.form.elements.sure.addEventListener("change", () => {
  sureDokunuldu = true;
});
randevuP.form.elements.doktor.addEventListener("change", () => {
  const d = doktorBul(randevuP.form.elements.doktor.value);
  const sure = randevuP.form.elements.sure;
  if (d && !sureDokunuldu && [...sure.options].some((o) => Number(o.value) === d.randevuSuresi)) sure.value = d.randevuSuresi;
});
for (const ad of ["doktor", "tarih", "saat", "sure", "durum"]) {
  const alan = randevuP.form.elements[ad];
  (alan instanceof RadioNodeList ? [...alan] : [alan]).forEach((k) => k.addEventListener("change", uyariGoster));
}
randevuP.form.elements.saat.addEventListener("input", uyariGoster);

document.getElementById("randevu-sil").addEventListener("click", async () => {
  const { kayit } = randevuBaglami;
  if (!kayit || !confirm(`${tamAd(kayit)} adlı hastanın ${tarihGoster(kayit.tarih)} ${kayit.saat} randevusu silinsin mi?\n\nHasta gelmeyecekse silmek yerine "İptal" seçmeniz önerilir.`)) return;
  try {
    await sil("randevular", kayit.id);
    randevuP.kapat();
  } catch (hata) {
    hatayiBildir(hata);
  }
});

document.getElementById("randevu-ertele").addEventListener("click", () => {
  const { kayit } = randevuBaglami;
  if (!kayit || !randevuP.kapatilsinMi()) return;
  randevuP.kapat();
  randevuPenceresiniAc({ kaynak: { randevu: kayit, tur: "ertele" } });
});

// Takvimdeki kartlardan tek tıkla durum değiştirme
async function durumDegistir(r, durum) {
  try {
    await kaydet("randevular", r.id, { durum });
    if (durum === "gelmedi") bildir(`${tamAd(r)} gelmeyenler listesine eklendi.`);
  } catch (hata) {
    hatayiBildir(hata);
  }
}

/* Paneldeki hasta kaydına bağlama */

const hastaSecPenceresi = document.getElementById("hasta-sec-penceresi");
const hastaSecArama = document.getElementById("hasta-sec-arama");
const hastaSecListesi = document.getElementById("hasta-sec-listesi");

function hastaAramasi(metin) {
  const aranan = kucult(metin);
  const rakam = metin.replace(/\D/g, "").replace(/^0/, "");
  if (!aranan) return [];
  return veri.hastalar.filter((h) => {
    if (String(h.hastaNo ?? "") === aranan) return true;
    if (kucult(tamAd(h)).includes(aranan)) return true;
    if (rakam.length >= 4 && ((h.tc || "").includes(rakam) || telefonu(h.id).includes(rakam))) return true;
    return false;
  }).slice(0, 30);
}

function hastaSecListesiniCiz() {
  const sonuclar = hastaAramasi(hastaSecArama.value);
  if (!hastaSecArama.value.trim()) {
    hastaSecListesi.replaceChildren(el("li", { className: "soluk" }, "Aramak için yazın."));
    return;
  }
  if (!sonuclar.length) {
    hastaSecListesi.replaceChildren(el("li", { className: "soluk" }, "Panelde bu bilgilerle hasta bulunamadı."));
    return;
  }
  hastaSecListesi.replaceChildren(...sonuclar.map((h) => el("li", null, el("button", {
    type: "button",
    className: "secim-satiri",
    onclick: () => hastaSecildi(h),
  }, el("strong", null, tamAd(h)), el("span", { className: "soluk" }, ` · Hasta No ${h.hastaNo ?? "-"}${telefonu(h.id) ? ` · ${telefonGoster(telefonu(h.id))}` : ""}`)))));
}

function hastaBaglamayiAc() {
  const e = randevuP.form.elements;
  hastaSecArama.value = `${e.ad.value} ${e.soyad.value}`.trim();
  hastaSecListesiniCiz();
  hastaSecPenceresi.showModal();
  hastaSecArama.focus();
  hastaSecArama.select();
}

async function hastaSecildi(h) {
  hastaSecPenceresi.close();
  const e = randevuP.form.elements;
  secilenHastaId = h.id;
  bagKaldirildi = false;
  randevuPenceresi.dataset.degisti = "1";
  if (!e.ad.value.trim()) {
    e.ad.value = h.ad || "";
    e.soyad.value = h.soyad || "";
  }
  hastaBagiGoster();
  // Hastanın muhasebede telefonu yoksa randevudaki numara oraya da yazılabilir (iletisim tablosu ortak)
  const telefon = telefonOku(e.telefon.value);
  if (telefon && !iletisimBul(h.id)
    && confirm(`${tamAd(h)} için kayıtlı telefon yok. ${telefonGoster(telefon)} hastanın kaydına da yazılsın mı? (Muhasebede ve WhatsApp hatırlatmalarında kullanılır.)`)) {
    try {
      await kaydet("iletisim", null, { hasta: h.id, telefon });
      hastaBagiGoster();
    } catch (hata) {
      if (benzersizHatasiMi(hata)) bildir("Bu hastanın telefonu az önce başka bir bilgisayarda girilmiş.");
      else hatayiBildir(hata);
    }
  }
}

hastaSecArama.addEventListener("input", hastaSecListesiniCiz);
document.getElementById("hasta-sec-kapat").addEventListener("click", () => hastaSecPenceresi.close());

/* Gelmeyeni arama kaydı */

const aramaPenceresi = document.getElementById("arama-penceresi");
let aramaRandevusu = null;

const aramaP = pencereKur(aramaPenceresi, {
  alanAdlari: { sonuc: "Sonuç", not: "Not" },
  async kaydet(form) {
    const e = form.elements;
    await kaydet("aramalar", null, { randevu: aramaRandevusu.id, sonuc: e.sonuc.value, not: e.not.value.trim(), yeniRandevu: "" });
  },
});

function aramaPenceresiniAc(r) {
  aramaRandevusu = r;
  aramaP.form.reset();
  const sayi = randevununAramalari(r.id).length;
  document.getElementById("arama-hasta").textContent = `${tamAd(r)} · ${telefonGoster(r.telefon)} · `
    + `${tarihGoster(r.tarih)} ${r.saat} randevusuna gelmedi${sayi ? ` · daha önce ${sayi} kez arandı` : ""}`;
  aramaP.ac("Arama kaydet");
  aramaP.form.elements.not.focus();
}

/* Doktor */

const doktorPenceresi = document.getElementById("doktor-penceresi");
const calismaSatirlari = document.getElementById("calisma-satirlari");
let duzeltilenDoktor = null;

calismaSatirlari.replaceChildren(...GUN_ADLARI.map((ad, i) => {
  const g = i + 1;
  const saat = (alan) => el("td", null, el("input", { type: "time", step: 300, name: `${alan}${g}`, "aria-label": `${ad} ${alan}` }));
  return el("tr", null,
    el("td", null, el("label", { className: "satir-secenek" }, el("input", { type: "checkbox", name: `calisir${g}` }), ` ${ad}`)),
    saat("bas"), saat("bit"), saat("araBas"), saat("araBit"));
}));

function calismaKutulariniAyarla() {
  const e = doktorP.form.elements;
  for (let g = 1; g <= 7; g++) {
    for (const alan of ["bas", "bit", "araBas", "araBit"]) e[`${alan}${g}`].disabled = !e[`calisir${g}`].checked;
  }
}

const doktorP = pencereKur(doktorPenceresi, {
  alanAdlari: { ad: "Ad", randevuSuresi: "Randevu süresi", calismaSaatleri: "Çalışma saatleri" },
  async kaydet(form) {
    const e = form.elements;
    const ad = e.ad.value.trim();
    if (!ad) throw "Doktorun adını yazın.";
    if (veri.doktorlar.some((d) => d.id !== duzeltilenDoktor?.id && kucult(d.ad) === kucult(ad))) throw "Bu adla bir doktor zaten var.";
    const calismaSaatleri = {};
    for (let g = 1; g <= 7; g++) {
      if (!e[`calisir${g}`].checked) continue;
      const [bas, bit, araBas, araBit] = ["bas", "bit", "araBas", "araBit"].map((a) => e[`${a}${g}`].value);
      const gun = GUN_ADLARI[g - 1];
      if (!SAAT_DESENI.test(bas) || !SAAT_DESENI.test(bit)) throw `${gun}: başlangıç ve bitiş saatini yazın.`;
      if (bas >= bit) throw `${gun}: bitiş başlangıçtan sonra olmalı.`;
      if (!!araBas !== !!araBit) throw `${gun}: öğle arasının başlangıcını ve bitişini birlikte yazın (ya da ikisini de boş bırakın).`;
      if (araBas && !(bas <= araBas && araBas < araBit && araBit <= bit)) throw `${gun}: öğle arası çalışma saatlerinin içinde olmalı.`;
      calismaSaatleri[g] = { bas, bit, araBas, araBit };
    }
    if (!Object.keys(calismaSaatleri).length) throw "En az bir çalışma günü seçin.";
    await kaydet("doktorlar", duzeltilenDoktor?.id, {
      ad,
      renk: e.renk.value,
      randevuSuresi: Number(e.randevuSuresi.value) || 30,
      sira: Number(e.sira.value) || 0,
      aktif: e.aktif.checked,
      calismaSaatleri,
    });
  },
});

function doktorPenceresiniAc(kayit = null) {
  duzeltilenDoktor = kayit;
  const e = doktorP.form.elements;
  doktorP.form.reset();
  seceneklerDoldur(e.randevuSuresi, SURELER.map((dk) => [dk, sureMetni(dk)]));
  e.ad.value = kayit?.ad || "";
  e.renk.value = kayit?.renk || DOKTOR_RENKLERI[veri.doktorlar.length % DOKTOR_RENKLERI.length];
  e.randevuSuresi.value = kayit?.randevuSuresi || 30;
  e.sira.value = kayit ? kayit.sira || 0 : veri.doktorlar.length + 1;
  e.aktif.checked = kayit ? !!kayit.aktif : true;
  const calisma = kayit?.calismaSaatleri || VARSAYILAN_CALISMA;
  for (let g = 1; g <= 7; g++) {
    const gun = calisma[g];
    e[`calisir${g}`].checked = !!gun;
    const ornek = gun || VARSAYILAN_CALISMA[1];
    e[`bas${g}`].value = ornek.bas || "";
    e[`bit${g}`].value = ornek.bit || "";
    e[`araBas${g}`].value = gun ? gun.araBas || "" : ornek.araBas;
    e[`araBit${g}`].value = gun ? gun.araBit || "" : ornek.araBit;
  }
  calismaKutulariniAyarla();
  doktorP.ac(kayit ? "Doktoru Düzelt" : "Doktor Ekle");
  e.ad.focus();
}

doktorP.form.addEventListener("change", (olay) => {
  if (olay.target.name?.startsWith("calisir")) calismaKutulariniAyarla();
});

/* İzin / kapalı gün */

const izinPenceresi = document.getElementById("izin-penceresi");
const EN_COK_IZIN_GUNU = 62;

const izinP = pencereKur(izinPenceresi, {
  alanAdlari: { tarih: "Tarih", bas: "Başlangıç", bit: "Bitiş", aciklama: "Açıklama" },
  async kaydet(form) {
    const e = form.elements;
    const ilk = tarihOku(e.tarih, "İlk gün");
    const son = e.sonTarih.value || ilk;
    if (son < ilk) throw "Son gün ilk günden önce olamaz.";
    const gunler = [];
    for (let t = ilk; t <= son; t = gunEkle(t, 1)) gunler.push(t);
    if (gunler.length > EN_COK_IZIN_GUNU) throw `En çok ${EN_COK_IZIN_GUNU} gün birden girilebilir.`;
    const bas = e.bas.value;
    const bit = e.bit.value;
    if (!!bas !== !!bit) throw "Başlangıç ve bitiş saatini birlikte yazın ya da ikisini de boş bırakın.";
    if (bas && bas >= bit) throw "Bitiş saati başlangıçtan sonra olmalı.";
    const aciklama = e.aciklama.value.trim() || (e.doktor.value ? "İzin" : "Klinik kapalı");
    // Çok günlü izinde gün gün kayıt açılır; yarıda kesilirse kalanı tekrar denenebilsin diye var olanlar atlanır
    for (const tarih of gunler) {
      const varMi = veri.kapali_zamanlar.some((k) => k.tarih === tarih && k.doktor === e.doktor.value && (k.bas || "") === bas && (k.bit || "") === bit);
      if (!varMi) await kaydet("kapali_zamanlar", null, { doktor: e.doktor.value, tarih, bas, bit, aciklama });
    }
    const etkilenen = veri.randevular.filter((r) => gunler.includes(r.tarih) && aktifMi(r) && r.durum === "bekliyor"
      && (!e.doktor.value || r.doktor === e.doktor.value)
      && (!bas || (randevuBas(r) < dakika(bit) && randevuBit(r) > dakika(bas))));
    if (etkilenen.length) bildir(`Dikkat: bu aralıkta ${etkilenen.length} randevu var. Takvimden kontrol edip hastaları arayın.`);
  },
});

function izinPenceresiniAc() {
  const e = izinP.form.elements;
  izinP.form.reset();
  seceneklerDoldur(e.doktor, [["", "Tüm klinik (herkes)"], ...aktifDoktorlar().map((d) => [d.id, d.ad])]);
  e.tarih.value = bugununTarihi();
  izinP.ac("İzin / Kapalı gün");
  e.doktor.focus();
}
