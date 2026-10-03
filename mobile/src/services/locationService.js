/**
 * Konum ve tersine coğrafi kodlama (il/ilçe).
 * Nöbetçi eczane ve hava durumu için kullanılır.
 * expo-location yoksa uygulama çökmez; konum null döner.
 */

let Location;
try {
  Location = require('expo-location');
} catch (e) {
  Location = null;
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

function emptyLocation(extra = {}) {
  return {
    coords: null,
    permissionDenied: false,
    city: '',
    district: '',
    neighbourhood: '',
    candidates: [],
    ...extra,
  };
}

function coordsFrom(loc) {
  const latitude = Number(loc?.coords?.latitude);
  const longitude = Number(loc?.coords?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01) return null;
  return { latitude, longitude };
}

async function readCoords() {
  if (!Location) return null;
  try {
    const loc = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
    ]);
    const fresh = coordsFrom(loc);
    if (fresh) return fresh;
  } catch (e) {
    console.warn('getCurrentPosition error:', e);
  }
  try {
    const last = await Location.getLastKnownPositionAsync?.();
    return coordsFrom(last);
  } catch {
    return null;
  }
}

/**
 * Cihazın mevcut konumunu alır (izin gerekir).
 * @returns {{ latitude: number, longitude: number } | null}
 */
export async function getCurrentPosition() {
  if (!Location) return null;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    return readCoords();
  } catch (e) {
    console.warn('getCurrentPosition error:', e);
    return null;
  }
}

function uniqueParts(list) {
  const seen = new Set();
  const out = [];
  (list || []).forEach((item) => {
    const s = String(item || '').trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  return out;
}

async function reverseGeocodeNative({ latitude, longitude }) {
  if (!Location?.reverseGeocodeAsync) return null;
  try {
    const rows = await Location.reverseGeocodeAsync({ latitude, longitude });
    const row = rows && rows[0];
    if (!row) return null;
    const candidates = uniqueParts([
      row.district,
      row.subregion,
      row.city,
      row.region,
      row.name,
      row.street,
    ]);
    return {
      city: String(row.region || row.city || '').trim(),
      district: String(row.district || row.subregion || row.city || '').trim(),
      neighbourhood: String(row.name || row.street || '').trim(),
      candidates,
    };
  } catch {
    return null;
  }
}

async function reverseGeocodeNominatim({ latitude, longitude }) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=tr`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': '48App/1.0 (nobetci-eczane)' },
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      return null;
    }
    if (!res.ok || !data || typeof data.address !== 'object') return null;
    const addr = data.address;
    const candidates = uniqueParts([
      addr.county,
      addr.city_district,
      addr.municipality,
      addr.town,
      addr.city,
      addr.suburb,
      addr.village,
      addr.hamlet,
      addr.state_district,
      addr.province,
      addr.state,
      data.display_name,
    ]);
    return {
      city: String(addr.state ?? addr.city ?? addr.town ?? addr.village ?? '').trim(),
      district: String(addr.county ?? addr.city ?? addr.town ?? addr.municipality ?? addr.village ?? '').trim(),
      neighbourhood: String(addr.neighbourhood ?? addr.suburb ?? addr.village ?? addr.quarter ?? '').trim(),
      candidates,
    };
  } catch {
    return null;
  }
}

/**
 * Enlem/boylamdan il, ilçe ve mahalle adlarını döndürür (Türkiye için uyarlanmış).
 * Önce cihaz geocoder, olmazsa Nominatim.
 */
export async function reverseGeocode({ latitude, longitude }) {
  if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }
  const [native, nominatim] = await Promise.all([
    reverseGeocodeNative({ latitude, longitude }),
    reverseGeocodeNominatim({ latitude, longitude }),
  ]);
  if (!native && !nominatim) return null;
  return {
    city: (native && native.city) || (nominatim && nominatim.city) || '',
    district: (native && native.district) || (nominatim && nominatim.district) || '',
    neighbourhood: (native && native.neighbourhood) || (nominatim && nominatim.neighbourhood) || '',
    candidates: uniqueParts([
      ...((native && native.candidates) || []),
      ...((nominatim && nominatim.candidates) || []),
    ]),
  };
}

/**
 * Konum izni alır, koordinatları ve il/ilçe/mahalle bilgisini döndürür.
 */
export async function getLocationWithCityDistrict() {
  if (!Location) return emptyLocation();
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return emptyLocation({ permissionDenied: true });
  } catch {
    return emptyLocation({ permissionDenied: true });
  }
  const coords = await readCoords();
  if (!coords) return emptyLocation();
  const geo = await reverseGeocode(coords);
  return {
    coords,
    permissionDenied: false,
    city: (geo && geo.city) || '',
    district: (geo && geo.district) || '',
    neighbourhood: (geo && geo.neighbourhood) || '',
    candidates: (geo && geo.candidates) || [],
  };
}
