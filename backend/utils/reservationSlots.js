/** Rezervasyon saat dilimleri: işletme hafta içi / hafta sonu açılış–kapanış saatlerine göre */

const SLOT_INTERVAL_MINUTES = 30;

function parseHmToMinutes(hm) {
  const s = String(hm ?? '').trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return null;
  const [hh, mm] = s.split(':').map((v) => parseInt(v, 10));
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesToHm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isWeekendDateStr(dateStr) {
  const d = new Date(String(dateStr).trim() + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}

function normalizeDateStr(raw) {
  const s = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function getOpeningHoursForDate(business, dateStr) {
  const isWeekend = isWeekendDateStr(dateStr);
  return isWeekend ? business?.openingHours?.weekend : business?.openingHours?.weekdays;
}

function isDateManuallyClosed(business, dateStr) {
  const d = normalizeDateStr(dateStr);
  if (!d) return false;
  const list = Array.isArray(business?.reservationClosedDates) ? business.reservationClosedDates : [];
  return list.some((x) => normalizeDateStr(x) === d);
}

function buildSlotsFromRange(open, close, intervalMin = SLOT_INTERVAL_MINUTES) {
  const openMin = parseHmToMinutes(open);
  const closeMin = parseHmToMinutes(close);
  if (openMin == null || closeMin == null || closeMin <= openMin) return [];
  const out = [];
  for (let t = openMin; t < closeMin; t += intervalMin) {
    out.push(minutesToHm(t));
  }
  return out;
}

function getReservationSlotsForBusiness(business, dateStr) {
  if (!business || !dateStr) return [];
  if (isDateManuallyClosed(business, dateStr)) return [];

  if (business.activityField === 'tekne_turu') {
    const slot = String(business.limanCikisSaati || '09:00').trim();
    return slot && parseHmToMinutes(slot) != null ? [slot] : [];
  }

  const hours = getOpeningHoursForDate(business, dateStr);
  const open = String(hours?.open || '').trim();
  const close = String(hours?.close || '').trim();
  if (!open || open.toLocaleLowerCase('tr-TR') === 'kapalı' || !close) return [];
  return buildSlotsFromRange(open, close);
}

function isSlotAllowedForBusiness(business, dateStr, slot) {
  const slotMin = parseHmToMinutes(slot);
  if (slotMin == null) return false;
  const allowed = getReservationSlotsForBusiness(business, dateStr);
  return allowed.includes(String(slot).trim());
}

function sanitizeClosedDatesList(dates) {
  if (!Array.isArray(dates)) return [];
  const seen = new Set();
  const out = [];
  dates.forEach((raw) => {
    const d = normalizeDateStr(raw);
    if (d && !seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  });
  return out.sort();
}

module.exports = {
  SLOT_INTERVAL_MINUTES,
  parseHmToMinutes,
  minutesToHm,
  isWeekendDateStr,
  normalizeDateStr,
  getOpeningHoursForDate,
  isDateManuallyClosed,
  buildSlotsFromRange,
  getReservationSlotsForBusiness,
  isSlotAllowedForBusiness,
  sanitizeClosedDatesList,
};
