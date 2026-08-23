const mongoose = require('mongoose');

const memberDiscountSchema = new mongoose.Schema(
  {
    /** Kullanıcının profilde görünen benzersiz üye numarası (örn. 48X7K9M2) */
    memberId: { type: String, required: true, trim: true, uppercase: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    discountPercent: { type: Number, min: 0, max: 100, default: null },
    validUntil: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

memberDiscountSchema.index({ business: 1, memberId: 1 });

module.exports = mongoose.model('MemberDiscount', memberDiscountSchema);
