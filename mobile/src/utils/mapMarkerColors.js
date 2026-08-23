export const BUSINESS_ACTIVITIES = [
  { id: 'restorant', label: 'Restoran', icon: '🍽️', color: '#E53935', shape: 'circle' },
  { id: 'cafe_bar', label: 'Cafe / Bar', icon: '☕', color: '#8E24AA', shape: 'square' },
  { id: 'plaj_beach', label: 'Plaj / Beach', icon: '🏖️', color: '#FB8C00', shape: 'pill' },
  { id: 'tekne_turu', label: 'Tekne Turu', icon: '⛵', color: '#1E88E5', shape: 'triangle' },
];

export const BUSINESS_ACTIVITY_FILTER_OPTIONS = [
  { id: '', label: 'Hepsi', icon: null },
  ...BUSINESS_ACTIVITIES,
];

export const BUSINESS_ACTIVITY_PIN_COLORS = Object.fromEntries(
  BUSINESS_ACTIVITIES.map((a) => [a.id, a.color]),
);

export const BUSINESS_ACTIVITY_LABELS = Object.fromEntries(
  BUSINESS_ACTIVITIES.map((a) => [a.id, a.label]),
);

const BUSINESS_ACTIVITY_BY_ID = Object.fromEntries(BUSINESS_ACTIVITIES.map((a) => [a.id, a]));

export function businessActivityMeta(activityId) {
  const id = String(activityId || '').trim();
  if (!id) return null;
  return BUSINESS_ACTIVITY_BY_ID[id] || {
    id,
    label: id,
    icon: '🏪',
    color: '#34C759',
    shape: 'circle',
  };
}

export function businessActivityIcon(activityId) {
  return businessActivityMeta(activityId)?.icon || null;
}

export function pinColorForBusiness(item) {
  const meta = businessActivityMeta(item?.activityField);
  return meta?.color || '#34C759';
}

export function businessActivityLabel(item) {
  const meta = businessActivityMeta(item?.activityField);
  return meta?.label || '';
}

/** Esnaf kategorileri — harita pini ve filtre çipleri için tek kaynak */
export const ESNAF_CATEGORIES = [
  { id: 'Berber / Kuaför', label: 'Berber / Kuaför', icon: '✂️', color: '#5C6BC0', shape: 'diamond' },
  { id: 'Terzi', label: 'Terzi', icon: '🧵', color: '#8E24AA', shape: 'square' },
  { id: 'Elektrikçi', label: 'Elektrikçi', icon: '⚡', color: '#F9A825', shape: 'triangle' },
  { id: 'Tesisatçı', label: 'Tesisatçı', icon: '🔩', color: '#546E7A', shape: 'pill' },
  { id: 'Boyacı', label: 'Boyacı', icon: '🎨', color: '#E53935', shape: 'square' },
  { id: 'Oto Tamir', label: 'Oto Tamir', icon: '🔧', color: '#455A64', shape: 'ring' },
  { id: 'Marangoz', label: 'Marangoz', icon: '🪚', color: '#6D4C41', shape: 'square' },
  { id: 'Sıvacı', label: 'Sıvacı', icon: '🧱', color: '#A1887F', shape: 'pill' },
  { id: 'Sıvı tesisat', label: 'Sıvı tesisat', icon: '🚿', color: '#039BE5', shape: 'pill' },
  { id: 'Alçıcı', label: 'Alçıcı', icon: '🏗️', color: '#90A4AE', shape: 'square' },
  { id: 'Telefon satış & arıza', label: 'Telefon satış & arıza', icon: '📱', color: '#3949AB', shape: 'diamond' },
  { id: 'Veteriner', label: 'Veteriner', icon: '🐾', color: '#43A047', shape: 'circle' },
  { id: 'Manav', label: 'Manav', icon: '🥬', color: '#7CB342', shape: 'square' },
  { id: 'Kaynakçı', label: 'Kaynakçı', icon: '🔥', color: '#FF5722', shape: 'triangle' },
  { id: 'Müzisyen', label: 'Müzisyen', icon: '🎵', color: '#AB47BC', shape: 'diamond' },
  { id: 'Aşçı', label: 'Aşçı', icon: '🍳', color: '#FB8C00', shape: 'circle' },
  { id: 'Kuyumcu', label: 'Kuyumcu', icon: '💎', color: '#FFB300', shape: 'diamond' },
  { id: 'Diğer', label: 'Diğer', icon: '🏪', color: '#34C759', shape: 'circle' },
];

export const ESNAF_CATEGORY_FILTER_OPTIONS = [
  { id: '', label: 'Tümü', icon: null },
  ...ESNAF_CATEGORIES,
];

const ESNAF_CATEGORY_BY_ID = Object.fromEntries(ESNAF_CATEGORIES.map((c) => [c.id, c]));

export function esnafCategoryMeta(categoryId) {
  const id = String(categoryId || '').trim();
  if (!id) return null;
  return ESNAF_CATEGORY_BY_ID[id] || {
    id,
    label: id,
    icon: '🏪',
    color: '#34C759',
    shape: 'circle',
  };
}

export function pinColorForEsnaf(item) {
  const meta = esnafCategoryMeta(item?.category);
  return meta?.color || '#34C759';
}

export function esnafCategoryLabel(item) {
  return String(item?.category || '').trim();
}

export function esnafCategoryIcon(categoryId) {
  return esnafCategoryMeta(categoryId)?.icon || null;
}

export function pinColorForListing(item) {
  return '#34C759';
}

const LISTING_TYPE_APPEARANCE = {
  cekici: { shape: 'triangle', color: '#EF6C00', icon: '🛻', label: 'Çekici' },
  taksi: { shape: 'square', color: '#F9A825', icon: '🚕', label: 'Taksi' },
  lastikci: { shape: 'ring', color: '#455A64', icon: null, label: 'Lastikçi' },
};

export function pinAppearanceForListingType(listingType) {
  const key = String(listingType || '').trim().toLowerCase();
  const base = LISTING_TYPE_APPEARANCE[key];
  if (!base) {
    return { shape: 'circle', color: pinColorForListing(), icon: null, label: 'İşletme' };
  }
  return { ...base };
}

export function pinAppearanceForEsnaf(item) {
  const cat = String(item?.category || '').trim();
  const meta = esnafCategoryMeta(cat);
  if (!meta) {
    return { shape: 'circle', color: '#34C759', icon: '🏪', label: 'Esnaf' };
  }
  return {
    shape: meta.shape,
    color: meta.color,
    icon: meta.icon,
    label: meta.label,
  };
}

export function pinAppearanceForCekici(item) {
  return pinAppearanceForListingType('cekici');
}

export function pinAppearanceForTaksi(item) {
  return pinAppearanceForListingType('taksi');
}

export function pinAppearanceForLastikci(item) {
  return pinAppearanceForListingType('lastikci');
}

export function pinAppearanceForBusiness(item) {
  const meta = businessActivityMeta(item?.activityField);
  if (!meta) {
    return { shape: 'circle', color: '#34C759', icon: '🏪', label: 'İşletme' };
  }
  return {
    shape: meta.shape,
    color: meta.color,
    icon: meta.icon,
    label: meta.label,
  };
}
