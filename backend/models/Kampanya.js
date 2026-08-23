const mongoose = require('mongoose');

const kampanyaSchema = new mongoose.Schema({
  listType: { type: String, enum: ['kampanya', 'duyuru'], default: 'kampanya' }, // kampanyalar vs duyurular listesinde ayrı gösterim
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  companyName: { type: String, trim: true, default: '' },
  contactPhone: { type: String, trim: true, default: '' },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
  premiumOwnerType: { type: String, trim: true, default: '' },
  premiumOwnerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  premiumOwnerGroupId: { type: String, trim: true, default: '' },
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

module.exports = mongoose.model('Kampanya', kampanyaSchema);
