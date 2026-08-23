# "MongoDB bağlı değil" – Hızlı kontrol

Backend çalışırken bu uyarıyı alıyorsanız aşağıdakileri sırayla kontrol edin.

## 1. `.env` dosyası var mı?

`backend` klasöründe `.env` dosyası olmalı. Yoksa `.env.example` dosyasını kopyalayıp `.env` yapın ve içindeki `MONGODB_URI` satırını düzenleyin.

## 2. MongoDB Atlas kullanıyorsanız

- **Atlas hesabı:** https://www.mongodb.com/cloud/atlas/register  
- **Connection string:** Atlas → Cluster → Connect → Drivers → connection string’i kopyalayın.
- **`.env` içinde:** `MONGODB_URI=mongodb+srv://KULLANICI:SIFRE@cluster0.xxxxx.mongodb.net/48app?retryWrites=true&w=majority`  
  - `KULLANICI` ve `SIFRE` kendi kullanıcı adı ve şifreniz.
  - Şifrede **özel karakter** varsa (örn. `@`, `#`, `.`) URL encode edin:  
    - `@` → `%40`  
    - `#` → `%23`  
    - `.` → `%2E`  
  - Örnek: şifre `Barış.48` → `Bar%C4%B1%C5%9F%2E48`
- **Network Access:** Atlas → Network Access → "Add IP Address" → "Allow Access from Anywhere" (`0.0.0.0/0`) ekleyin ki bilgisayarınızdan bağlanabilsin.
- Detay: **MONGODB_ATLAS_NASIL.md** dosyasına bakın.

## 3. Yerel MongoDB kullanıyorsanız

Bilgisayarınızda MongoDB kurulu olmalı ve çalışıyor olmalı.

- **.env:** `MONGODB_URI=mongodb://127.0.0.1:27017/48app`  
  veya `.env` dosyasında `MONGODB_URI` satırını silin (varsayılan bu adres kullanılır).
- macOS: `brew services start mongodb-community`
- Windows: MongoDB’yi servis olarak başlatın.

Kurulu değilse **MongoDB Atlas** kullanmanız daha kolay (kurulum gerekmez).

## 4. Backend’i yeniden başlatın

`.env` değiştirdikten sonra:

```bash
cd backend
npm start
```

Birkaç saniye içinde terminalde **"✅ MongoDB connected successfully"** görmelisiniz. Görmüyorsanız terminaldeki kırmızı hata mesajına göre yukarıdaki adımları tekrar kontrol edin.
