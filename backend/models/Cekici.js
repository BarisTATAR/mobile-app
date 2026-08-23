const mongoose = require('mongoose');
const { listingMediaFileSchema } = require('../utils/listingMedia');

const cekiciSchema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  address: {
    city: { type: String, trim: true, default: '' },
    district: { type: String, trim: true, default: '' },
    neighborhood: { type: String, trim: true, default: '' },
  },
  notes: { type: String, trim: true, default: '' },
  imageUrl: { type: String, trim: true, default: '' },
  licenseExpiry: { type: String, trim: true, default: '' },
  googleLocation: { type: String, trim: true, default: '' },
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
  menuPdfUrl: { type: String, trim: true, default: '' },
  menuImageUrl: { type: String, trim: true, default: '' },
  mediaFiles: { type: [listingMediaFileSchema], default: [] },
  premium: { type: Boolean, default: false },
  password: { type: String, trim: true, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Cekici', cekiciSchema);
