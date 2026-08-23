/** Yöresel etkinlik rezervasyon dilimleri (backend ile aynı id'ler). */
export const YORESEL_TIME_SLOTS = ['gunduz', 'aksam', 'tam_gun'];

export const YORESEL_SERVICE_KEYS = [
  'muzisyen',
  'asci',
  'susleme',
  'zurna',
  'parkSalon',
  'mekan',
  'kuafor',
  'aracKiralama',
];

export function defaultYoreselServiceTimeSlots() {
  return Object.fromEntries(YORESEL_SERVICE_KEYS.map((k) => [k, 'gunduz']));
}

export const YORESEL_TIME_SLOT_OPTIONS = [
  { id: 'gunduz', label: 'Gündüz', range: '10:00 - 18:00' },
  { id: 'aksam', label: 'Akşam', range: '18:00 - 23:59' },
  { id: 'tam_gun', label: 'Tam gün', range: '10:00 - 23:59' },
];

/** Takvimde her gün için 2 çizgi: gündüz + akşam (tam_gun her iki çizgiye yansır). */
export const YORESEL_CALENDAR_BARS = [
  { id: 'gunduz', label: 'Gündüz', range: '10:00 - 18:00' },
  { id: 'aksam', label: 'Akşam', range: '18:00 - 23:59' },
];

export function yoreselTimeSlotLabel(id) {
  const opt = YORESEL_TIME_SLOT_OPTIONS.find((o) => o.id === id);
  if (!opt) return id || '—';
  return `${opt.label} (${opt.range})`;
}

export function yoreselTimeSlotsConflict(a, b) {
  const x = YORESEL_TIME_SLOTS.includes(a) ? a : 'tam_gun';
  const y = YORESEL_TIME_SLOTS.includes(b) ? b : 'tam_gun';
  if (x === 'tam_gun' || y === 'tam_gun') return true;
  return x === y;
}
