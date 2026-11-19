# Randevu uygulaması → Alpotech klinik sunucusu

> **Bu belge sunucudaki Claude için yazıldı.** Laptoptaki Claude yazdı (2026-11-19).
> Klinik paneliyle ilgili sözleşme `Klinik_app/SUNUCU-BAGLANTISI.md`, muhasebeyle ilgili olan `klinik_muhasebe/SUNUCU-MUHASEBE.md`'dir. Bu belge yalnızca randevu için gereken **ek** kısmı anlatır. Çelişki olursa önce panel belgesi, sonra muhasebe belgesi geçerlidir.
> Depoya gerçek hasta verisi, telefon, şifre ya da anahtar yazılmaz.

## Sunucudaki Claude: adım adım yapılacaklar

Kullanıcı bu belgeyi sana verip "randevunun sunucu tarafını kur" diyecek. Muhasebede (`SUNUCU-MUHASEBE.md`) yaptığın işin aynısı; sırayla:

1. **Kodu al.** Depo: `https://github.com/HalilALPAK/klinik_randevu` (dal `main`).
   - Muhasebeyi `sunucu/klinik/muhasebe/` altında tutuyorsan bunu da `sunucu/klinik/randevu/` altına al.
   - Yalnızca uygulama dosyaları yayınlanır: `index.html`, `stil.css`, `*.js`, `vendor/`.
   - `kurulum/`, `*.md` ve `.git*` yayınlanmaz. `SURUM.txt`'e commit kimliğini yaz.
2. **Göçü yaz.** §5'teki taslağı kendi göç biçimine uydur.
   - Dosya adı sunucudaki son göçten sonra gelsin; taslakta `5_randevu.js` diye geçiyor.
   - Var olan göçlere dokunma.
   - Alan adları, seçim değerleri ve desenler §2 ile birebir aynı kalmalı; uygulama bunlara dayanıyor.
3. **Yayına ekle.** 7. betik (`7-klinik-pocketbase.ps1`) `randevu/` klasörünü de `pb_public/randevu/` altına kopyalasın.
   - `/randevu` adresi `/randevu/`'ya yönlensin.
   - Dosyalar `Cache-Control: no-cache` ile gelsin.
   - Kısacası muhasebe için ne yaptıysan aynısı.
4. **Dene.** §6'daki 11 maddeyi gerçek PocketBase ile dene. Muhasebedeki `test-muhasebe.mjs` gibi bir `test-randevu.mjs` yazman yeterli.
   - Gerçek panel girişiyle tarayıcıda da bir kez aç.
   - Doktor ekle, randevu ekle, gelmedi işaretle, Gelmeyenler'de gör.
5. **Yedeği kontrol et.** Yeni dört tablo gece yedeğine giriyor mu bak.
6. **Cevap yaz.** Bu belgenin sonuna **§8. Sunucu tarafı: cevap** başlığıyla şunları yaz:
   - nelerin kurulduğunu,
   - taslaktan neyi değiştirdiğini,
   - §6 sonuçlarını,
   - uygulamada değişmesi gereken bir şey varsa onu.

   Sonra kullanıcıya söyle. Kullanıcı belgeyi laptoptaki Claude'a getirecek (ya da `Z:\Projeler\klinik\` üzerinden değiş-tokuş edersiniz).

**Kurallar:**
- Laptoptaki uygulama dosyalarını (`*.js`, `index.html`, `stil.css`) sunucuda değiştirme. Gereken değişikliği §8'e yaz, laptop tarafı yapsın.
- Canlıya alma (7. betiği çalıştırma) kullanıcının onayıyla yapılır.
- Depoya ve bu belgeye gerçek hasta verisi, telefon, şifre ya da anahtar yazılmaz.

## 0. Özet: sunucuda yapılacaklar

1. **Yeni göç dosyası:** `5_randevu.js` (adı sunucudaki son göçten sonra gelecek şekilde ayarlanmalı).
   - Dört tablo ekler: `doktorlar`, `kapali_zamanlar`, `randevular`, `aramalar`. Taslak §5'te.
   - Var olan göçler değiştirilmez.
2. **Yayınlama:** Bu klasör `pb_public/randevu/` altına kopyalanır. Uygulama `http://<sunucu>:8091/randevu/` adresinden açılır.
   - 7. betik `pb_public`'i silip yeniden kopyaladığı için `randevu/` da o betiğe eklenmeli (muhasebe gibi).
   - Kopyalanacaklar: `index.html`, `stil.css`, tüm `*.js`, `vendor/`.
   - Logo panelin `pb_public/logo.png` dosyasıdır; uygulama onu `../logo.png` olarak kullanır.
   - `/randevu` adresi `/randevu/`'ya yönlenmeli ve dosyalar `Cache-Control: no-cache` ile gelmeli (muhasebedeki gibi).
3. **Yedek:** Yeni tablolar `data.db` içinde olduğu için gece yedeğine kendiliğinden girer. Bir kez kontrol edilmeli.
4. §6'daki denemeler gerçek PocketBase ile yapılmalı.

## 1. Mimari

```
Klinik bilgisayarları ──Edge──► http://<sunucu>:8091/            panel
                     ──Edge──► http://<sunucu>:8091/muhasebe/   muhasebe
                     ──Edge──► http://<sunucu>:8091/randevu/    randevu (pb_public/randevu)
                                         │
                              Klinik PocketBase :8091
        doktorlar · kapali_zamanlar · randevular · aramalar   (yeni)
        hastalar (yalnız okunur) · iletisim (okunur; hasta bağlarken telefon eklenebilir)
```

- **Aynı adres, aynı oturum:** Oturum anahtarı `pocketbase_auth` panel ve muhasebeyle aynıdır. Panelde giriş yapan kullanıcı randevuya ayrıca giriş yapmaz.
- **Rol yok:** Muhasebede olduğu gibi `doktor` ve `sekreter` her şeyi görür ve yapar.
- **Kullanım:** Hasta telefonla arar, sekreter randevuyu girer. Telefon zorunludur. Yeni arayan kişi henüz panelde kayıtlı olmayabilir; bu yüzden randevuda ad, soyad ve telefon ayrıca tutulur. `hasta` ilişkisi ise isteğe bağlıdır.
- **`hastalar` yalnızca okunur:** Randevu bu tabloya hiç yazmaz. Yeni hastanın kaydı panelde açılır (Hasta No'yu sunucu verir), sonra randevudan "Panel kaydına bağla" ile bağlanır.
- **`iletisim` (muhasebenin telefon tablosu):** Randevu bu tabloyu okur: telefon yazılınca kayıtlı hasta bulunur.
  - Yazdığı tek durum: randevu bir hastaya bağlanırken hastanın telefonu yoksa, kullanıcı onaylarsa `POST iletisim { hasta, telefon }` gönderir.
  - Hasta başına tek kayıt kuralı (400 `validation_not_unique`) aynen geçerlidir; uygulama bunu "başka bilgisayarda girilmiş" diye gösterir.
- **Anlık güncelleme:** Altı tabloya abone olur: `doktorlar`, `kapali_zamanlar`, `randevular`, `aramalar`, `hastalar`, `iletisim` (`subscribe("*")`).
- **Veri boyutu:** `randevular` her gün büyüyen tek tablodur.
  - Açılışta yalnızca son 60 gün ve sonrası, artı tüm `durum = "gelmedi"` kayıtları çekilir.
  - Takvimde daha eski bir güne gidilince o aralık ayrıca çekilir.
  - Telefon yazılınca o numaranın geçmişi `filter: telefon = "..."` ile ayrıca sorulur.
  - Diğer tablolar küçüktür ve tamamı çekilir.

## 2. Tablolar

**Tarih kuralı:** `tarih` alanları `YYYY-AA-GG`, saatler `SS:DD` metnidir (24 saat).
**Telefon kuralı:** `iletisim` ile aynı: uluslararası rakamlar, `+` olmadan (`905321234567`), `^[0-9]{8,15}$`.
**Ortak erişim kuralı:** Beş işlemin hepsi `@request.auth.id != ""`. `created`/`updated` otomatik alanlardır.

### `doktorlar`

| Alan | Tür | Kural |
|---|---|---|
| `ad` | metin | zorunlu, en çok 100 karakter (örn. "Dt. Ayşe Yılmaz") |
| `renk` | metin | `^(#[0-9a-fA-F]{6})?$`; takvimdeki renk |
| `aktif` | bool | Pasif doktor takvimde sütun olarak görünmez |
| `sira` | sayı (tam) | ≥ 0; takvimde sütun sırası |
| `randevuSuresi` | sayı (tam) | zorunlu, 5–480 dakika; yeni randevuda varsayılan süre |
| `calismaSaatleri` | JSON | `{ "1": { "bas": "09:00", "bit": "18:00", "araBas": "12:30", "araBit": "13:30" }, … }`. Anahtar haftanın günüdür (1 = Pazartesi … 7 = Pazar). Anahtar yoksa o gün çalışmıyor. Öğle arası boş olabilir |

- Doktorlar `users` tablosuna bağlı değildir: `users`'ın listRule'u yalnızca kişinin kendisini gösteriyor, ayrıca hesabı olmayan doktor da takvimde olabilmeli.
- Randevusu olan doktor silinemez (`randevular.doktor` zorunlu, `cascadeDelete: false`). Uygulama silmek yerine "pasif yap" der.

### `kapali_zamanlar` (izin, tatil, kapalı gün)

| Alan | Tür | Kural |
|---|---|---|
| `doktor` | ilişki → `doktorlar` | isteğe bağlı, `cascadeDelete: true`. **Boşsa tüm klinik kapalı** (bayram vb.) |
| `tarih` | metin `YYYY-AA-GG` | zorunlu |
| `bas`, `bit` | metin `SS:DD` | ikisi de boşsa bütün gün; uygulama ikisini birlikte doldurur |
| `aciklama` | metin | en çok 200 karakter |

- Çok günlü izin gün gün ayrı kayıt olarak açılır (en çok 62 gün).
- Takvimde gri görünür. Engel değildir: o saate randevu verilirken kullanıcı uyarılır ve onaylarsa yine kaydedilir.

### `randevular`

| Alan | Tür | Kural |
|---|---|---|
| `doktor` | ilişki → `doktorlar` | zorunlu, `cascadeDelete: false` |
| `hasta` | ilişki → `hastalar` | **isteğe bağlı**, `cascadeDelete: false` (hasta silinirse alan boşalır, randevu kalır) |
| `ad` | metin | zorunlu, en çok 100 |
| `soyad` | metin | en çok 100 |
| `telefon` | metin | zorunlu, `^[0-9]{8,15}$` |
| `tarih` | metin `YYYY-AA-GG` | zorunlu |
| `saat` | metin `SS:DD` | zorunlu, `^([01]\d\|2[0-3]):[0-5]\d$` |
| `sure` | sayı (tam) | zorunlu, 5–480 dakika |
| `islem` | metin | en çok 200 (muayene, dolgu…). Serbest metin |
| `not` | metin | en çok 1000 |
| `ilkGelis` | bool | Hasta kliniğe ilk kez geliyor |
| `durum` | seçim | `bekliyor`, `geldi`, `gelmedi`, `iptal`, `ertelendi`; zorunlu |
| `hatirlatildi` | bool | WhatsApp hatırlatması gönderildi. Tarih ya da saat değişince uygulama `false` yapar |
| `oncekiRandevu` | ilişki → `randevular` | isteğe bağlı, `cascadeDelete: false`. Ertelenen ya da gelinmeyen randevunun yerine açılan randevuda eskisinin id'si |

- **İndeksler:** `(tarih, doktor)`, `(durum)`, `(telefon)`, `(oncekiRandevu)`.
- **Çakışma sunucuda engellenmez.** Aynı doktora aynı saatte iki randevu bilerek verilebilir (kısa kontrol, acil hasta). Uygulama kaydetmeden önce uyarır ve onay ister.
- **Ertele:** Yeni randevu açılır (`oncekiRandevu` = eski), sonra eskisi `PATCH { durum: "ertelendi" }` olur.
- **Silme:** Yanlış girilen randevu her kullanıcı tarafından silinebilir. Uygulama "gelmeyecekse İptal seçin" diye uyarır.

### `aramalar` (gelmeyen hastayı geri arama kaydı)

| Alan | Tür | Kural |
|---|---|---|
| `randevu` | ilişki → `randevular` | zorunlu, `cascadeDelete: true` |
| `sonuc` | seçim | `ulasilamadi`, `sonra_ara`, `yeni_randevu`, `vazgecti`; zorunlu |
| `not` | metin | en çok 500 |
| `yeniRandevu` | ilişki → `randevular` | isteğe bağlı, `cascadeDelete: false`; `sonuc = yeni_randevu` iken açılan randevu |

- **Gelmeyenler listesi:** `durum = "gelmedi"` olan ve kapanmamış randevular.
  - Kapanmış sayılır: `sonuc` değeri `yeni_randevu` ya da `vazgecti` olan bir araması varsa, ya da onu `oncekiRandevu` gösteren bir randevu varsa.
  - Bu hesap tarayıcıda yapılır, sunucuda özel uç gerekmez.

### WhatsApp

- Muhasebedeki gibi yalnızca `wa.me` bağlantısı açılır, sunucuya iş düşmez. Otomatik gönderim yok.
- **KVKK:** Mesajda yalnızca ad, tarih ve saat bulunur. İşlem adı (`islem`) ve not mesaja **girmez**.
  - Hatırlatma: "Merhaba {ad soyad}, Alpotech Klinik'ten yazıyoruz. yarın (GG.AA.YYYY Gün) saat SS:DD randevunuzu hatırlatırız. Gelemeyecekseniz lütfen bize haber verin."
  - Gelmeyen: "Merhaba {ad soyad}, Alpotech Klinik'ten yazıyoruz. GG.AA.YYYY tarihli randevunuza gelemediğinizi gördük. Size uygun yeni bir gün ve saat yazar mısınız?"
- **Telefon ve hasta adı kişisel veridir.** Yedekte ve olası değişiklik kaydında diğer hasta verisi gibi ele alınmalı.

## 3. Uygulamanın dayandığı ayrıntılar

- **Sıralama:**
  - `doktorlar` → `sira,ad`
  - `kapali_zamanlar` → `tarih,bas`
  - `randevular` → `tarih,saat`
  - `aramalar`, `iletisim` → `created`
  - `hastalar` → `hastaNo`
- **Filtreler (SDK `pb.filter` ile, değerler çift tırnakla gelir):**
  - `randevular`: `tarih >= {:t} || durum = 'gelmedi'`
  - `randevular`, `kapali_zamanlar`: `tarih >= {:bas} && tarih < {:bit}`
  - `kapali_zamanlar`: `tarih >= {:t}`
  - `randevular`: `telefon = {:t}`
- **404:** Silinmiş kayda gelen istekte 404 beklenir; uygulama bunu "başka bilgisayarda silinmiş" sayar.
- **Eşzamanlı düzeltme:** `beklenenGuncelleme` kullanılmaz. Aynı randevuyu iki kişi aynı anda değiştirirse son kaydeden geçerli olur, diğer ekran anlık güncellenir. Bu bilerek böyle.
- **Kim yaptı:** İstemci göndermez. Sunucu muhasebedeki gibi `olusturan`/`guncelleyen` eklemek isterse uygulamada değişiklik gerekmez.

## 4. Laptopta yapılan deneme

Bu laptopta PocketBase çalıştırılamadığı için uygulama, bu sözleşmeyi taklit eden bir Python test sunucusuna karşı Playwright ile denendi. İki ayrı tarayıcı oturumu kullanıldı (doktor + sekreter). **50/50 kontrol geçti:**

- **Doktorlar:** ekleme; aynı adın reddi; diğer bilgisayarın takviminde anlık sütun.
- **Randevu:**
  - Kayıtlı telefon (`iletisim`) yazınca ad, soyad ve panel kaydı otomatik geldi.
  - Çakışma uyarısı çıktı; geçersiz telefon reddedildi.
  - Boş saate tıklayınca o saat dolu açıldı.
  - Diğer bilgisayarda anlık göründü.
- **Gelmedi:**
  - Karttaki hızlı düğmeyle işaretlendi; diğer bilgisayarda menü rozeti anlık 1 oldu.
  - Gelmeyenler listesinde göründü. Arama kaydı (not ile) eklendi, kayıt listede kaldı.
  - "Yeniden randevu" ile dolu form açıldı. Kaydedince kayıt listeden düştü, sunucuya `yeni_randevu` araması yazıldı.
- **Telefon geçmişi:** Aynı numarayla yeni randevuda "1 gelmedi" ve "Zaten randevusu var" gösterildi.
- **Hatırlatma:**
  - Yalnızca bekleyen/gelen randevular listelendi.
  - WhatsApp mesajında işlem adı yoktu.
  - "Hatırlatıldı" sunucuya yazıldı ve diğer bilgisayara geldi.
- **Sürükle-bırak:** Randevu başka doktora ve saate taşındı, `hatirlatildi` sıfırlandı.
- **Ertele:** Yeni randevu `oncekiRandevu` ile bağlandı, eskisi `ertelendi` oldu. Ertelenenler varsayılan olarak gizli, işaretlenince göründü.
- **Hafta görünümü:** 7 sütun.
- **Kapalı gün:** Tüm klinik kapalı günü iki doktor sütununda gri göründü, o güne randevuda uyarı çıktı.
- **Panel kaydına bağlama:** Hasta arayıp seçildi. Telefonu olmayan hastaya `iletisim` kaydı açıldı.
- **Diğer:**
  - Günlük yazdırma listesi doldu.
  - 120 gün önceye gidince eski aralık yüklendi.
  - Randevulu doktor silinemedi, randevusuz doktor silindi.
  - 390 px genişlikte dört ekranda da yatay taşma olmadı.
  - Konsolda hata yoktu.

## 5. `5_randevu.js` taslağı (PocketBase v0.40 JS göçü)

Gerçek PocketBase'de denenmedi. Sunucudaki Claude kendi göçlerinin biçimine uydurup sınamalı. Kendine bağlanan ilişkiler (`oncekiRandevu`, `yeniRandevu`) tablonun id'si gerektiği için tablo kaydedildikten sonra eklenir.

```js
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const girisli = '@request.auth.id != ""';
  const kurallar = { listRule: girisli, viewRule: girisli, createRule: girisli, updateRule: girisli, deleteRule: girisli };
  const hastalar = app.findCollectionByNameOrId("hastalar");
  const zaman = [
    { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
  ];
  const tarih = { type: "text", name: "tarih", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
  const saatBos = (name) => ({ type: "text", name, pattern: "^(([01]\\d|2[0-3]):[0-5]\\d)?$" });

  const doktorlar = new Collection({
    type: "base", name: "doktorlar", ...kurallar,
    fields: [
      { type: "text", name: "ad", required: true, max: 100 },
      { type: "text", name: "renk", pattern: "^(#[0-9a-fA-F]{6})?$" },
      { type: "bool", name: "aktif" },
      { type: "number", name: "sira", onlyInt: true, min: 0 },
      { type: "number", name: "randevuSuresi", required: true, onlyInt: true, min: 5, max: 480 },
      { type: "json", name: "calismaSaatleri", maxSize: 5000 },
      ...zaman,
    ],
  });
  app.save(doktorlar);

  app.save(new Collection({
    type: "base", name: "kapali_zamanlar", ...kurallar,
    fields: [
      { type: "relation", name: "doktor", collectionId: doktorlar.id, maxSelect: 1, cascadeDelete: true },
      tarih, saatBos("bas"), saatBos("bit"),
      { type: "text", name: "aciklama", max: 200 },
      ...zaman,
    ],
    indexes: ["CREATE INDEX idx_kapali_tarih ON kapali_zamanlar (tarih)"],
  }));

  const randevular = new Collection({
    type: "base", name: "randevular", ...kurallar,
    fields: [
      { type: "relation", name: "doktor", required: true, collectionId: doktorlar.id, maxSelect: 1, cascadeDelete: false },
      { type: "relation", name: "hasta", collectionId: hastalar.id, maxSelect: 1, cascadeDelete: false },
      { type: "text", name: "ad", required: true, max: 100 },
      { type: "text", name: "soyad", max: 100 },
      { type: "text", name: "telefon", required: true, pattern: "^[0-9]{8,15}$" },
      tarih,
      { type: "text", name: "saat", required: true, pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
      { type: "number", name: "sure", required: true, onlyInt: true, min: 5, max: 480 },
      { type: "text", name: "islem", max: 200 },
      { type: "text", name: "not", max: 1000 },
      { type: "bool", name: "ilkGelis" },
      { type: "bool", name: "hatirlatildi" },
      { type: "select", name: "durum", required: true, maxSelect: 1, values: ["bekliyor", "geldi", "gelmedi", "iptal", "ertelendi"] },
      ...zaman,
    ],
    indexes: [
      "CREATE INDEX idx_randevu_tarih_doktor ON randevular (tarih, doktor)",
      "CREATE INDEX idx_randevu_durum ON randevular (durum)",
      "CREATE INDEX idx_randevu_telefon ON randevular (telefon)",
    ],
  });
  app.save(randevular);
  randevular.fields.add(new RelationField({ name: "oncekiRandevu", collectionId: randevular.id, maxSelect: 1, cascadeDelete: false }));
  randevular.indexes.push("CREATE INDEX idx_randevu_onceki ON randevular (oncekiRandevu)");
  app.save(randevular);

  app.save(new Collection({
    type: "base", name: "aramalar", ...kurallar,
    fields: [
      { type: "relation", name: "randevu", required: true, collectionId: randevular.id, maxSelect: 1, cascadeDelete: true },
      { type: "select", name: "sonuc", required: true, maxSelect: 1, values: ["ulasilamadi", "sonra_ara", "yeni_randevu", "vazgecti"] },
      { type: "text", name: "not", max: 500 },
      { type: "relation", name: "yeniRandevu", collectionId: randevular.id, maxSelect: 1, cascadeDelete: false },
      ...zaman,
    ],
    indexes: ["CREATE INDEX idx_arama_randevu ON aramalar (randevu)"],
  }));
}, (app) => {
  for (const ad of ["aramalar", "randevular", "kapali_zamanlar", "doktorlar"]) {
    app.delete(app.findCollectionByNameOrId(ad));
  }
});
```

**Dikkat edilecekler:**
- `number` alanında `required: true` 0'ı da reddeder. `sira` bu yüzden zorunlu değildir.
- **İlişkili kayıt silme:** Yeni randevu, ertelenen randevuyu `oncekiRandevu` ile gösterir. Bu yüzden eski randevu silinmek istenirse ne olacağı kontrol edilmeli.
  - Uygulamanın beklentisi: silme kabul edilsin, isteğe bağlı ilişki boşalsın. PocketBase'in isteğe bağlı ilişkide varsayılan davranışı budur.
  - Silme reddediliyorsa (400), uygulama mevcut hata mesajını gösterir; bu da kabul edilebilir.
- **İleride `randevu_gecmisi`:** Muhasebedeki `muhasebe_gecmisi` gibi bir değişiklik kaydı istenirse `randevular` ve `aramalar` kapsama alınabilir. Uygulamada değişiklik gerekmez.

## 6. Gerçek sunucuda denenecekler

1. Panelde giriş yapıp `/randevu/` adresini açınca yeniden giriş istenmemeli.
2. Doktor ekleme, düzeltme. `calismaSaatleri` JSON'u olduğu gibi geri gelmeli.
3. Randevu ekleme: kayıtlı telefonda (`iletisim`) hastanın adı otomatik gelmeli.
4. `filter: telefon = "905..."` ile geçmiş sorgusu çalışmalı. Açılıştaki `tarih >= ... || durum = 'gelmedi'` filtresi doğru sonuç vermeli.
5. Geçersiz değerler → 400:
   - `telefon: "0532 123 45 67"`
   - `saat: "9:00"`
   - `tarih: "19.11.2026"`
   - `durum: "x"`
   - `sure: 0`
6. Randevusu olan doktoru silmek → reddedilmeli. Randevusuz doktor silinince izinleri de silinmeli.
7. Randevu silinince aramaları da silinmeli (`cascadeDelete: true`).
8. İki pencerede: gelmedi işaretleme, gelmeyen rozeti, arama kaydı, sürükle-bırak anlık güncellenmeli.
9. Hasta yönetici panelinden silinince randevuları kalmalı, `hasta` alanı boşalmalı.
10. Gece yedeğinde yeni tabloların bulunduğu kontrol edilmeli.
11. Klinikteki bir bilgisayarda WhatsApp düğmesi sohbeti açmalı (o bilgisayarda internet ve WhatsApp girişi olmalı).

## 7. Laptop tarafında bekleyenler

- Kullanıcı isterse klinik paneline "Randevu" bağlantısı (`/randevu/`) eklenecek. Bu, `Klinik_app` deposunda ayrı bir değişikliktir.
- Masaüstü simgesi: `kurulum/Alpotech_Randevu_Kurulum.bat`. Sunucuya kopyalanmaz; klinik bilgisayarlarında elle çalıştırılır.
