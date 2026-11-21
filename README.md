# Ekinvya

Ekinvya; parsel kayıtları, Sentinel‑2 tarla analizleri, tarımsal hesaplar ve konuma dayalı hava tahminlerini tek ekranda sunan mobil web uygulamasıdır.

## Proje yapısı

- `index.html` — uygulamanın ana sayfası
- `aydinlatma.html` — üyelik sırasında bağlantı verilen KVKK aydınlatma metni taslağı
- `styles.css` — masaüstü ve mobil arayüz stilleri
- `app.js` — arayüz, bulut kayıtları, GPS, Open-Meteo ve Windy bağlantıları
- `field-map.js` — haritada parsel sınırı çizimi ve alan hesabı
- `api/ndvi.js` — kullanıcı oturumunu doğrulayıp Copernicus Sentinel Hub’dan Sentinel‑2 L2A NDVI istatistiklerini alan Vercel Function
- `auth.js` ve `supabase-config.js` — e-posta üyeliği, giriş, doğrulama, şifre sıfırlama ve oturum yönetimi
- `cloud-storage.js` — parsel, maliyet, sezon ve hesap kayıtlarını kullanıcı hesabına göre Supabase ile eşitler
- `supabase/migrations/202611200001_ekinvya_user_data.sql` — kişisel bulut tablosu ve kullanıcı başına satır güvenliği (RLS)
- `manifest.webmanifest` ve `service-worker.js` — HTTPS üzerinde ana ekrana ekleme ve uygulama kabuğunu çevrimdışı açma desteği
- `favicon.svg` — Ekinvya uygulama simgesi
- `vercel.json` — güvenlik ve konum izni yanıt başlıkları
- `scripts/` — yerel geliştirme sunucusu ve proje kontrolü

## Yerelde çalıştırma

Node.js 18 veya daha yeni bir sürüm kurulu olmalı. Proje klasöründe:

```sh
npm run dev
```

Ardından `http://localhost:4173` adresini aç. `localhost`, tarayıcının GPS izni isteyebildiği güvenli bağlamlardan biridir. Uygulamayı telefonda kullanmak için HTTPS üzerinden yayınla.

## Kontrol

```sh
npm run check
```

Bu komut temel proje dosyalarını, HTML kimliklerini, uygulama dosyası bağlantılarını ve JavaScript sözdizimini kontrol eder.

## Üyelik ve bulut kayıtları

Kayıt/giriş ekranı Supabase Auth kullanır. Proje URL'si ve istemcide kullanılabilen publishable key `supabase-config.js` içinde tanımlıdır. Gizli `secret` veya `service_role` anahtarları istemci dosyalarına eklenmemelidir.

Yayın ortamını yapılandırırken:

1. **Authentication → Sign In / Providers** içinde e-posta/şifre girişini etkinleştir.
2. **Authentication → URL Configuration** içinde Site URL olarak `https://www.ekinvya.com` ayarla. Redirect URL listesinde `https://www.ekinvya.com/**`, `https://ekinvya.com/**` ve yerel geliştirme için `http://localhost:4173/**` bulunsun.
3. E-posta doğrulaması ve şifre sıfırlama için özel SMTP kullan. SMTP parolasını yalnızca Supabase panelinde tut; kaynak koduna veya GitHub'a ekleme.
4. `public.ekinvya_user_data` tablosu henüz yoksa `supabase/migrations/202611200001_ekinvya_user_data.sql` migration'ını Supabase SQL Editor'da bir kez uygula. Tablo ve RLS politikaları mevcutsa tekrar çalıştırmaya gerek yoktur.
5. Değişiklikleri göndermeden önce `npm run check` çalıştır.

Hesaplar Supabase Auth tarafından; uygulama kayıtları ise tek bir JSONB satırında hesap başına saklanır. İlk girişte o tarayıcıdaki eski kayıtlar oturum açan hesaba taşınır. Sonraki cihazlarda aynı hesapla giriş yapılınca bulut verileri indirilir. Aynı tarayıcıda farklı hesaplar kullanılırsa yerel önbellekler hesap kimliğine göre ayrılır. Uygulama, tablo kurulana kadar yerel kayıtları korur ve durum alanında bulut eşitleme sorununu gösterir.

## GitHub ve Vercel dağıtımı

Kaynak depo `serdarelgl/ekinvya`, üretim dalı `main`'dir. Depo Vercel projesine bağlıysa `main` dalına gönderilen commit otomatik üretim dağıtımı başlatır. Uygulama kökteki `index.html` üzerinden statik olarak sunulur; özel build komutu gerekmez. `ekinvya_v4_Tarla_Sezon_Islem_Karlilik.html` yerel yedektir ve `.gitignore` ile dışarıda bırakılır.

## Sentinel‑2 parsel ve NDVI

Parsellerim ekranında Leaflet haritası üzerinde poligon çizilebilir ve sınır GeoJSON olarak parsel kaydına eklenir. Çizimden hesaplanan yaklaşık alan dekara çevrilir. Mevcut tarla sınırları da düzenlenebilir. Harita altlığı OpenStreetMap’tir; analiz verisi ise Copernicus Data Space üzerinden Sentinel‑2 L2A’dır. Mapbox veya Mapbox tokenı gerekmez.

NDVI analizi, seçilen parsel geometrisi ve tarih aralığı için Sentinel Hub Statistical API’ye gönderilir. Kırmızı B04 ve yakın kızılötesi B08 bantlarından `(B08 - B04) / (B08 + B04)` hesaplanır; SCL sınıflandırmasındaki bulut, gölge, sirüs, kar ve geçersiz pikseller dışarıda bırakılır. Sonuçlar 10 günlük dönem ortalaması, minimum/maksimum ve geçerli piksel sayısı olarak gösterilir. Bulut ve uydu geçiş sıklığı nedeniyle her dönemde gözlem olmayabilir. NDVI tek başına verim veya hastalık teşhisi değildir.

Canlı NDVI sorgularını etkinleştirmek için:

1. [Copernicus Data Space](https://dataspace.copernicus.eu/) hesabında Dashboard → User Settings → OAuth clients bölümünden bir OAuth client oluştur. Client ID ve secret değerlerini güvenli bir yerde sakla.
2. Vercel → Ekinvya projesi → Settings → Environment Variables bölümünde şu değişkenleri Production (ve istersen Preview) için tanımla: `COPERNICUS_CLIENT_ID`, `COPERNICUS_CLIENT_SECRET`, `EKINVYA_SUPABASE_URL`, `EKINVYA_SUPABASE_PUBLISHABLE_KEY`. Son iki değer, `supabase-config.js` içindeki URL ve publishable key ile aynıdır. Secret değerlerini GitHub’a veya tarayıcı koduna ekleme.
3. Vercel’de yeni deployment başlat. API yalnızca geçerli Supabase oturumuyla çağrılır; parsel geometrisi ve NDVI sorgu geçmişi hesabın kullanıcı verisi satırında saklanır.

Bu OAuth istemcisi henüz Vercel ortam değişkenlerinde tanımlı değilse NDVI düğmesi doğru biçimde yapılandırma mesajı verir; canlı uydu analizi credential kurulana kadar çalışmaz.

## Veri, konum ve servis sınırları

- Parsel, NPK kayıtları, fiyatlar, maliyetler, senaryolar, sezon ve operasyon kayıtları giriş yapan kullanıcının Supabase satırında saklanır; tarayıcı çevrimdışı/ilk yükleme için yerel önbellek kullanır. RLS, farklı hesapların satırlarını ayırır. Bulut eşitlemesi için yukarıdaki SQL migration'ın Supabase projesine uygulanması ve uygulamanın yeni sürümünün dağıtılması gerekir.
- GPS yalnızca kullanıcı konum düğmesine bastığında istenir. Koordinatlar Open-Meteo hava tahmini isteğine ve Windy haritası bağlantısına gönderilir.
- Parsel sınırı ve Sentinel‑2 NDVI sorgu geçmişi, diğer tarla alanlarıyla birlikte Supabase kullanıcı satırında saklanır. Sentinel Hub OAuth secret anahtarı yalnızca Vercel sunucu ortamında bulunur.
- Ana sayfa ve ayrıntılı sayısal rapor Open-Meteo verisini kullanır. Open-Meteo ücretsiz API'si ticari olmayan kullanım içindir; ürün ticari amaçla sunulacaksa uygun lisans/API planı gerekir. Veriler CC BY 4.0 atfı ile gösterilir.
- Windy gömülü haritası kendi katman ve zaman kontrollerini sağlar. Windy Point Forecast sayısal API'si bu projede yapılandırılmadı; makinece okunabilir Windy tahmini için ayrı API erişimi ve sunucu tarafında anahtar yönetimi gerekir. Gizli anahtarları `app.js` içine koyma.
- Service worker yalnızca uygulamanın aynı kaynaktaki dosyalarını önbelleğe alır. Hava verileri ve Windy haritası internet bağlantısı gerektirir.
- Üyelikteki zorunlu kutu, aydınlatma metninin okunduğunu kaydeder; açık rıza değildir. Sürüm ve zaman damgası Supabase `user_metadata` alanına yazılır ve değiştirilemez denetim kaydı sayılmaz.

### KVKK metni yayıma hazırlama

`aydinlatma.html` uygulamanın gerçek veri akışlarına göre hazırlanmış bir taslaktır. İçindeki köşeli parantezli işletmeci adı, adres ve KVKK iletişim alanları doldurulmalı; Supabase, Vercel, SMTP, Open-Meteo ve Windy için veri işleme konumu, saklama süresi ve gerekiyorsa yurt dışına aktarım mekanizması doğrulanmalıdır. Metin bu bilgiler tamamlanmadan nihai hukuki metin olarak değerlendirilmemelidir.

Bulut saklama tek JSONB satırına dayanır; aynı hesabın iki cihazda aynı anda yaptığı düzenlemelerde ayrıntılı alan bazlı birleştirme sağlamaz. Düzenli veritabanı yedeği Supabase projesinin yedekleme ayarlarından ayrıca yönetilmelidir.
