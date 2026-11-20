# Ekinvya

Ekinvya; parsel kayıtları, tarımsal hesaplar ve konuma dayalı hava tahminlerini tek ekranda sunan, mobil uyumlu statik web uygulamasıdır.

## Proje yapısı

- `index.html` — uygulamanın ana sayfası
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

Kayıt/giriş ekranı Supabase Auth ile hazırlanmıştır. Gerçek hesap açılıp giriş yapılabilmesi için:

1. Supabase'de bir proje oluştur ve **Authentication → Sign In / Providers** bölümünde e-posta/şifre girişini etkinleştir.
2. **Project URL** ve **publishable key** değerlerini `supabase-config.js` içindeki boş alanlara ekle. Publishable key istemci uygulamasında kullanılmak üzere tasarlanmıştır; **secret** veya `service_role` anahtarını bu dosyaya hiçbir zaman koyma.
3. **Authentication → URL Configuration** altında Site URL olarak `https://ekinvya.vercel.app` ve Redirect URLs listesine `https://ekinvya.vercel.app/**` ile `http://localhost:4173/**` ekle.
4. Üyelikte e-posta doğrulama açıksa, doğrulama ve şifre yenileme e-postaları gerekir. Supabase'in varsayılan SMTP servisi yalnızca proje ekibinde önceden yetkili e-posta adreslerine gönderir ve üretim için tasarlanmamıştır; gerçek kullanıcı kayıtları için özel SMTP ayarla.
5. Supabase SQL Editor'da `supabase/migrations/202611200001_ekinvya_user_data.sql` içeriğini çalıştır. Bu işlem `public.ekinvya_user_data` tablosunu ve yalnızca oturum açmış kullanıcının kendi satırına erişmesini sağlayan RLS politikalarını kurar.
6. `npm run check` çalıştır, sonra değişiklikleri GitHub'a gönder. Vercel deposu bağlıysa yeni dağıtım otomatik başlar.

Hesaplar Supabase Auth tarafından; uygulama kayıtları ise tek bir JSONB satırında hesap başına saklanır. İlk girişte o tarayıcıdaki eski kayıtlar oturum açan hesaba taşınır. Sonraki cihazlarda aynı hesapla giriş yapılınca bulut verileri indirilir. Aynı tarayıcıda farklı hesaplar kullanılırsa yerel önbellekler hesap kimliğine göre ayrılır. Uygulama, tablo kurulana kadar yerel kayıtları korur ve durum alanında bulut eşitleme sorununu gösterir.

## GitHub'a yükleme

GitHub'da boş bir depo oluşturduktan sonra proje klasöründe:

```sh
git init -b main
git add .
git commit -m "Ekinvya uygulamasını hazırla"
git remote add origin https://github.com/KULLANICI_ADI/DEPO_ADI.git
git push -u origin main
```

`ekinvya_v4_Tarla_Sezon_Islem_Karlilik.html`, yerel yedek olarak klasörde tutulur ve `.gitignore` ile depoya eklenmez. Yayınlanan sürüm, ayrıştırılmış `index.html`, `styles.css` ve `app.js` dosyalarını kullanır.

## Vercel'de yayınlama

Vercel'de **Add New → Project** ile GitHub deposunu içe aktar. Framework olarak **Other** seç; build komutu ve output directory gerekmez. `index.html` depo kökünde bulunduğu için Vercel statik dosyaları doğrudan sunar. HTTPS alan adı etkinleşince telefonda konum izni ve ana ekrana ekleme kullanılabilir.

## Veri, konum ve servis sınırları

- Parsel, NPK kayıtları, fiyatlar, maliyetler, senaryolar, sezon ve operasyon kayıtları giriş yapan kullanıcının Supabase satırında saklanır; tarayıcı çevrimdışı/ilk yükleme için yerel önbellek kullanır. RLS, farklı hesapların satırlarını ayırır. Bulut eşitlemesi için yukarıdaki SQL migration'ın Supabase projesine uygulanması ve uygulamanın yeni sürümünün dağıtılması gerekir.
- GPS yalnızca kullanıcı konum düğmesine bastığında istenir. Koordinatlar Open-Meteo hava tahmini isteğine ve Windy haritası bağlantısına gönderilir.
- Ana sayfa ve ayrıntılı sayısal rapor Open-Meteo verisini kullanır. Open-Meteo ücretsiz API'si ticari olmayan kullanım içindir; ürün ticari amaçla sunulacaksa uygun lisans/API planı gerekir. Veriler CC BY 4.0 atfı ile gösterilir.
- Windy gömülü haritası kendi katman ve zaman kontrollerini sağlar. Windy Point Forecast sayısal API'si bu projede yapılandırılmadı; makinece okunabilir Windy tahmini için ayrı API erişimi ve sunucu tarafında anahtar yönetimi gerekir. Gizli anahtarları `app.js` içine koyma.
- Service worker yalnızca uygulamanın aynı kaynaktaki dosyalarını önbelleğe alır. Hava verileri ve Windy haritası internet bağlantısı gerektirir.

Bulut saklama tek JSONB satırına dayanır; aynı hesabın iki cihazda aynı anda yaptığı düzenlemelerde ayrıntılı alan bazlı birleştirme sağlamaz. Düzenli veritabanı yedeği Supabase projesinin yedekleme ayarlarından ayrıca yönetilmelidir.

