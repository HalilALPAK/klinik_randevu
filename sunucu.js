"use strict";

/*
 * Klinik sunucusuyla (PocketBase) konuşan katman. Sözleşme: SUNUCU-RANDEVU.md
 * Uygulama sunucuda /randevu/ altından yayınlanır; API adresi location.origin.
 * Klinik paneliyle aynı adreste olduğu için oturum da aynı anahtardadır (muhasebe de öyle):
 * panelde giriş yapan kullanıcı randevuya da girişli gelir.
 */

const SUNUCUDAN_ACILDI = location.protocol === "http:" || location.protocol === "https:";

// "Beni hatırla": panelle aynı anahtarlar (klinik_sistem/sunucu.js)
const OTURUM_ANAHTARI = "pocketbase_auth";
const BENI_HATIRLA_ANAHTARI = "klinik.beniHatirla";

function depoyaYaz(depo, anahtar, deger) {
  try {
    if (deger === null) depo.removeItem(anahtar);
    else depo.setItem(anahtar, deger);
  } catch {}
}

function depodanOku(depo, anahtar) {
  try {
    return depo.getItem(anahtar);
  } catch {
    return null;
  }
}

function beniHatirlaSecimi() {
  return depodanOku(localStorage, BENI_HATIRLA_ANAHTARI) !== "0"; // ilk açılışta işaretli
}

const OturumDeposu = (() => {
  if (!SUNUCUDAN_ACILDI) return null;
  // UMD paketi yalnızca istemciyi dışa veriyor; BaseAuthStore varsayılan deponun atası
  const BaseAuthStore = Object.getPrototypeOf(new PocketBase(location.origin).authStore.constructor);

  return class extends BaseAuthStore {
    constructor() {
      super();
      this.kalici = true;
      for (const [depo, kalici] of [[localStorage, true], [sessionStorage, false]]) {
        try {
          const kayit = JSON.parse(depodanOku(depo, OTURUM_ANAHTARI) || "null");
          if (kayit && kayit.token) {
            this.kalici = kalici;
            super.save(kayit.token, kayit.record || kayit.model || null);
            break;
          }
        } catch {}
      }
    }

    hatirla(kalici) {
      this.kalici = kalici;
      depoyaYaz(localStorage, BENI_HATIRLA_ANAHTARI, kalici ? "1" : "0");
    }

    save(token, record) {
      super.save(token, record);
      const [hedef, diger] = this.kalici ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
      depoyaYaz(hedef, OTURUM_ANAHTARI, JSON.stringify({ token, record }));
      depoyaYaz(diger, OTURUM_ANAHTARI, null);
    }

    clear() {
      super.clear();
      depoyaYaz(localStorage, OTURUM_ANAHTARI, null);
      depoyaYaz(sessionStorage, OTURUM_ANAHTARI, null);
    }
  };
})();

const pb = SUNUCUDAN_ACILDI ? new PocketBase(location.origin, new OturumDeposu()) : null;
if (pb) pb.autoCancellation(false);

const OTURUM_TAZELEME_ARALIGI = 30 * 60 * 1000;

const baglantiBandi = document.getElementById("baglanti-bandi");
const bildirimKutusu = document.getElementById("bildirim");

let oturumBittiIsleyicisi = () => {};
let yenidenDeneIsleyicisi = () => {};
let bildirimZamanlayici = null;

const kullanici = () => pb.authStore.record;
const agHatasiMi = (hata) => hata && hata.status === 0 && !hata.isAbort;

function baglantiSorunu(varMi) {
  baglantiBandi.hidden = !varMi;
}

function bildir(mesaj) {
  bildirimKutusu.textContent = mesaj;
  bildirimKutusu.hidden = false;
  clearTimeout(bildirimZamanlayici);
  bildirimZamanlayici = setTimeout(() => {
    bildirimKutusu.hidden = true;
  }, 6000);
}

// Ağ ve oturum hatalarını ortak yerde ele alır; ele aldıysa true döner
function genelHatayiIsle(hata) {
  if (agHatasiMi(hata)) {
    baglantiSorunu(true);
    return true;
  }
  if (hata && hata.status === 401) {
    oturumBittiIsleyicisi("Oturumun süresi doldu. Lütfen yeniden giriş yapın.");
    return true;
  }
  return false;
}

// Sunucuya giden her istek bundan geçer
async function istek(islem) {
  if (!pb.authStore.isValid) {
    oturumBittiIsleyicisi("Oturumun süresi doldu. Lütfen yeniden giriş yapın.");
    throw new Error("oturum yok");
  }
  try {
    const sonuc = await islem();
    baglantiSorunu(false);
    return sonuc;
  } catch (hata) {
    genelHatayiIsle(hata);
    throw hata;
  }
}

async function girisYap(eposta, sifre, beniHatirla) {
  pb.authStore.hatirla(beniHatirla);
  await pb.collection("users").authWithPassword(eposta, sifre);
}

function oturumuKapat() {
  pb.realtime.unsubscribe().catch(() => {});
  pb.authStore.clear();
}

// Açık kalan uygulamada token'ın süresi dolmasın diye düzenli tazelenir
setInterval(() => {
  if (pb && pb.authStore.isValid) pb.collection("users").authRefresh().catch(genelHatayiIsle);
}, OTURUM_TAZELEME_ARALIGI);

/*
 * Anlık güncelleme. olayIsleyici(koleksiyon, { action, record }) her olayda çağrılır.
 * Bağlantı koparsa SDK yeniden bağlanır; arada kaçan olaylar için yenidenBaglandi çağrılır.
 */
async function anlikGuncellemeleriBaslat(koleksiyonlar, olayIsleyici, yenidenBaglandi) {
  let ilkBaglanti = true;
  pb.realtime.onDisconnect = (abonelikler) => {
    if (abonelikler.length) baglantiSorunu(true);
  };
  await pb.realtime.subscribe("PB_CONNECT", () => {
    baglantiSorunu(false);
    if (!ilkBaglanti) yenidenBaglandi();
    ilkBaglanti = false;
  });
  for (const koleksiyon of koleksiyonlar) {
    await pb.collection(koleksiyon).subscribe("*", (olay) => olayIsleyici(koleksiyon, olay));
  }
}

document.getElementById("baglanti-tekrar").addEventListener("click", () => yenidenDeneIsleyicisi());
