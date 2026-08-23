const mongoose = require('mongoose');

const isIlaniSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, trim: true, default: '' },
  premiumOwnerType: { type: String, trim: true, default: '' },
  premiumOwnerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  premiumOwnerGroupId: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },
  contactPhone: { type: String, trim: true, default: '' },
  contactEmail: { type: String, trim: true, default: '' },
  address: {
    city: { type: String, trim: true, default: '' },
    district: { type: String, trim: true, default: '' },
    neighborhood: { type: String, trim: true, default: '' },
  },
  active: { type: Boolean, default: true },
  imageUrl: { type: String, trim: true, default: '' },
  licenseExpiry: { type: String, trim: true, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('IsIlani', isIlaniSchema);
