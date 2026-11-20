# Ekinvya

Ekinvya; parsel kayıtları, tarımsal hesaplar ve konuma dayalı hava tahminlerini tek ekranda sunan, mobil uyumlu statik web uygulamasıdır.

## Proje yapısı

- `index.html` — uygulamanın ana sayfası
- `aydinlatma.html` — üyelik sırasında bağlantı verilen KVKK aydınlatma metni taslağı
- `styles.css` — masaüstü ve mobil arayüz stilleri
- `app.js` — arayüz, bulut kayıtları, GPS, Open-Meteo ve Windy bağlantıları
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

## Veri, konum ve servis sınırları

- Parsel, NPK kayıtları, fiyatlar, maliyetler, senaryolar, sezon ve operasyon kayıtları giriş yapan kullanıcının Supabase satırında saklanır; tarayıcı çevrimdışı/ilk yükleme için yerel önbellek kullanır. RLS, farklı hesapların satırlarını ayırır. Bulut eşitlemesi için yukarıdaki SQL migration'ın Supabase projesine uygulanması ve uygulamanın yeni sürümünün dağıtılması gerekir.
- GPS yalnızca kullanıcı konum düğmesine bastığında istenir. Koordinatlar Open-Meteo hava tahmini isteğine ve Windy haritası bağlantısına gönderilir.
- Ana sayfa ve ayrıntılı sayısal rapor Open-Meteo verisini kullanır. Open-Meteo ücretsiz API'si ticari olmayan kullanım içindir; ürün ticari amaçla sunulacaksa uygun lisans/API planı gerekir. Veriler CC BY 4.0 atfı ile gösterilir.
- Windy gömülü haritası kendi katman ve zaman kontrollerini sağlar. Windy Point Forecast sayısal API'si bu projede yapılandırılmadı; makinece okunabilir Windy tahmini için ayrı API erişimi ve sunucu tarafında anahtar yönetimi gerekir. Gizli anahtarları `app.js` içine koyma.
- Service worker yalnızca uygulamanın aynı kaynaktaki dosyalarını önbelleğe alır. Hava verileri ve Windy haritası internet bağlantısı gerektirir.
- Üyelikteki zorunlu kutu, aydınlatma metninin okunduğunu kaydeder; açık rıza değildir. Sürüm ve zaman damgası Supabase `user_metadata` alanına yazılır ve değiştirilemez denetim kaydı sayılmaz.

### KVKK metni yayıma hazırlama

`aydinlatma.html` uygulamanın gerçek veri akışlarına göre hazırlanmış bir taslaktır. İçindeki köşeli parantezli işletmeci adı, adres ve KVKK iletişim alanları doldurulmalı; Supabase, Vercel, SMTP, Open-Meteo ve Windy için veri işleme konumu, saklama süresi ve gerekiyorsa yurt dışına aktarım mekanizması doğrulanmalıdır. Metin bu bilgiler tamamlanmadan nihai hukuki metin olarak değerlendirilmemelidir.

Bulut saklama tek JSONB satırına dayanır; aynı hesabın iki cihazda aynı anda yaptığı düzenlemelerde ayrıntılı alan bazlı birleştirme sağlamaz. Düzenli veritabanı yedeği Supabase projesinin yedekleme ayarlarından ayrıca yönetilmelidir.
