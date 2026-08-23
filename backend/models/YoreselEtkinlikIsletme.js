const mongoose = require('mongoose');
const { listingMediaFileSchema } = require('../utils/listingMedia');

const SERVICE_TAGS = ['muzisyen', 'asci', 'susleme', 'zurna', 'park_salon', 'mekan', 'kuafor', 'arac_kiralama'];
const TIME_SLOTS = ['gunduz', 'aksam', 'tam_gun'];

const yoreselEtkinlikIsletmeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Ortak giriş adı; boşsa giriş için `name` kullanılır (tek mekan). */
    loginName: { type: String, trim: true, default: '' },
    /** Aynı şifre ve giriş adıyla birden fazla mekan kaydı */
    loginGroupId: { type: String, trim: true, default: '' },
    password: { type: String, required: true },
    phone: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    address: {
      city: { type: String, trim: true, default: '' },
      district: { type: String, trim: true, default: '' },
      neighborhood: { type: String, trim: true, default: '' },
    },
    serviceTags: {
      type: [String],
      default: [],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.every((t) => SERVICE_TAGS.includes(t));
        },
        message: 'Geçersiz hizmet etiketi',
      },
    },
    /** Sunulan rezervasyon dilimleri */
    offeredTimeSlots: {
      type: [String],
      default: () => [...TIME_SLOTS],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length > 0 && arr.every((t) => TIME_SLOTS.includes(t));
        },
        message: 'Geçersiz rezervasyon dilimi',
      },
    },
    imageUrl: { type: String, trim: true, default: '' },
    menuPdfUrl: { type: String, trim: true, default: '' },
    menuImageUrl: { type: String, trim: true, default: '' },
    mediaFiles: { type: [listingMediaFileSchema], default: [] },
    licenseExpiry: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    /** Kampanya ve iş ilanı girebilir */
    premium: { type: Boolean, default: false },
  },
  { timestamps: true }
);

yoreselEtkinlikIsletmeSchema.index({ 'address.district': 1 });
yoreselEtkinlikIsletmeSchema.index({ serviceTags: 1 });
yoreselEtkinlikIsletmeSchema.index({ loginName: 1 });
yoreselEtkinlikIsletmeSchema.index({ loginGroupId: 1 });

module.exports = mongoose.model('YoreselEtkinlikIsletme', yoreselEtkinlikIsletmeSchema);
module.exports.SERVICE_TAGS = SERVICE_TAGS;
module.exports.TIME_SLOTS = TIME_SLOTS;
