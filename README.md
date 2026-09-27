# Mobile App - React Native + Node.js

A cross-platform mobile application built with React Native (Expo) and a Node.js backend API.

## Project Structure

```
.
├── mobile/          # React Native mobile app (iOS & Android)
├── backend/         # Node.js Express API server
└── README.md
```

## Features

- ✅ Cross-platform (iOS & Android)
- ✅ React Native with Expo
- ✅ Node.js/Express backend API
- ✅ React Navigation with bottom tabs
- ✅ Modern UI with multiple screens
- ✅ API integration ready

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- For iOS: Xcode (macOS only)
- For Android: Android Studio
- Expo CLI (optional, but recommended)

## Setup Instructions

### 1. Install Dependencies

#### Mobile App
```bash
cd mobile
npm install
```

#### Backend Server
```bash
cd backend
npm install
```

### 2. Configure API URL

Edit `mobile/src/config/api.js`:
- **Emülatör:** Varsayılan ayar yeterli (iOS: localhost, Android: 10.0.2.2).
- **Fiziksel cihaz (telefon):** "Sunucuya bağlanılamadı" alıyorsanız `PHYSICAL_DEVICE_IP` değişkenine bilgisayarınızın IP adresini yazın (örn. `'192.168.1.100'`). IP öğrenmek: Mac’te System Preferences > Network veya terminalde `ifconfig | grep "inet "`.

### 3. Start the Backend Server

```bash
cd backend
npm start
# or for development with auto-reload:
npm run dev
```

The server will run on `http://localhost:3000`

**"Sunucuya bağlanılamadı" uyarısı:** 1) Backend’in çalıştığından emin olun (`cd backend && npm start`). 2) Fiziksel telefonda test ediyorsanız `mobile/src/config/api.js` içinde `PHYSICAL_DEVICE_IP`'e bilgisayarınızın IP’sini yazın; telefon ve bilgisayar aynı Wi-Fi’de olmalı.

### 4. Konum ve Nöbetçi Eczane (isteğe bağlı)

- **Konum:** Nöbetçi eczane ve hava durumu konumunuza göre çalışır. Mobilde `cd mobile && npx expo install expo-location` çalıştırın.
- **Nöbetçi eczane:** Varsayılan olarak açık kaynaktan listelenir. İsterseniz [EczaneAPI](https://eczaneapi.com) anahtarını `backend/.env` içine `ECZANE_API_KEY=eczane_api_xxxxx` olarak ekleyebilirsiniz.

### 5. Start the Mobile App

```bash
cd mobile
npm start
```

This will open Expo DevTools. You can then:
- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan QR code with Expo Go app on your physical device

## Running on Devices

### iOS
1. Install Xcode from App Store
2. Open iOS Simulator from Xcode
3. Run `npm start` in the mobile directory
4. Press `i` in the terminal

### Android
1. Install Android Studio
2. Set up an Android Virtual Device (AVD)
3. Run `npm start` in the mobile directory
4. Press `a` in the terminal

### Physical Devices
1. Install Expo Go app from App Store (iOS) or Play Store (Android)
2. Make sure your device and computer are on the same WiFi network
3. Update `API_BASE_URL` in `mobile/src/config/api.js` to your computer's IP
4. Scan the QR code from Expo DevTools

### "Could not load exp://192.168.x.x:8081" hatası
- **Aynı WiFi:** Telefon ve bilgisayar aynı kablosuz ağda olmalı.
- **Emülatör kullanın:** Terminalde `i` (iOS) veya `a` (Android) ile açın; ağ gerekmez.
- **Tünel modu:** Aynı ağ mümkün değilse: `cd mobile && npx expo start --tunnel` (internet üzerinden bağlanır).
- **Firewall:** Windows/Mac güvenlik duvarında 8081 (ve gerekirse 19000, 19001) portlarına izin verin.
- **Metro’yu yeniden başlatın:** `npx expo start --clear`

## API Endpoints

- `GET /` - API information
- `GET /api/health` - Health check
- `GET /api/data` - Get sample data
- `POST /api/data` - Create new data

## Development

### Mobile App
- Main entry: `mobile/App.js`
- Screens: `mobile/src/screens/`
- Configuration: `mobile/src/config/`

### Backend
- Server: `backend/server.js`
- Port: 3000 (configurable via `.env`)

## Next Steps

1. Add authentication (JWT, OAuth, etc.)
2. Set up a database (MongoDB, PostgreSQL, etc.)
3. Add more screens and features
4. Implement state management (Redux, Zustand, etc.)
5. Add error handling and loading states
6. Set up environment variables for different environments
7. Add testing (Jest, React Native Testing Library)

## Troubleshooting

### Proje / Backend ayağa kalkmıyor

**"EADDRINUSE: address already in use :::3000"**  
Port 3000 zaten kullanımda (eski backend hâlâ çalışıyor). Çözüm:

```bash
# Port 3000'i kullanan işlemi sonlandır (Mac/Linux)
lsof -ti:3000 | xargs kill -9
```

Ardından tekrar `cd backend && npm start`.  
Alternatif: Backend’i farklı portta çalıştırın (örn. 3001):

```bash
cd backend
npm run start:alt
```

Mobil uygulamada `mobile/src/config/api.js` içinde `API_BASE_URL`’i `http://localhost:3001` yapın.

**"Cannot find module 'bcrypt'"**  
Backend klasöründe bağımlılıkları yükleyin:

```bash
cd backend
npm install
npm start
```

**MongoDB bağlantı hatası**  
Backend yine de çalışır; sadece kullanıcı kaydı çalışmaz. Kayıt için MongoDB gerekir:
- Yerel: `brew services start mongodb-community`
- Bulut: `backend/.env` içinde `MONGODB_URI` (MongoDB Atlas connection string) ayarlayın.

### Backend not connecting
- Make sure the backend server is running
- Check the `API_BASE_URL` in `mobile/src/config/api.js`
- For physical devices, ensure both devices are on the same network

### Expo issues
- Clear cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## License

MIT


