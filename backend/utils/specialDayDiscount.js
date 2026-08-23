const SPECIAL_DAY_DISCOUNT_PERCENT = 10;

/** GG.AA.YYYY, GG/AA/YYYY veya YYYY-MM-DD formatından ay/gün çıkarır */
function parseMonthDay(dateStr) {
  const s = String(dateStr || '').trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return { month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
  }

  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    return { month: parseInt(m[2], 10), day: parseInt(m[1], 10) };
  }

  m = s.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (m) {
    return { month: parseInt(m[2], 10), day: parseInt(m[1], 10) };
  }

  return null;
}

function isTodayUsersSpecialDay(specialDay, refDate = new Date()) {
  const md = parseMonthDay(specialDay);
  if (!md || md.month < 1 || md.month > 12 || md.day < 1 || md.day > 31) return false;
  return refDate.getMonth() + 1 === md.month && refDate.getDate() === md.day;
}

function getSpecialDayDiscountMeta(validUntil = '') {
  return {
    title: 'Özel gün indirimi',
    description:
      'Kayıt sırasında belirttiğiniz yıldönümü / özel gününüzde rezervasyon işletmelerinde geçerlidir.',
    discountPercent: SPECIAL_DAY_DISCOUNT_PERCENT,
    validUntil: validUntil || '',
    source: 'special_day',
  };
}

/**
 * Üye indirimi kaydı + özel gün indirimini birleştirir.
 * Özel gününde en az %10 uygulanır; admin tanımlı indirim daha yüksekse o geçerli olur.
 */
function resolveMemberDiscountForBusiness({ user, storedDiscount, isExpired, todayStr }) {
  const specialDayActive = isTodayUsersSpecialDay(user?.specialDay);
  const storedValid = storedDiscount && !isExpired;
  const storedPct = storedValid && storedDiscount.discountPercent != null
    ? Number(storedDiscount.discountPercent)
    : null;

  if (!specialDayActive && !storedValid) {
    return { valid: false, specialDayActive: false };
  }

  if (specialDayActive && !storedValid) {
    return {
      valid: true,
      specialDayActive: true,
      discount: getSpecialDayDiscountMeta(todayStr),
    };
  }

  if (!specialDayActive && storedValid) {
    return {
      valid: true,
      specialDayActive: false,
      discount: {
        title: storedDiscount.title || '',
        description: storedDiscount.description || '',
        discountPercent: storedPct,
        validUntil: storedDiscount.validUntil || '',
        source: 'member_discount',
      },
    };
  }

  const effectivePct = Math.max(SPECIAL_DAY_DISCOUNT_PERCENT, storedPct ?? 0);
  return {
    valid: true,
    specialDayActive: true,
    discount: {
      title: effectivePct > (storedPct ?? 0) ? 'Özel gün indirimi' : (storedDiscount.title || 'Üye indirimi'),
      description:
        effectivePct > (storedPct ?? 0)
          ? getSpecialDayDiscountMeta().description
          : (storedDiscount.description || ''),
      discountPercent: effectivePct,
      validUntil: storedDiscount.validUntil || todayStr,
      source: effectivePct > (storedPct ?? 0) ? 'special_day' : 'member_discount',
    },
  };
}

module.exports = {
  SPECIAL_DAY_DISCOUNT_PERCENT,
  parseMonthDay,
  isTodayUsersSpecialDay,
  getSpecialDayDiscountMeta,
  resolveMemberDiscountForBusiness,
};
