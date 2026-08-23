const MUGLA_DISTRICT_COORDS = {
  bodrum: { latitude: 37.0344, longitude: 27.4305 },
  dalaman: { latitude: 36.7659, longitude: 28.802 },
  datca: { latitude: 36.725, longitude: 27.684 },
  datça: { latitude: 36.725, longitude: 27.684 },
  fethiye: { latitude: 36.621, longitude: 29.116 },
  kavaklidere: { latitude: 37.445, longitude: 28.362 },
  kavaklıdere: { latitude: 37.445, longitude: 28.362 },
  koycegiz: { latitude: 36.959, longitude: 28.683 },
  köyceğiz: { latitude: 36.959, longitude: 28.683 },
  marmaris: { latitude: 36.855, longitude: 28.274 },
  mentese: { latitude: 37.2153, longitude: 28.3636 },
  menteşe: { latitude: 37.2153, longitude: 28.3636 },
  milas: { latitude: 37.316, longitude: 27.783 },
  ortaca: { latitude: 36.839, longitude: 28.767 },
  seydikemer: { latitude: 36.648, longitude: 29.359 },
  ula: { latitude: 37.104, longitude: 28.417 },
  yatagan: { latitude: 37.341, longitude: 28.142 },
  yatağan: { latitude: 37.341, longitude: 28.142 },
  mugla: { latitude: 37.2153, longitude: 28.3636 },
  muğla: { latitude: 37.2153, longitude: 28.3636 },
};

const DEFAULT_MUGLA = { latitude: 37.2153, longitude: 28.3636 };

function normalizeDistrictKey(s) {
  return String(s ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function hashIndex(seed, mod) {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) % 9973;
  }
  return Math.abs(h) % mod;
}

export function parseMapCoord(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coordsFromGoogleLocation(url) {
  const s = String(url ?? '').trim();
  if (!s) return null;
  let m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) {
    const latitude = parseFloat(m[1]);
    const longitude = parseFloat(m[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }
  m = s.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) {
    const latitude = parseFloat(m[1]);
    const longitude = parseFloat(m[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }
  m = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) {
    const latitude = parseFloat(m[1]);
    const longitude = parseFloat(m[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }
  return null;
}

function isValidCoord(latitude, longitude) {
  return (
    latitude != null
    && longitude != null
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && !(latitude === 0 && longitude === 0)
  );
}

function districtCoordinate(item, indexSeed = 0) {
  const a = item?.address;
  const district = a?.district != null
    ? String(a.district).trim()
    : String(item?.addressDistrict ?? item?.district ?? '').trim();
  const key = normalizeDistrictKey(district);
  const base = MUGLA_DISTRICT_COORDS[key] || DEFAULT_MUGLA;
  const j = hashIndex(indexSeed, 7) - 3;
  const k = hashIndex(`${indexSeed}x`, 5) - 2;
  return {
    latitude: base.latitude + j * 0.004,
    longitude: base.longitude + k * 0.004,
  };
}

export function buildAddressQuery(item) {
  const a = item?.address;
  const neighborhood = a?.neighborhood != null
    ? String(a.neighborhood).trim()
    : String(item?.addressNeighborhood ?? item?.neighborhood ?? '').trim();
  const district = a?.district != null
    ? String(a.district).trim()
    : String(item?.addressDistrict ?? item?.district ?? '').trim();
  const city = a?.city != null
    ? String(a.city).trim()
    : String(item?.addressCity ?? item?.city ?? '').trim();
  const parts = [neighborhood, district, city || 'Muğla', 'Türkiye'].filter(Boolean);
  return parts.join(', ');
}

function hasAddressFields(item) {
  const q = buildAddressQuery(item);
  return q.length > 'Muğla, Türkiye'.length;
}

export function itemMapCoordinate(item, index = 0) {
  if (!item) return null;

  const fromGoogle = coordsFromGoogleLocation(item.googleLocation);
  if (fromGoogle && isValidCoord(fromGoogle.latitude, fromGoogle.longitude)) {
    return fromGoogle;
  }

  const latitude = parseMapCoord(item.latitude);
  const longitude = parseMapCoord(item.longitude);
  if (isValidCoord(latitude, longitude)) {
    return { latitude, longitude };
  }

  if (hasAddressFields(item)) {
    return districtCoordinate(item, item._id || index);
  }

  return null;
}

export function itemsWithMapCoordinates(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const coord = itemMapCoordinate(item, index);
      if (!coord) return null;
      return { item, ...coord };
    })
    .filter(Boolean);
}

export function googleMapsQueryForItem(item, fallbackCoord) {
  const gl = String(item?.googleLocation || '').trim();
  if (gl) {
    if (/^https?:\/\//i.test(gl)) return { type: 'url', value: gl };
    return { type: 'query', value: gl };
  }
  const address = buildAddressQuery(item);
  if (address) return { type: 'query', value: address };
  if (fallbackCoord?.latitude != null && fallbackCoord?.longitude != null) {
    return { type: 'query', value: `${fallbackCoord.latitude},${fallbackCoord.longitude}` };
  }
  return null;
}

/** İlçe merkezine göre harita bölgesi (Rezervasyon vb. varsayılan zoom) */
export function districtMapRegion(districtName, delta = 0.14) {
  const coord = districtCoordinate({ address: { district: districtName } }, 0);
  return {
    latitude: coord.latitude,
    longitude: coord.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}
