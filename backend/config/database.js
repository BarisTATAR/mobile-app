const mongoose = require('mongoose');

const defaultURI = 'mongodb://127.0.0.1:27017/48app';
const maxRetries = 3;
const retryDelayMs = 3000;

const connectDB = async (retryCount = 0) => {
  try {
    const mongoURI = process.env.MONGODB_URI || defaultURI;
    const isAtlas = mongoURI.includes('mongodb.net');
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: isAtlas ? 25000 : 5000,
      connectTimeoutMS: isAtlas ? 25000 : 10000,
    });
    console.log('✅ MongoDB connected successfully');
    if (typeof process.stdout.write === 'function') process.stdout.write(''); // flush
  } catch (error) {
    if (retryCount < maxRetries) {
      console.error(`❌ MongoDB bağlantı hatası (deneme ${retryCount + 1}/${maxRetries}), ${retryDelayMs / 1000}s sonra tekrar...`);
      console.error('   Hata:', error.message);
      setTimeout(() => connectDB(retryCount + 1), retryDelayMs);
    } else {
      console.error('⚠️  MongoDB bağlı değil. API çalışıyor ama kayıt/giriş çalışmaz.');
      console.error('   Hata:', error.message);
      if (error.message && error.message.includes('ECONNREFUSED')) {
        console.error('   → Yerel MongoDB çalışmıyor. Çözüm: MongoDB Atlas kullanın.');
        console.error('   → backend/MONGODB_ATLAS_NASIL.md dosyasına bakın.');
      }
      if (error.message && (error.message.includes('auth') || error.message.includes('Authentication'))) {
        console.error('   → Atlas kullanıcı/şifre hatalı. .env içinde MONGODB_URI\'deki şifreyi URL encode edin (örn. @ → %40).');
      }
      if (error.message && (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo'))) {
        console.error('   → İnternet veya Atlas adresi erişilemiyor. Atlas Network Access\'te IP izni verin (0.0.0.0/0 deneyin).');
      }
      if (error.message && error.message.includes('whitelist')) {
        console.error('   → Atlas Network Access: https://cloud.mongodb.com → Network Access → Add IP Address → 0.0.0.0/0');
        console.error('   → Detay: backend/MONGODB_ATLAS_NASIL.md');
      }
    }
  }
};

module.exports = connectDB;

