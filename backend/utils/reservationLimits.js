const YORESEL_DAILY_RESERVATION_LIMIT = 2;
const YORESEL_PERIOD_DAYS = 30;
const YORESEL_PERIOD_RESERVATION_LIMIT = 3;
const YORESEL_DAILY_LIMIT_MESSAGE = 'Günlük Yöresel Etkinlik rezervasyon limitine ulaştınız.';
const YORESEL_PERIOD_LIMIT_MESSAGE = '30 gün içindeki Yöresel Etkinlik rezervasyon limitine ulaştınız.';

const MEMBER_REQUIRED_MESSAGE = 'Rezervasyon için üye girişi yapmalısınız';

const BUSINESS_DAILY_PER_ACTIVITY_LIMIT = 2;
const BUSINESS_ACTIVITY_LABELS = {
  restorant: 'Restoran',
  cafe_bar: 'Cafe / Bar',
  tekne_turu: 'Tekne turu',
  plaj_beach: 'Plaj / Beach',
};

const BUSINESS_ACTIVE_RESERVATION_LIMIT = 5;
const BUSINESS_ACTIVE_STATUSES = ['pending', 'approved'];
const BUSINESS_ACTIVE_LIMIT_MESSAGE =
  'Aynı anda en fazla 5 onay bekleyen veya onaylanmış rezervasyonunuz olabilir.';

function isObjectIdLike(id) {
  return /^[a-fA-F0-9]{24}$/.test(String(id || ''));
}

function getLocalDayRange(now = new Date()) {
  const d = now instanceof Date ? now : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

function yoreselMemberTalepFilter(userId, createdAt) {
  return {
    user: userId,
    manualEntry: { $ne: true },
    createdAt,
  };
}

function kvkkConsentAccepted(kvkkConsent) {
  const phone = kvkkConsent?.phoneShare === true || kvkkConsent?.phoneShare === 'true';
  const location = kvkkConsent?.location === true || kvkkConsent?.location === 'true';
  return !!(phone && location);
}

function wouldExceedLimit(count, limit) {
  return Number(count) >= Number(limit);
}

function businessActivityDailyLimitMessage(activityField) {
  const label = BUSINESS_ACTIVITY_LABELS[activityField] || 'Bu faaliyet alanı';
  return `${label} için aynı günde en fazla ${BUSINESS_DAILY_PER_ACTIVITY_LIMIT} rezervasyon yapabilirsiniz.`;
}

async function countYoreselUserReservationsToday(YoreselEtkinlikTalep, userId, now = new Date()) {
  if (!userId || !isObjectIdLike(userId)) return 0;
  const { start, end } = getLocalDayRange(now);
  return YoreselEtkinlikTalep.countDocuments(yoreselMemberTalepFilter(userId, { $gte: start, $lt: end }));
}

async function countYoreselUserReservationsLastDays(YoreselEtkinlikTalep, userId, days, now = new Date()) {
  if (!userId || !isObjectIdLike(userId)) return 0;
  const { end } = getLocalDayRange(now);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return YoreselEtkinlikTalep.countDocuments(yoreselMemberTalepFilter(userId, { $gte: start, $lt: end }));
}

async function countUserReservationsForActivityOnDate(
  models,
  userId,
  activityField,
  date,
  fallbackBusinessId = null
) {
  const { Business, Reservation } = models;
  const match = { user: userId, date, status: { $ne: 'rejected' } };
  if (activityField) {
    const businesses = await Business.find({ activityField }).select('_id').lean();
    const ids = businesses.map((b) => b._id);
    if (!ids.length) return 0;
    match.business = { $in: ids };
  } else if (fallbackBusinessId) {
    match.business = fallbackBusinessId;
  } else {
    return 0;
  }
  return Reservation.countDocuments(match);
}

async function countUserActiveReservations(Reservation, userId) {
  return Reservation.countDocuments({
    user: userId,
    status: { $in: BUSINESS_ACTIVE_STATUSES },
  });
}

async function evaluateYoreselTalepLimits(YoreselEtkinlikTalep, userId, now = new Date()) {
  const base = {
    blocked: false,
    canSubmit: true,
    code: null,
    message: '',
    dailyCount: 0,
    dailyLimit: YORESEL_DAILY_RESERVATION_LIMIT,
    dailyRemaining: YORESEL_DAILY_RESERVATION_LIMIT,
    periodDays: YORESEL_PERIOD_DAYS,
    periodCount: 0,
    periodLimit: YORESEL_PERIOD_RESERVATION_LIMIT,
    periodRemaining: YORESEL_PERIOD_RESERVATION_LIMIT,
  };
  if (!userId || !isObjectIdLike(userId)) {
    return base;
  }
  const dailyCount = await countYoreselUserReservationsToday(YoreselEtkinlikTalep, userId, now);
  const periodCount = await countYoreselUserReservationsLastDays(
    YoreselEtkinlikTalep,
    userId,
    YORESEL_PERIOD_DAYS,
    now,
  );
  const dailyBlocked = wouldExceedLimit(dailyCount, YORESEL_DAILY_RESERVATION_LIMIT);
  const periodBlocked = wouldExceedLimit(periodCount, YORESEL_PERIOD_RESERVATION_LIMIT);
  let code = null;
  let message = '';
  if (dailyBlocked) {
    code = 'DAILY_LIMIT';
    message = YORESEL_DAILY_LIMIT_MESSAGE;
  } else if (periodBlocked) {
    code = 'PERIOD_LIMIT';
    message = YORESEL_PERIOD_LIMIT_MESSAGE;
  }
  const blocked = dailyBlocked || periodBlocked;
  return {
    blocked,
    canSubmit: !blocked,
    code,
    message,
    dailyCount,
    dailyLimit: YORESEL_DAILY_RESERVATION_LIMIT,
    dailyRemaining: Math.max(0, YORESEL_DAILY_RESERVATION_LIMIT - dailyCount),
    periodDays: YORESEL_PERIOD_DAYS,
    periodCount,
    periodLimit: YORESEL_PERIOD_RESERVATION_LIMIT,
    periodRemaining: Math.max(0, YORESEL_PERIOD_RESERVATION_LIMIT - periodCount),
  };
}

module.exports = {
  YORESEL_DAILY_RESERVATION_LIMIT,
  YORESEL_PERIOD_DAYS,
  YORESEL_PERIOD_RESERVATION_LIMIT,
  YORESEL_DAILY_LIMIT_MESSAGE,
  YORESEL_PERIOD_LIMIT_MESSAGE,
  MEMBER_REQUIRED_MESSAGE,
  BUSINESS_DAILY_PER_ACTIVITY_LIMIT,
  BUSINESS_ACTIVITY_LABELS,
  BUSINESS_ACTIVE_RESERVATION_LIMIT,
  BUSINESS_ACTIVE_STATUSES,
  BUSINESS_ACTIVE_LIMIT_MESSAGE,
  isObjectIdLike,
  getLocalDayRange,
  yoreselMemberTalepFilter,
  kvkkConsentAccepted,
  wouldExceedLimit,
  businessActivityDailyLimitMessage,
  countYoreselUserReservationsToday,
  countYoreselUserReservationsLastDays,
  countUserReservationsForActivityOnDate,
  countUserActiveReservations,
  evaluateYoreselTalepLimits,
};
