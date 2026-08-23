const mongoose = require('mongoose');

const EVENT_TYPES = ['dugun', 'nisan', 'kina', 'sunnet', 'bekarliga_veda', 'asker_eglencesi', 'dogum_gunu'];
const TIME_SLOTS = ['gunduz', 'aksam', 'tam_gun'];
const TALEP_STATUS = ['pending', 'approved', 'rejected', 'cancelled', 'partial'];
const ISLETME_TALEP_STATUS = ['pending', 'approved', 'rejected'];

const servicesSchema = {
  muzisyen: { type: Boolean, default: false },
  asci: { type: Boolean, default: false },
  susleme: { type: Boolean, default: false },
  zurna: { type: Boolean, default: false },
  parkSalon: { type: Boolean, default: false },
  mekan: { type: Boolean, default: false },
  kuafor: { type: Boolean, default: false },
  aracKiralama: { type: Boolean, default: false },
};

const yoreselEtkinlikTalepSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    guestName: { type: String, trim: true, default: '' },
    guestPhone: { type: String, trim: true, default: '' },
    date: { type: String, required: true, trim: true },
    /** @deprecated Geriye dönük; yeni taleplerde serviceTimeSlots kullanın */
    timeSlot: { type: String, enum: TIME_SLOTS, default: 'tam_gun' },
    /** Hizmet grubu başına rezervasyon dilimi (muzisyen, asci, …) */
    serviceTimeSlots: {
      muzisyen: { type: String, default: null },
      asci: { type: String, default: null },
      susleme: { type: String, default: null },
      zurna: { type: String, default: null },
      parkSalon: { type: String, default: null },
      mekan: { type: String, default: null },
      kuafor: { type: String, default: null },
      aracKiralama: { type: String, default: null },
    },
    eventType: { type: String, required: true, enum: EVENT_TYPES },
    services: servicesSchema,
    targetIsletme: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', default: null },
    serviceTargets: {
      muzisyen: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', default: null },
      asci: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', default: null },
      susleme: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', default: null },
      zurna: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', default: null },
      parkSalon: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', default: null },
      mekan: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', default: null },
      kuafor: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', default: null },
      aracKiralama: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', default: null },
    },
    allTargetIsletmeler: [{ type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme' }],
    /** Her hedef işletme için ayrı onay; toplam status alan türetilir. */
    isletmeStatuses: [
      {
        isletme: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikIsletme', required: true },
        status: { type: String, enum: ISLETME_TALEP_STATUS, default: 'pending' },
      },
    ],
    note: { type: String, trim: true, default: '' },
    status: { type: String, enum: TALEP_STATUS, default: 'pending' },
    manualEntry: { type: Boolean, default: false },
  },
  { timestamps: true }
);

yoreselEtkinlikTalepSchema.index({ targetIsletme: 1, date: 1 });
yoreselEtkinlikTalepSchema.index({ allTargetIsletmeler: 1, date: 1 });
yoreselEtkinlikTalepSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('YoreselEtkinlikTalep', yoreselEtkinlikTalepSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
module.exports.TIME_SLOTS = TIME_SLOTS;
module.exports.SERVICE_KEYS = Object.keys(servicesSchema);
