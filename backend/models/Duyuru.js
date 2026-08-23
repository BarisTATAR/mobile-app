const mongoose = require('mongoose');

const duyuruSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
  /** Eski kayıtlar: belirli mekâna bağlı duyuru */
  yoreselIsletme: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', default: null },
  /** Yöresel işletme grubu / giriş hesabı (mekân adına değil, ortak hesaba bağlı) */
  yoreselLoginGroupId: { type: String, trim: true, default: '' },
  yoreselLoginName: { type: String, trim: true, default: '' },
  yoreselPhone: { type: String, trim: true, default: '' },
  address: {
    city: { type: String, trim: true, default: '' },
    district: { type: String, trim: true, default: '' },
    neighborhood: { type: String, trim: true, default: '' },
  },
  startDate: { type: String, trim: true, default: '' },
  endDate: { type: String, trim: true, default: '' },
  discountText: { type: String, trim: true, default: '' },
  active: { type: Boolean, default: true },
  imageUrl: { type: String, trim: true, default: '' },
  licenseExpiry: { type: String, trim: true, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Duyuru', duyuruSchema);
