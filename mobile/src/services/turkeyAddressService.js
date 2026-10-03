/**
 * TurkiyeAPI (https://api.turkiyeapi.dev) ile il, ilçe, mahalle verisi.
 * Varsayılan il: Muğla
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TURKIYE_API = 'https://api.turkiyeapi.dev/v1';
const PROVINCES_CACHE_KEY = '@48app_provinces_v1';

export const DEFAULT_CITY = 'Muğla';

export const MUGLA_DISTRICT_NAMES = [
  'Bodrum',
  'Dalaman',
  'Datça',
  'Fethiye',
  'Kavaklıdere',
  'Köyceğiz',
  'Marmaris',
  'Menteşe',
  'Milas',
  'Ortaca',
  'Seydikemer',
  'Ula',
  'Yatağan',
];

function foldDistrictName(value) {
  return String(value || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

const PLACE_TO_DISTRICT = {
  oludeniz: 'Fethiye',
  hisaronu: 'Fethiye',
  calis: 'Fethiye',
  kayakoy: 'Fethiye',
  gocek: 'Fethiye',
  karaculha: 'Fethiye',
  sebnem: 'Fethiye',
  yalikavak: 'Bodrum',
  turgutreis: 'Bodrum',
  gumbet: 'Bodrum',
  bitez: 'Bodrum',
  torba: 'Bodrum',
  golkoy: 'Bodrum',
  mumcular: 'Bodrum',
  turkbuku: 'Bodrum',
  golturkbuku: 'Bodrum',
  guvercinlik: 'Bodrum',
  ortakent: 'Bodrum',
  yaliciftlik: 'Bodrum',
  gundogan: 'Bodrum',
  akyarlar: 'Bodrum',
  dalyan: 'Ortaca',
  sarigerme: 'Ortaca',
  akyaka: 'Ula',
  gokova: 'Ula',
  icmeler: 'Marmaris',
  turunc: 'Marmaris',
  selimiye: 'Marmaris',
  bozburun: 'Marmaris',
  armotan: 'Marmaris',
  bafa: 'Milas',
  gulluk: 'Milas',
  oren: 'Milas',
  mesudiye: 'Datça',
};

const MUGLA_DISTRICT_CENTERS = [
  { name: 'Bodrum', latitude: 37.034, longitude: 27.430 },
  { name: 'Dalaman', latitude: 36.767, longitude: 28.803 },
  { name: 'Datça', latitude: 36.728, longitude: 27.686 },
  { name: 'Fethiye', latitude: 36.660, longitude: 29.126 },
  { name: 'Kavaklıdere', latitude: 37.445, longitude: 28.363 },
  { name: 'Köyceğiz', latitude: 36.961, longitude: 28.686 },
  { name: 'Marmaris', latitude: 36.855, longitude: 28.274 },
  { name: 'Menteşe', latitude: 37.215, longitude: 28.364 },
  { name: 'Milas', latitude: 37.316, longitude: 27.784 },
  { name: 'Ortaca', latitude: 36.839, longitude: 28.765 },
  { name: 'Seydikemer', latitude: 36.643, longitude: 29.350 },
  { name: 'Ula', latitude: 37.104, longitude: 28.417 },
  { name: 'Yatağan', latitude: 37.342, longitude: 28.140 },
];

function normalizePlaceName(value) {
  return foldDistrictName(value)
    .replace(/\b(ilcesi|ilce|district|province|belediyesi|belediye|mahallesi|mahalesi|mah|koyu|koy)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Konum veya kayıt adresinden Muğla ilçesi yakala. */
export function matchMuglaDistrict(raw) {
  const folded = normalizePlaceName(raw);
  if (!folded || folded === 'mugla') return '';
  if (folded === 'merkez' || folded === 'mugla merkez') return 'Menteşe';
  if (PLACE_TO_DISTRICT[folded]) return PLACE_TO_DISTRICT[folded];
  const exact = MUGLA_DISTRICT_NAMES.find((name) => foldDistrictName(name) === folded);
  if (exact) return exact;
  const aliasHit = Object.keys(PLACE_TO_DISTRICT).find((key) => folded.includes(key));
  if (aliasHit) return PLACE_TO_DISTRICT[aliasHit];
  return MUGLA_DISTRICT_NAMES.find((name) => {
    const d = foldDistrictName(name);
    if (d.length >= 4 && folded.includes(d)) return true;
    if (folded.length >= 4 && d.includes(folded)) return true;
    return false;
  }) || '';
}

export function matchMuglaDistrictFromFields(fields) {
  const parts = Array.isArray(fields) ? fields : [fields];
  for (const part of parts) {
    const matched = matchMuglaDistrict(part);
    if (matched) return matched;
  }
  return '';
}

export function isLikelyMuglaCoords(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= 36.15
    && latitude <= 37.55
    && longitude >= 27.05
    && longitude <= 29.85;
}

function haversineKm(aLat, aLon, bLat, bLon) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function nearestPharmacyDistrict(list, coords) {
  const lat = Number(coords?.latitude);
  const lon = Number(coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Array.isArray(list)) return '';
  let best = null;
  let bestKm = Infinity;
  list.forEach((item) => {
    const pLat = Number(item?.location?.latitude);
    const pLon = Number(item?.location?.longitude);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return;
    const km = haversineKm(lat, lon, pLat, pLon);
    if (km < bestKm) {
      bestKm = km;
      best = item;
    }
  });
  if (!best) return '';
  const inMugla = isLikelyMuglaCoords(lat, lon);
  if (!inMugla && bestKm > 80) return '';
  if (inMugla && bestKm > 200) return '';
  return matchMuglaDistrict(best.district) || String(best.district || '').trim();
}

export function nearestDistrictByCoords(coords) {
  const lat = Number(coords?.latitude);
  const lon = Number(coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  let best = '';
  let bestKm = Infinity;
  MUGLA_DISTRICT_CENTERS.forEach((center) => {
    const km = haversineKm(lat, lon, center.latitude, center.longitude);
    if (km < bestKm) {
      bestKm = km;
      best = center.name;
    }
  });
  if (!best) return '';
  if (isLikelyMuglaCoords(lat, lon) && bestKm <= 90) return best;
  if (bestKm <= 35) return best;
  return '';
}

export function resolveMuglaDistrict({ coords, fields, pharmacies } = {}) {
  const fromFields = matchMuglaDistrictFromFields(fields);
  if (fromFields) return fromFields;
  const fromCentroid = nearestDistrictByCoords(coords);
  if (fromCentroid) return fromCentroid;
  return nearestPharmacyDistrict(pharmacies, coords);
}

export const TURKEY_PROVINCES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
  'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik',
  'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum',
  'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
  'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
  'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale',
  'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa',
  'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize',
  'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak', 'Tekirdağ',
  'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

const PROVINCE_ALIASES = {
  istanbul: 'İstanbul',
  izmir: 'İzmir',
  afyon: 'Afyonkarahisar',
  afyonkarahisar: 'Afyonkarahisar',
  icel: 'Mersin',
  mersin: 'Mersin',
  maras: 'Kahramanmaraş',
  kahramanmaras: 'Kahramanmaraş',
  urfa: 'Şanlıurfa',
  sanliurfa: 'Şanlıurfa',
  mugla: 'Muğla',
  ankara: 'Ankara',
  antalya: 'Antalya',
  bursa: 'Bursa',
  kocaeli: 'Kocaeli',
};

export function expandLocationFields(fields) {
  const out = [];
  (Array.isArray(fields) ? fields : [fields]).forEach((item) => {
    String(item || '').split(/[,|/]/).forEach((part) => {
      const s = String(part || '').trim();
      if (s) out.push(s);
    });
  });
  return out;
}

export function matchProvince(raw) {
  const folded = normalizePlaceName(raw).replace(/\b(ili|il)\b/g, '').trim();
  if (!folded) return '';
  if (PROVINCE_ALIASES[folded]) return PROVINCE_ALIASES[folded];
  const exact = TURKEY_PROVINCES.find((name) => foldDistrictName(name) === folded);
  if (exact) return exact;
  return TURKEY_PROVINCES.find((name) => {
    const d = foldDistrictName(name);
    return d.length >= 5 && folded.includes(d);
  }) || '';
}

export function matchProvinceFromFields(fields) {
  for (const part of expandLocationFields(fields)) {
    const matched = matchProvince(part);
    if (matched) return matched;
  }
  return '';
}

export function matchDistrictForProvince(raw, provinceName, provinces) {
  const folded = normalizePlaceName(raw);
  if (!folded || folded === foldDistrictName(provinceName)) return '';
  if (foldDistrictName(provinceName) === 'mugla') return matchMuglaDistrict(raw);
  const districts = getDistrictsForProvince(provinces || [], provinceName);
  const exact = districts.find((item) => foldDistrictName(item.name) === folded);
  if (exact) return exact.name;
  const contains = districts.find((item) => {
    const d = foldDistrictName(item.name);
    return d.length >= 4 && folded.includes(d);
  });
  if (contains) return contains.name;
  return String(raw || '').trim();
}

export function resolveLocationPlace({ coords, fields, pharmacies, provinces } = {}) {
  const parts = expandLocationFields(fields);
  if (isLikelyMuglaCoords(coords?.latitude, coords?.longitude)) {
    return {
      city: DEFAULT_CITY,
      district: resolveMuglaDistrict({ coords, fields: parts, pharmacies }),
    };
  }
  const city = matchProvinceFromFields(parts);
  if (!city) return { city: '', district: '' };
  if (foldDistrictName(city) === 'mugla') {
    return {
      city: DEFAULT_CITY,
      district: resolveMuglaDistrict({ coords, fields: parts, pharmacies }),
    };
  }
  let district = '';
  for (const part of parts) {
    if (matchProvince(part) === city) continue;
    const found = matchDistrictForProvince(part, city, provinces);
    if (found) {
      district = found;
      break;
    }
  }
  return { city, district };
}

export function filterPharmaciesByDistrict(list, districtName) {
  const rows = Array.isArray(list) ? list : [];
  const wantedName = matchMuglaDistrict(districtName) || String(districtName || '').trim();
  if (!wantedName) return rows;
  const wanted = foldDistrictName(wantedName);
  const aliases = new Set([wanted]);
  if (wanted === 'mentese') {
    aliases.add('merkez');
    aliases.add('mugla merkez');
  }
  return rows.filter((p) => aliases.has(foldDistrictName(p?.district)));
}

let provincesMemory = null;
let provincesInflight = null;

function sortMuglaFirst(list) {
  const muglaIndex = list.findIndex((p) => p.name === DEFAULT_CITY);
  if (muglaIndex > 0) {
    const [mugla] = list.splice(muglaIndex, 1);
    list.unshift(mugla);
  }
  return list;
}

async function fetchProvincesFromNetwork() {
  const res = await fetch(`${TURKIYE_API}/provinces?limit=81&fields=id,name,districts`);
  const json = await res.json();
  if (json.status !== 'OK' || !Array.isArray(json.data)) return [];
  return sortMuglaFirst(json.data.map((p) => ({ id: p.id, name: p.name, districts: p.districts || [] })));
}

export async function prefetchProvinces() {
  try {
    const list = await fetchProvincesFromNetwork();
    if (list.length) {
      provincesMemory = list;
      await AsyncStorage.setItem(PROVINCES_CACHE_KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return provincesMemory || [];
  }
}

/**
 * Tüm illeri getirir. Varsayılan il Muğla önce gelecek şekilde sıralanır.
 * Önce bellek/önbellek, ağ isteği arka planda.
 */
export async function getProvinces() {
  if (provincesMemory?.length) return provincesMemory;
  if (provincesInflight) return provincesInflight;

  provincesInflight = (async () => {
    try {
      const cached = await AsyncStorage.getItem(PROVINCES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) {
          provincesMemory = parsed;
          prefetchProvinces();
          return parsed;
        }
      }
    } catch {
      // önbellek yok
    }
    try {
      const list = await fetchProvincesFromNetwork();
      provincesMemory = list;
      if (list.length) {
        AsyncStorage.setItem(PROVINCES_CACHE_KEY, JSON.stringify(list)).catch(() => {});
      }
      return list;
    } catch (e) {
      console.warn('getProvinces error', e);
      return [];
    }
  })();

  try {
    return await provincesInflight;
  } finally {
    provincesInflight = null;
  }
}

/**
 * Seçilen ile ait ilçeleri döndürür. provinces listesinden alınabilir.
 */
export function getDistrictsForProvince(provinces, provinceName) {
  if (!provinces || !provinceName) return [];
  const province = provinces.find((p) => p.name === provinceName);
  if (!province || !Array.isArray(province.districts)) return [];
  return province.districts.map((d) => ({ id: d.id, name: d.name }));
}

/**
 * Seçilen il ve ilçeye ait mahalleleri getirir.
 */
export async function getNeighborhoods(provinceName, districtName) {
  if (!provinceName || !districtName) return [];
  try {
    const params = new URLSearchParams({
      province: provinceName,
      district: districtName,
      limit: '500',
    });
    const res = await fetch(`${TURKIYE_API}/neighborhoods?${params}`);
    const json = await res.json();
    if (json.status !== 'OK' || !Array.isArray(json.data)) return [];
    return json.data.map((n) => ({ id: n.id, name: n.name }));
  } catch (e) {
    console.warn('getNeighborhoods error', e);
    return [];
  }
}
