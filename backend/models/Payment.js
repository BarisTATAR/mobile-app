const mongoose = require('mongoose');

const PAYMENT_STATUS = ['pending', 'paid', 'used', 'failed', 'expired'];
const PAYMENT_PURPOSE = ['yoresel_reservation'];

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: PAYMENT_PURPOSE, default: 'yoresel_reservation', index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'TRY', trim: true },
    status: { type: String, enum: PAYMENT_STATUS, default: 'pending', index: true },
    provider: { type: String, default: 'iyzico', trim: true },
    providerToken: { type: String, trim: true, default: '' },
    providerPaymentId: { type: String, trim: true, default: '' },
    conversationId: { type: String, trim: true, default: '' },
    checkoutHtml: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    usedAt: { type: Date, default: null },
    talep: { type: mongoose.Schema.Types.ObjectId, ref: 'YoreselEtkinlikTalep', default: null },
    lastError: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, purpose: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.PAYMENT_STATUS = PAYMENT_STATUS;
module.exports.PAYMENT_PURPOSE = PAYMENT_PURPOSE;
