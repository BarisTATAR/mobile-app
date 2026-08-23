/** Rezervasyon saat dilimleri — işletme hafta içi / hafta sonu açılış–kapanış saatlerine göre */

const SLOT_INTERVAL_MINUTES = 30;

export function parseHmToMinutes(hm) {
  const s = String(hm ?? '').trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return null;
  const [hh, mm] = s.split(':').map((v) => parseInt(v, 10));
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function minutesToHm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isWeekendDate(dateStr) {
  const d = new Date(String(dateStr || '').trim() + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}

function normalizeDateStr(raw) {
  const s = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

export function isDateManuallyClosed(business, dateStr) {
  const d = normalizeDateStr(dateStr);
  if (!d) return false;
  const list = Array.isArray(business?.reservationClosedDates) ? business.reservationClosedDates : [];
  return list.some((x) => normalizeDateStr(x) === d);
}

function getOpeningHoursForDate(business, dateStr) {
  const isWeekend = isWeekendDate(dateStr);
  return isWeekend ? business?.openingHours?.weekend : business?.openingHours?.weekdays;
}

export function buildSlotsFromRange(open, close, intervalMin = SLOT_INTERVAL_MINUTES) {
  const openMin = parseHmToMinutes(open);
  const closeMin = parseHmToMinutes(close);
  if (openMin == null || closeMin == null || closeMin <= openMin) return [];
  const out = [];
  for (let t = openMin; t < closeMin; t += intervalMin) {
    out.push(minutesToHm(t));
  }
  return out;
}

export function getReservationSlotsForDate(business, dateStr) {
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

export function formatOpeningHoursHint(business, dateStr) {
  if (!business) return '';
  if (isDateManuallyClosed(business, dateStr)) return 'Bu gün işletme rezervasyona kapalı.';
  if (business.activityField === 'tekne_turu') {
    return `Tur: ${business.limanCikisSaati || '09:00'} (çıkış)`;
  }
  const hours = getOpeningHoursForDate(business, dateStr);
  const open = String(hours?.open || '').trim();
  const close = String(hours?.close || '').trim();
  if (!open || open.toLocaleLowerCase('tr-TR') === 'kapalı' || !close) {
    return isWeekendDate(dateStr) ? 'Hafta sonu kapalı.' : 'Hafta içi kapalı.';
  }
  const label = isWeekendDate(dateStr) ? 'Hafta sonu' : 'Hafta içi';
  return `${label}: ${open} – ${close} (30 dk aralık)`;
}
