const mongoose = require('mongoose');

const appSettingsSchema = new mongoose.Schema({
  homeImageUrl: { type: String, trim: true, default: '' },
  /** Uygulama sahibine ödenen yöresel etkinlik rezervasyon bedeli (TL). 0 = ödeme istenmez. */
  yoreselReservationFee: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('AppSettings', appSettingsSchema);
