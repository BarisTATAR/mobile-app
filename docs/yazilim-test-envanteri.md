# 48 App yazılım test envanteri

Otomatik testler: `backend` için `npm test` (node:test), `mobile` için `npm test` (Jest + React Native Testing Library).
Telefon/simülatörde her dokunuşu Detox ile taramıyoruz; aşağıdaki tablo manuel duman + otomatik kapsamı gösterir.

## Kullanıcı (üye / misafir)

| Ekran | Alanlar | Butonlar | Otomatik | Manuel not |
| --- | --- | --- | --- | --- |
| Login | — | İşletme girişi, Üye girişi, Üye ol, Üye olmadan devam et | testID + navigasyon | Arka plan görseli ilk boyadan sonra |
| UserLogin | kullanıcı adı, şifre, beni hatırla | Giriş Yap, Geri Dön | boş gönderi uyarısı | Başarılı giriş Main’e gider |
| SignUp | kullanıcı adı, şifre, tekrar, ad, soyad, telefon, doğum GG/AA/YYYY, özel gün, il/ilçe/mahalle, 2 KVKK kutusu | Kayıt Ol, Geri, metni oku | slash tarih, KVKK’sız submit kapalı, şifre eşleşmezse kapalı | Kayıt Ol rızasız 400 |
| Home | — | 11 menü kartı | testID; misafir rezervasyon uyarısı | Misafir: duyuru/hava/eczane açık |
| Profile | — | rezervasyon/yöresel iptal, ara | çıkışsız metin | Üye: listeler API’den |
| Settings | — | Çıkış Yap | replace Login | AsyncStorage `appUser` silinir |
| BusinessList | il/ilçe/mahalle, kişi sayıları | Listele, harita/liste, rezervasyon, İptal | başlık; üyesiz kart uyarısı | Üyesiz rezervasyon yok; işletme tipi başına günde 2 |
| Etkinlikler | tarih, hizmet, not | tür kartları, Giriş yap / Üye ol, Talep gönder | üyesiz Talep yok; üyede hizmetsiz uyarı | Üye: 2/gün, 3/30 gün, iptaller sayılır |
| Esnaf / Çekici / Lastikçim / Taksi | il/ilçe/mahalle | Listele, Liste/Harita, ara | başlık + Listele | Harita InteractionManager sonrası |
| Duyurular / Kampanyalar | filtre | Listele | iki başlık | `mode=kampanya` |
| İş ilanları | filtre | Listele | başlık | |
| Nöbetçi Eczane | ilçe | Nöbetçi eczaneleri getir, konum | başlık + getir | Backend: teknikzeka, il=MUGLA |
| Hava Durumu | — | yenile / konum | başlık | Open-Meteo |

## İşletme / premium / yöresel

| Ekran | Alanlar | Butonlar | Otomatik | Manuel not |
| --- | --- | --- | --- | --- |
| BusinessLogin | tür, ad/telefon, şifre | Giriş Yap, Yöresel, Üye Ol, Admin, Geri | tür + boş giriş | Tür: rezervasyon/esnaf/çekici/lastikçi/taksi |
| BusinessSignUp | işletme adı, şifre, telefon, adres, menü PDF, linkler | Kayıt Ol, PDF Ekle, Geri | başlık | Admin onayı bekler |
| BusinessMain | menü medya, takvim, üye kodu | Fotoğraf/PDF, onay/red, Çıkış | başlık | Reddedilen günlük 2’ye girmez |
| YoreselBusinessLogin | kullanıcı, şifre | Giriş Yap | boş giriş | |
| YoreselBusinessMain | manuel kayıt, duyuru | Onayla/Reddet, Yeni duyuru, Çıkış | başlık | 72s onaysız takvimden düşer. `route.params` boşken `= []` her render yeni dizi üretip paneli kilitliyordu; sabit `EMPTY_VENUES` ile düzeltildi. |
| PremiumListingLogin | telefon/ad, şifre | Giriş Yap | boş giriş | |
| PremiumListingMain | panel | Çıkış | Premium Panel | |

## Admin

| Ekran | Alanlar | Butonlar | Otomatik | Manuel not |
| --- | --- | --- | --- | --- |
| AdminLogin | kullanıcı, şifre | Giriş Yap, Geri | boş giriş | |
| AdminSignUp | kullanıcı, ad, şifre | Kayıt Ol, Geri | başlık | |
| AdminMain | tür formları, foto URL | Kullanıcılar, adresler, bekleyen, lisans, Listele, Kaydet, İptal, Çıkış | panel butonları | Kayıt CRUD |
| AdminUsers | indirim alanları | Kaydet | toolbar | |
| AdminUsersByAddress | — | ← Admin, aç/kapa | toolbar | |
| BekleyenKayitlar | — | onay/red | yükleme metni | |
| LisansBitmekUzere | — | İptal / uzat | başlık | |

## Backend (node:test)

- `POST /api/register`: KVKK yok / geçersiz tarih → 400
- `POST /api/reservations`: üyesiz 401; 5 aktif 429; aynı faaliyet/gün 2 (rejected hariç) 429
- `POST /api/yoresel-etkinlik/talep`: üyesiz 401; 2/gün ve 3/30 gün (iptal dahil) 429
- Rezervasyon yardımcıları: üye zorunlu, aktivite/gün 2 (rejected hariç), eşzamanlı 5 pending+approved
- Yöresel: 2/gün (iptal dahil), 3/30 gün, 72s timeout
- Nöbetçi eczane: ilçe filtresi / foldTr
- Özel gün tarihi: GG/AA/YYYY normalize
- `server.js` testte `listen`/`connectDB` çalışmaz

## Çalıştırma

```bash
cd backend && npm test
cd ../mobile && npm test
```

`.env` commit edilmez. CI yoksa bu iki komut yerel kapı.
