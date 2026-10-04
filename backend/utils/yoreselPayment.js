const YORESEL_PAYMENT_PURPOSE = 'yoresel_reservation';
const PAYMENT_REQUIRED_MESSAGE = 'Yöresel etkinlik talebi göndermek için rezervasyon bedelini kart ile ödemelisiniz.';
const PAYMENT_NOT_CONFIGURED_MESSAGE =
  'Kart ödemesi henüz bağlanmadı. iyzico anahtarlarını sunucuya ekledikten sonra ödeme alınır.';

function normalizeYoreselReservationFee(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

function parseYoreselReservationFeeInput(raw) {
  if (raw == null || String(raw).trim() === '') return 0;
  const normalized = String(raw).trim().replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error('Geçersiz rezervasyon bedeli');
    err.status = 400;
    throw err;
  }
  return Math.round(n * 100) / 100;
}

function formatFeeTry(amount) {
  const n = normalizeYoreselReservationFee(amount);
  if (n === 0) return '0 TL';
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
  return `${formatted} TL`;
}

async function getYoreselReservationFee(AppSettings) {
  try {
    const query = AppSettings.findOne();
    const doc = query && typeof query.lean === 'function' ? await query.lean() : await query;
    return normalizeYoreselReservationFee(doc && doc.yoreselReservationFee);
  } catch {
    return 0;
  }
}

async function findPaidYoreselCredit(Payment, userId) {
  if (!userId) return null;
  const query = Payment.findOne({
    user: userId,
    purpose: YORESEL_PAYMENT_PURPOSE,
    status: 'paid',
  }).sort({ paidAt: 1, createdAt: 1 });
  return query && typeof query.lean === 'function' ? query.lean() : query;
}

async function consumePaidYoreselCredit(Payment, userId, talepId) {
  return Payment.findOneAndUpdate(
    {
      user: userId,
      purpose: YORESEL_PAYMENT_PURPOSE,
      status: 'paid',
    },
    {
      $set: {
        status: 'used',
        usedAt: new Date(),
        talep: talepId,
      },
    },
    { sort: { paidAt: 1, createdAt: 1 }, new: true }
  );
}

function serializeAppSettings(doc, paymentConfigured) {
  return {
    homeImageUrl: doc && doc.homeImageUrl ? String(doc.homeImageUrl) : '',
    yoreselReservationFee: normalizeYoreselReservationFee(doc && doc.yoreselReservationFee),
    yoreselPaymentConfigured: !!paymentConfigured,
  };
}

module.exports = {
  YORESEL_PAYMENT_PURPOSE,
  PAYMENT_REQUIRED_MESSAGE,
  PAYMENT_NOT_CONFIGURED_MESSAGE,
  normalizeYoreselReservationFee,
  parseYoreselReservationFeeInput,
  formatFeeTry,
  getYoreselReservationFee,
  findPaidYoreselCredit,
  consumePaidYoreselCredit,
  serializeAppSettings,
};
