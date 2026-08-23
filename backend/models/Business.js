const mongoose = require('mongoose');
const { listingMediaFileSchema } = require('../utils/listingMedia');

const ACTIVITY_FIELDS = ['restorant', 'cafe_bar', 'tekne_turu', 'plaj_beach'];

const businessSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  activityField: {
    type: String,
    required: true,
    enum: ACTIVITY_FIELDS,
  },
  googleLocation: {
    type: String,
    trim: true,
    default: '',
  },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  mapLocationSource: { type: String, trim: true, default: '' },
  openingHours: {
    weekdays: {
      open: { type: String, trim: true, default: 'Kapalı' },
      close: { type: String, trim: true, default: '' },
    },
    weekend: {
      open: { type: String, trim: true, default: 'Kapalı' },
      close: { type: String, trim: true, default: '' },
    },
  },
  address: {
    city: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    neighborhood: { type: String, required: true, trim: true },
  },
  menuPdfUrl: { type: String, trim: true, default: '' },
  menuImageUrl: { type: String, trim: true, default: '' },
  mediaFiles: { type: [listingMediaFileSchema], default: [] },
  googleReviewLink: { type: String, trim: true, default: '' },
  website: { type: String, trim: true, default: '' },
  instagram: { type: String, trim: true, default: '' },
  hasChargingStation: { type: Boolean, default: false },
  hasFreeParking: { type: Boolean, default: false },
  hasFreeValet: { type: Boolean, default: false },
  hasPaidParking: { type: Boolean, default: false },
  hasPaidValet: { type: Boolean, default: false },
  imageUrl: { type: String, trim: true, default: '' },
  licenseExpiry: { type: String, trim: true, default: '' },
  approved: { type: Boolean, default: false }, // false = uygulama üzerinden kayıt, admin onayı bekliyor
  limanCikisSaati: { type: String, trim: true, default: '' }, // tekne turu: liman çıkış saati (HH:mm)
  limanGelisSaati: { type: String, trim: true, default: '' }, // tekne turu: liman geliş saati (HH:mm)
  /** YYYY-MM-DD — işletmenin takvimden kapattığı rezervasyon günleri */
  reservationClosedDates: { type: [String], default: [] },
  /** Kampanya ve iş ilanı girebilir */
  premium: { type: Boolean, default: false },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Business', businessSchema);
