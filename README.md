# Alpotech Randevu

Alpotech Klinik için telefonla randevu sistemi. Hasta arar, sekreter randevuyu girer. Randevular doktor takviminde görünür, gelen ya da gelmeyen olarak işaretlenir, gelmeyenler geri aranmak üzere ayrı listede toplanır.

Klinik paneli ve muhasebe ile **aynı PocketBase sunucusunu** kullanır. Sunucuda `http://<sunucu>:8091/randevu/` adresinden açılır ve panelle aynı oturumu paylaşır. Sunucu tarafı sözleşmesi: [SUNUCU-RANDEVU.md](SUNUCU-RANDEVU.md).

## Ekranlar

- **Takvim**
  - **Gün görünümü:** Doktorlar yan yana sütun olarak görünür. **Hafta görünümü:** Tek doktorun 7 günü.
  - Boş saate tıklayınca o saate randevu açılır.
  - Kartın üstüne gelince ✓ (geldi) ve ✗ (gelmedi) düğmeleri çıkar. Karta tıklayınca randevu açılır.
  - Kart sürüklenerek başka saate ya da doktora taşınır.
  - Çalışma saati dışı, öğle arası ve izinler gri görünür; şimdiki saat kırmızı çizgiyle gösterilir.
  - "Günü Yazdır" o günün listesini doktor doktor yazdırır.
- **Randevu penceresi**
  - Önce telefon yazılır. Numara muhasebede kayıtlıysa hasta bulunur, adı gelir ve panel kaydına bağlanır.
  - Bu numaranın önceki randevuları, kaç kez gelmediği ve ileride randevusu olup olmadığı gösterilir.
  - Aynı doktorda çakışma ya da çalışma saati dışı olursa uyarır; kullanıcı onaylarsa yine kaydeder.
  - Durum seçenekleri: Bekliyor / Geldi / Gelmedi / İptal.
  - "Ertele" ile yeni randevu açılır, eskisi "Ertelendi" olur. "Sil" yalnızca yanlış girişler içindir.
  - Yeni hasta panelde kayıtlı değilse randevu yalnızca ad ve telefonla açılır. Hastanın kaydı panelde açıldıktan sonra "Panel kaydına bağla" ile bağlanır.
- **Gelmeyenler**
  - Geri aranacak hastalar burada listelenir; menüdeki kırmızı rozet sayılarını gösterir.
  - Numaraya tıklanınca arama başlar. WhatsApp düğmesi hazır mesajla sohbeti açar.
  - "Arama kaydet" ile sonuç ve not yazılır: ulaşılamadı / sonra aranacak / vazgeçti.
  - "Yeniden randevu" formu dolu açar. Yeni randevu kaydedilince ya da "Vazgeçti" seçilince hasta listeden düşer.
- **Hatırlatma**
  - Seçilen günün (varsayılan yarın) randevuları listelenir.
  - WhatsApp düğmesi hazır hatırlatma mesajını açar ve randevuyu "hatırlatıldı" işaretler. Bu işaret bütün bilgisayarlarda görünür.
- **Doktorlar**
  - Doktor eklenir; adı, rengi, varsayılan randevu süresi ve her günün çalışma saatleri ile öğle arası girilir.
  - **İzinler ve kapalı günler:** Tek doktor ya da tüm klinik için girilir; bir gün, birkaç gün ya da günün bir kısmı olabilir.

**KVKK:** WhatsApp mesajlarında yalnızca ad, tarih ve saat bulunur; işlem adı ve not yazılmaz.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html`, `stil.css` | Sayfa ve görünüm (renkler panelle aynı) |
| `sunucu.js` | PocketBase bağlantısı, oturum, anlık güncelleme (muhasebeyle aynı) |
| `veri.js` | Tabloların bellekteki kopyası; çalışma saati, çakışma, gelmeyen hesapları, telefon biçimi, WhatsApp mesajları |
| `ortak.js` | Tarih/saat ve DOM yardımcıları |
| `pencereler.js` | Randevu, hasta bağlama, arama, doktor ve izin pencereleri |
| `takvim.js` | Gün/hafta takvimi, sürükle-bırak, günlük yazdırma |
| `gelmeyenler.js`, `hatirlatma.js`, `doktorlar.js` | Diğer ekranlar |
| `uygulama.js` | Giriş, yönlendirme, açılış |
| `kurulum/Alpotech_Randevu_Kurulum.bat` | Klinik bilgisayarlarına masaüstü simgesi koyar |

## Yayınlama

Sunucuda bu klasördeki `index.html`, `stil.css`, `*.js` ve `vendor/` dosyaları `pb_public/randevu/` altına kopyalanır (SUNUCU-RANDEVU.md §0). Dosya doğrudan (`file://`) açılırsa yalnızca adres uyarısı gösterilir.

Klinik bilgisayarlarında `kurulum/Alpotech_Randevu_Kurulum.bat` çift tıklanır. Bilgisayara "Alpotech Randevu" simgesi kurulur.

Depoya gerçek hasta verisi, telefon ya da şifre konmaz.
