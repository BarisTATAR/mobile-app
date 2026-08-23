const DEFAULT_OPENING_HOURS = {
  weekdays: { open: 'Kapalı', close: '' },
  weekend: { open: 'Kapalı', close: '' },
};

function normalizeOpeningHoursBlock(block) {
  return {
    open: String(block?.open || 'Kapalı').trim() || 'Kapalı',
    close: String(block?.close || '').trim(),
  };
}

function openingHoursFromBody(body) {
  if (!body || typeof body !== 'object') return { ...DEFAULT_OPENING_HOURS };
  if (body.openingHours && typeof body.openingHours === 'object') {
    return {
      weekdays: normalizeOpeningHoursBlock(body.openingHours.weekdays),
      weekend: normalizeOpeningHoursBlock(body.openingHours.weekend),
    };
  }
  if (
    body.weekdaysOpen !== undefined
    || body.weekdaysClose !== undefined
    || body.weekendOpen !== undefined
    || body.weekendClose !== undefined
  ) {
    return {
      weekdays: {
        open: String(body.weekdaysOpen || 'Kapalı').trim() || 'Kapalı',
        close: String(body.weekdaysClose || '').trim(),
      },
      weekend: {
        open: String(body.weekendOpen || 'Kapalı').trim() || 'Kapalı',
        close: String(body.weekendClose || '').trim(),
      },
    };
  }
  return { ...DEFAULT_OPENING_HOURS };
}

function stripOpeningHourFlatFields(set) {
  delete set.weekdaysOpen;
  delete set.weekdaysClose;
  delete set.weekendOpen;
  delete set.weekendClose;
}

const { applyMediaFilesToSet } = require('./listingMedia');

function applyOpeningHoursAndMenuToSet(set, body) {
  if (!set || typeof set !== 'object') return;
  const hasOpeningInput =
    (body.openingHours && typeof body.openingHours === 'object')
    || body.weekdaysOpen !== undefined
    || body.weekdaysClose !== undefined
    || body.weekendOpen !== undefined
    || body.weekendClose !== undefined;
  if (hasOpeningInput) {
    set.openingHours = openingHoursFromBody(body);
  }
  stripOpeningHourFlatFields(set);
  if (body.menuPdfUrl !== undefined) set.menuPdfUrl = String(body.menuPdfUrl || '').trim();
  if (body.menuImageUrl !== undefined) set.menuImageUrl = String(body.menuImageUrl || '').trim();
  applyMediaFilesToSet(set, body);
}

module.exports = {
  DEFAULT_OPENING_HOURS,
  openingHoursFromBody,
  stripOpeningHourFlatFields,
  applyOpeningHoursAndMenuToSet,
};
