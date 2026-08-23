/**
 * Liste API çağrıları için il/ilçe/mahalle sorgu parametreleri.
 * Admin paneli addressCity → city, addressDistrict → district ile aynı.
 * React Native'de URLSearchParams.set desteklenmediği için manuel builder kullanılır.
 */
import { DEFAULT_CITY } from '../services/turkeyAddressService';

class ListQueryParams {
  constructor() {
    this._entries = [];
  }

  set(key, value) {
    if (value == null || value === '') return this;
    this._entries.push([String(key), String(value)]);
    return this;
  }

  toString() {
    return this._entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }
}

export function buildListAddressQueryParams(district, neighborhood, options = {}) {
  const { forMap = false, city = DEFAULT_CITY } = options;
  const params = new ListQueryParams();
  const d = district != null ? String(district).trim() : '';
  const n = neighborhood != null ? String(neighborhood).trim() : '';
  if (d || n) {
    params.set('city', city || DEFAULT_CITY);
  }
  if (d) params.set('district', d);
  if (n) params.set('neighborhood', n);
  if (forMap) params.set('forMap', '1');
  return params;
}

export function formatListFilterLabel(district, neighborhood) {
  const d = district != null ? String(district).trim() : '';
  const n = neighborhood != null ? String(neighborhood).trim() : '';
  if (!d && !n) return 'Tüm ilçeler';
  if (d && n) return `${d} / ${n}`;
  return d || n;
}

export function listAddressQueryString(district, neighborhood) {
  const qs = buildListAddressQueryParams(district, neighborhood).toString();
  return qs ? `?${qs}` : '';
}
