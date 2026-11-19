# Ekinvya

Ekinvya; parsel kayıtları, tarımsal hesaplar ve konuma dayalı hava tahminlerini tek ekranda sunan, mobil uyumlu statik web uygulamasıdır.

## Proje yapısı

- `index.html` — uygulamanın ana sayfası
- `styles.css` — masaüstü ve mobil arayüz stilleri
- `app.js` — arayüz, yerel kayıtlar, GPS, Open-Meteo ve Windy bağlantıları
- `auth.js` ve `supabase-config.js` — e-posta üyeliği, giriş, doğrulama, şifre sıfırlama ve oturum yönetimi
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

## Üyelik sistemini bağlama

Kayıt/giriş ekranı Supabase Auth ile hazırlanmıştır. Gerçek hesap açılıp giriş yapılabilmesi için:

1. Supabase'de bir proje oluştur ve **Authentication → Sign In / Providers** bölümünde e-posta/şifre girişini etkinleştir.
2. **Project URL** ve **publishable key** değerlerini `supabase-config.js` içindeki boş alanlara ekle. Publishable key istemci uygulamasında kullanılmak üzere tasarlanmıştır; **secret** veya `service_role` anahtarını bu dosyaya hiçbir zaman koyma.
3. **Authentication → URL Configuration** altında Site URL olarak `https://ekinvya.vercel.app` ve Redirect URLs listesine `https://ekinvya.vercel.app/**` ile `http://localhost:4173/**` ekle.
4. Üyelikte e-posta doğrulama açıksa, doğrulama ve şifre yenileme e-postaları gerekir. Supabase'in varsayılan SMTP servisi yalnızca proje ekibinde önceden yetkili e-posta adreslerine gönderir ve üretim için tasarlanmamıştır; gerçek kullanıcı kayıtları için özel SMTP ayarla.
5. `npm run check` çalıştır, sonra değişiklikleri GitHub'a gönder. Vercel deposu bağlıysa yeni dağıtım otomatik başlar.

Hesaplar Supabase Auth tarafından saklanır. Bu özellik mevcut parsel/hesap kayıtlarını kullanıcı hesabına taşımaz veya cihazlar arasında eşitlemez; bu veriler şu an tarayıcının yerel deposunda kalır. Hesap bazlı senkronizasyon için ayrıca tablolar, Row Level Security (RLS) politikaları ve veri taşıma adımı gerekir.

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

- Parsel ve hesap kayıtları bu prototipte `localStorage` içinde, kullanıcının cihazında tutulur. Hesap, veritabanı veya cihazlar arası eşitleme yoktur. Vercel'e taşımak mevcut tarayıcı kayıtlarını sunucuya kopyalamaz.
- GPS yalnızca kullanıcı konum düğmesine bastığında istenir. Koordinatlar Open-Meteo hava tahmini isteğine ve Windy haritası bağlantısına gönderilir.
- Ana sayfa ve ayrıntılı sayısal rapor Open-Meteo verisini kullanır. Open-Meteo ücretsiz API'si ticari olmayan kullanım içindir; ürün ticari amaçla sunulacaksa uygun lisans/API planı gerekir. Veriler CC BY 4.0 atfı ile gösterilir.
- Windy gömülü haritası kendi katman ve zaman kontrollerini sağlar. Windy Point Forecast sayısal API'si bu projede yapılandırılmadı; makinece okunabilir Windy tahmini için ayrı API erişimi ve sunucu tarafında anahtar yönetimi gerekir. Gizli anahtarları `app.js` içine koyma.
- Service worker yalnızca uygulamanın aynı kaynaktaki dosyalarını önbelleğe alır. Hava verileri ve Windy haritası internet bağlantısı gerektirir.

## Yayınlamadan önce

Uygulama gerçek kullanıcı verileri veya ticari hava servisi kullanacaksa önce kimlik doğrulama, güvenli sunucu/veritabanı, veri yedekleme ve API lisanslarını planla. Şu anki depo statik MVP dağıtımına hazırdır; bu ek servisler dahil değildir.
