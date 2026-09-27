/**
 * TurkiyeAPI (https://api.turkiyeapi.dev) ile il, ilçe, mahalle verisi.
 * Varsayılan il: Muğla
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TURKIYE_API = 'https://api.turkiyeapi.dev/v1';
const PROVINCES_CACHE_KEY = '@48app_provinces_v1';

export const DEFAULT_CITY = 'Muğla';

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
