# "Veritabanı bağlantısı yok" / "IP isn't whitelisted" – MongoDB Atlas

Bilgisayarınızda MongoDB kurulu değilse **ücretsiz MongoDB Atlas** kullanın.

---

## ⚠️ "IP that isn't whitelisted" hatası (en sık neden)

Atlas, sadece **izin verdiğiniz IP adreslerinden** bağlantı kabul eder. Bu ayarı eklemeden bağlanamazsınız.

### Yapmanız gerekenler

1. Tarayıcıda **https://cloud.mongodb.com** adresine gidin ve giriş yapın.
2. Sol menüden **Network Access** (veya **Security** → **Network Access**) seçin.
3. **Add IP Address** butonuna tıklayın.
4. İki seçenekten birini kullanın:
   - **Add Current IP Address** — Sadece şu anki bilgisayarınızın IP’si eklenir (IP değişirse tekrar eklemeniz gerekir).
   - **Allow Access from Anywhere** — Adres olarak **`0.0.0.0/0`** yazın; tüm IP’lere izin verir (geliştirme için uygun).
5. **Confirm** ile kaydedin. Birkaç dakika bekleyin.
6. Backend’i yeniden başlatın: `cd backend && npm start`.

Bu adımlardan sonra **✅ MongoDB connected successfully** mesajını görmelisiniz.

---

## 1. Atlas hesabı ve cluster

1. Tarayıcıda açın: **https://www.mongodb.com/cloud/atlas/register**
2. Ücretsiz hesap oluşturun (e-posta / Google ile giriş).
3. **Build a Database** → **Free** (M0) seçin → **Create**.
4. **Username** ve **Password** belirleyin (bu bilgileri bir yere not edin).
5. **Create Database User** → **Finish and Close**.
6. **Where would you like to connect from?** → **My Local Environment** (veya **Cloud**), **Add My Current IP Address** → **Finish and Close**.

## 2. Bağlantı linkini kopyalama

1. Cluster’ınızın yanındaki **Connect** butonuna tıklayın.
2. **Drivers** (veya **Connect your application**) seçin.
3. **Connection string** kopyalayın; örnek:
   ```text
   mongodb+srv://KULLANICI:SIFRE@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Bu linkte **`KULLANICI`** ve **`SIFRE`** kısımlarını kendi kullanıcı adı ve şifrenizle değiştirin. Özel karakter varsa şifreyi URL encode edin (örn. `@` → `%40`).
5. Veritabanı adı ekleyin: `?` öncesine `/48app` ekleyin:
   ```text
   mongodb+srv://KULLANICI:SIFRE@cluster0.xxxxx.mongodb.net/48app?retryWrites=true&w=majority
   ```

## 3. Backend `.env` dosyası

1. Projede **`backend`** klasörünü açın.
2. **`.env`** dosyasını açın (yoksa oluşturun).
3. Şu satırı ekleyin veya güncelleyin (kendi linkinizi yapıştırın):

```env
PORT=3000
NODE_ENV=development

MONGODB_URI=mongodb+srv://KULLANICI:SIFRE@cluster0.xxxxx.mongodb.net/48app?retryWrites=true&w=majority
```

`KULLANICI`, `SIFRE` ve `cluster0.xxxxx.mongodb.net` kısımlarını kendi Atlas bilgilerinizle değiştirin.

## 4. Backend’i yeniden başlatma

Terminalde:

```bash
cd backend
npm start
```

Başarılı bağlantıda şunu görmelisiniz:

```text
✅ MongoDB connected successfully
```

Bundan sonra kayıt (kullanıcı / işletme / admin) çalışır ve "veritabanı bağlantısı yok" hatası kaybolur.

---

**Hata alırsanız**

- **Authentication failed:** `.env` içindeki kullanıcı adı ve şifreyi kontrol edin; şifrede `@`, `#` vb. varsa URL encode edin.
- **Network timeout:** İnternet bağlantınızı kontrol edin; Atlas’ta **Network Access** bölümünde IP’nizin eklendiğinden emin olun (gerekirse **Allow Access from Anywhere** `0.0.0.0/0` ile deneyebilirsiniz).
