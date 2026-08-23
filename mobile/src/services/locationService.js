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

/**
 * Cihazın mevcut konumunu alır (izin gerekir).
 * @returns {{ latitude: number, longitude: number } | null}
 */
export async function getCurrentPosition() {
  if (!Location) return null;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000,
      distanceInterval: 100,
    });
    return loc.coords
      ? { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
      : null;
  } catch (e) {
    console.warn('getCurrentPosition error:', e);
    return null;
  }
}

/**
 * Enlem/boylamdan il, ilçe ve mahalle adlarını döndürür (Türkiye için uyarlanmış).
 * Nominatim kullanır; hata olursa sessizce null döner.
 * @param {{ latitude: number, longitude: number }}
 * @returns {{ city: string, district: string, neighbourhood: string } | null}
 */
export async function reverseGeocode({ latitude, longitude }) {
  if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=tr`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': '48App/1.0' },
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
    const city = (addr.state ?? addr.city ?? addr.town ?? addr.village ?? '').toString().trim();
    const district = (addr.county ?? addr.city ?? addr.town ?? addr.municipality ?? addr.village ?? '').toString().trim();
    const neighbourhood = (addr.neighbourhood ?? addr.suburb ?? addr.village ?? addr.quarter ?? '').toString().trim();
    return { city, district, neighbourhood };
  } catch (e) {
    return null;
  }
}

/**
 * Konum izni alır, koordinatları ve il/ilçe/mahalle bilgisini döndürür.
 * @returns {{ coords: { latitude, longitude }, city: string, district: string, neighbourhood: string } | null}
 */
export async function getLocationWithCityDistrict() {
  const coords = await getCurrentPosition();
  if (!coords) return null;
  const geo = await reverseGeocode(coords);
  return {
    coords,
    city: (geo && geo.city) || '',
    district: (geo && geo.district) || '',
    neighbourhood: (geo && geo.neighbourhood) || '',
  };
}
