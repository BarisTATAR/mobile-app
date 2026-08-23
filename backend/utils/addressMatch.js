/**
 * İl / ilçe / mahalle filtreleri — admin (addressCity, addressDistrict…) ile
 * kullanıcı (?district=, ?neighborhood=) aynı alanlara map edilir.
 * Mahalle son ekleri (Mah., Mahallesi) ve Türkçe büyük/küçük harf toleranslı.
 */

function normalizeAddressToken(raw) {
  return String(raw ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+mah\.?\s*$/i, '')
    .replace(/\s+mahallesi\s*$/i, '')
    .replace(/\s+mh\.?\s*$/i, '')
    .trim();
}

function turkishAddressVariants(raw, { withMahalleSuffixes = false } = {}) {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const set = new Set();
  const add = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return;
    set.add(s);
    set.add(s.toLocaleLowerCase('tr-TR'));
    set.add(s.toLocaleUpperCase('tr-TR'));
    set.add(s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1).toLocaleLowerCase('tr-TR'));
  };
  add(t);
  if (withMahalleSuffixes) {
    const core = t.replace(/\s+(mah\.?|mahallesi|mh\.?)\s*$/i, '').trim();
    if (core) {
      add(core);
      add(`${core} Mah.`);
      add(`${core} Mahallesi`);
      add(`${core} Mh.`);
    }
  }
  return [...set];
}

function addressMatchesVariants(raw, variants) {
  if (!variants) return true;
  const v = String(raw ?? '').trim();
  if (!v) return false;
  if (variants.includes(v)) return true;
  const norm = normalizeAddressToken(v);
  return variants.some((x) => normalizeAddressToken(x) === norm);
}

function resolveItemAddress(item) {
  if (!item || typeof item !== 'object') {
    return { city: '', district: '', neighborhood: '' };
  }
  const direct = item.address && typeof item.address === 'object' ? item.address : {};
  const fromBusiness = item.business?.address && typeof item.business.address === 'object'
    ? item.business.address
    : {};
  const fromYoresel = item.yoreselIsletme?.address && typeof item.yoreselIsletme.address === 'object'
    ? item.yoreselIsletme.address
    : {};
  const fromPremium = item.premiumOwner?.address && typeof item.premiumOwner.address === 'object'
    ? item.premiumOwner.address
    : {};

  return {
    city: String(direct.city || fromBusiness.city || fromYoresel.city || item.city || '').trim(),
    district: String(
      direct.district || fromBusiness.district || fromYoresel.district || item.district || item.addressDistrict || '',
    ).trim(),
    neighborhood: String(
      direct.neighborhood || fromBusiness.neighborhood || fromYoresel.neighborhood
        || item.neighborhood || item.addressNeighborhood || '',
    ).trim(),
  };
}

function filterListByAddress(list, city, district, neighborhood) {
  const cv = city ? turkishAddressVariants(city) : null;
  const dv = district ? turkishAddressVariants(district) : null;
  const nv = neighborhood ? turkishAddressVariants(neighborhood, { withMahalleSuffixes: true }) : null;
  if (!cv && !dv && !nv) return list;
  return list.filter((item) => {
    const a = resolveItemAddress(item);
    if (cv && a.city && !addressMatchesVariants(a.city, cv)) return false;
    if (dv && !addressMatchesVariants(a.district, dv)) return false;
    if (nv && !addressMatchesVariants(a.neighborhood, nv)) return false;
    return true;
  });
}

/** MongoDB sorgusuna address.* ve düz city/district/neighborhood için $in varyantları ekler. */
function mergeAddressStringFilters(query, city, district, neighborhood) {
  const c = city != null ? String(city).trim() : '';
  const d = district != null ? String(district).trim() : '';
  const n = neighborhood != null ? String(neighborhood).trim() : '';
  const cv = c ? turkishAddressVariants(c) : null;
  const dv = d ? turkishAddressVariants(d) : null;
  const nv = n ? turkishAddressVariants(n, { withMahalleSuffixes: true }) : null;

  const pushAddressOr = (field, variants) => {
    if (!variants) return;
    if (!query.$and) query.$and = [];
    query.$and.push({
      $or: [
        { [`address.${field}`]: { $in: variants } },
        { [field]: { $in: variants } },
      ],
    });
  };

  if (cv) {
    if (!query.$and) query.$and = [];
    query.$and.push({
      $or: [
        { 'address.city': { $in: cv } },
        { city: { $in: cv } },
        { 'address.city': '' },
        { city: '' },
        { 'address.city': { $exists: false } },
        { city: { $exists: false } },
      ],
    });
  }
  pushAddressOr('district', dv);
  pushAddressOr('neighborhood', nv);
  return !!(cv || dv || nv);
}

module.exports = {
  normalizeAddressToken,
  turkishAddressVariants,
  addressMatchesVariants,
  resolveItemAddress,
  filterListByAddress,
  mergeAddressStringFilters,
};
