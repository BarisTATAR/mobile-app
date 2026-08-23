import { listingHasMedia } from './listingMedia';

function formatPeriod(label, hours) {
  const open = String(hours?.open || '').trim();
  const close = String(hours?.close || '').trim();
  if (!open || open.toLocaleLowerCase('tr-TR') === 'kapalı') return `${label}: Kapalı`;
  if (!close) return `${label}: ${open}`;
  return `${label}: ${open} – ${close}`;
}

export function formatListingOpeningHoursSummary(entity) {
  if (!entity?.openingHours) return '';
  const weekdays = entity.openingHours.weekdays;
  const weekend = entity.openingHours.weekend;
  const hasAny =
    (String(weekdays?.open || '').trim() && String(weekdays?.open || '').trim().toLocaleLowerCase('tr-TR') !== 'kapalı')
    || String(weekdays?.close || '').trim()
    || (String(weekend?.open || '').trim() && String(weekend?.open || '').trim().toLocaleLowerCase('tr-TR') !== 'kapalı')
    || String(weekend?.close || '').trim();
  if (!hasAny) return '';
  return `${formatPeriod('Hafta içi', weekdays)}\n${formatPeriod('Hafta sonu', weekend)}`;
}

export function formatBusinessListHoursSummary(business) {
  if (!business) return '';
  if (business.activityField === 'tekne_turu') {
    const out = String(business.limanCikisSaati || '').trim();
    const back = String(business.limanGelisSaati || '').trim();
    if (!out && !back) return '';
    if (out && back) return `Tur: ${out} çıkış, ${back} dönüş`;
    if (out) return `Tur çıkış: ${out}`;
    return `Tur dönüş: ${back}`;
  }
  return formatListingOpeningHoursSummary(business);
}

export function listingHasMenu(entity) {
  return listingHasMedia(entity);
}
