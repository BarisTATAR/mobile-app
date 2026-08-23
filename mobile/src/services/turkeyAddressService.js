/**
 * TurkiyeAPI (https://api.turkiyeapi.dev) ile il, ilçe, mahalle verisi.
 * Varsayılan il: Muğla
 */

const TURKIYE_API = 'https://api.turkiyeapi.dev/v1';

export const DEFAULT_CITY = 'Muğla';

/**
 * Tüm illeri getirir. Varsayılan il Muğla önce gelecek şekilde sıralanır.
 */
export async function getProvinces() {
  try {
    const res = await fetch(`${TURKIYE_API}/provinces?limit=81&fields=id,name,districts`);
    const json = await res.json();
    if (json.status !== 'OK' || !Array.isArray(json.data)) return [];
    const list = json.data.map((p) => ({ id: p.id, name: p.name, districts: p.districts || [] }));
    // Muğla'yı en başa al
    const muglaIndex = list.findIndex((p) => p.name === DEFAULT_CITY);
    if (muglaIndex > 0) {
      const [mugla] = list.splice(muglaIndex, 1);
      list.unshift(mugla);
    }
    return list;
  } catch (e) {
    console.warn('getProvinces error', e);
    return [];
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
