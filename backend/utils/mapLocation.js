const MUGLA_DISTRICT_COORDS = {
  bodrum: { lat: 37.0344, lng: 27.4305 },
  dalaman: { lat: 36.7659, lng: 28.802 },
  datca: { lat: 36.725, lng: 27.684 },
  datça: { lat: 36.725, lng: 27.684 },
  fethiye: { lat: 36.621, lng: 29.116 },
  kavaklidere: { lat: 37.445, lng: 28.362 },
  kavaklıdere: { lat: 37.445, lng: 28.362 },
  koycegiz: { lat: 36.959, lng: 28.683 },
  köyceğiz: { lat: 36.959, lng: 28.683 },
  marmaris: { lat: 36.855, lng: 28.274 },
  mentese: { lat: 37.2153, lng: 28.3636 },
  menteşe: { lat: 37.2153, lng: 28.3636 },
  milas: { lat: 37.316, lng: 27.783 },
  ortaca: { lat: 36.839, lng: 28.767 },
  seydikemer: { lat: 36.648, lng: 29.359 },
  ula: { lat: 37.104, lng: 28.417 },
  yatagan: { lat: 37.341, lng: 28.142 },
  yatağan: { lat: 37.341, lng: 28.142 },
  mugla: { lat: 37.2153, lng: 28.3636 },
  muğla: { lat: 37.2153, lng: 28.3636 },
};

const DEFAULT_MUGLA = { lat: 37.2153, lng: 28.3636 };

function normalizeKey(s) {
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

function parseCoord(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function isValidCoord(lat, lng) {
  return (
    lat != null
    && lng != null
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
    && !(lat === 0 && lng === 0)
  );
}

function coordsFromDoc(doc) {
  const lat = parseCoord(doc?.latitude);
  const lng = parseCoord(doc?.longitude);
  if (isValidCoord(lat, lng)) return { lat, lng };
  return null;
}

function coordsFromGoogleLocation(url) {
  const s = String(url ?? '').trim();
  if (!s) return null;
  // Google paylaşım linklerinde !3d/!4d gerçek işaretçi; @ genelde harita merkezi
  let m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }
  m = s.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }
  m = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }
  return null;
}

function placeQueryFromGoogleUrl(url) {
  const s = String(url ?? '').trim();
  let m = s.match(/\/maps\/place\/([^/@?]+)/i);
  if (m) {
    try {
      return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
    } catch {
      return m[1].replace(/\+/g, ' ').trim();
    }
  }
  m = s.match(/[?&]q=([^&]+)/i);
  if (m) {
    const q = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
    if (q && !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(q)) return q;
  }
  return '';
}

function looksLikeGoogleMapsUrl(value) {
  const s = String(value ?? '').trim();
  if (!s) return false;
  return /^https?:\/\//i.test(s)
    || /maps\.google/i.test(s)
    || /google\.com\/maps/i.test(s)
    || /goo\.gl\/maps/i.test(s);
}

function geocodeQueryFromInput(input) {
  const q = String(input ?? '').trim();
  if (!q) return '';
  if (/türkiye|turkiye|turkey/i.test(q)) return q;
  return `${q}, Türkiye`;
}

async function coordsFromLocationInput(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  const fromUrl = coordsFromGoogleLocation(raw);
  if (fromUrl) return { coords: fromUrl, source: 'google' };

  if (!looksLikeGoogleMapsUrl(raw)) {
    const geocoded = await geocodeAddress(geocodeQueryFromInput(raw));
    if (geocoded) return { coords: geocoded, source: 'geocode' };
    return null;
  }

  const placeName = placeQueryFromGoogleUrl(raw);
  if (placeName) {
    const geocoded = await geocodeAddress(geocodeQueryFromInput(placeName));
    if (geocoded) return { coords: geocoded, source: 'geocode' };
  }
  return null;
}

function addressFromDoc(doc) {
  const a = doc?.address;
  if (a && typeof a === 'object') {
    return {
      city: String(a.city ?? '').trim(),
      district: String(a.district ?? '').trim(),
      neighborhood: String(a.neighborhood ?? '').trim(),
    };
  }
  return {
    city: String(doc?.addressCity ?? doc?.city ?? '').trim(),
    district: String(doc?.addressDistrict ?? doc?.district ?? '').trim(),
    neighborhood: String(doc?.addressNeighborhood ?? doc?.neighborhood ?? '').trim(),
  };
}

function buildAddressQuery(doc) {
  const a = addressFromDoc(doc);
  const parts = [a.neighborhood, a.district, a.city || 'Muğla', 'Türkiye'].filter(Boolean);
  return parts.join(', ');
}

function districtFallbackCoords(doc, index = 0) {
  const a = addressFromDoc(doc);
  const key = normalizeKey(a.district);
  const base = MUGLA_DISTRICT_COORDS[key] || DEFAULT_MUGLA;
  const jitter = ((index % 7) - 3) * 0.004;
  const jitter2 = ((index % 5) - 2) * 0.004;
  return { lat: base.lat + jitter, lng: base.lng + jitter2 };
}

function jitterCoords(coords, index = 0) {
  if (!coords) return null;
  const jitter = ((index % 7) - 3) * 0.003;
  const jitter2 = ((index % 5) - 2) * 0.003;
  return { lat: coords.lat + jitter, lng: coords.lng + jitter2 };
}

let lastGeocodeMs = 0;

async function geocodeAddress(query) {
  const q = String(query ?? '').trim();
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': '48App-Mobile/1.0 (map-location)',
        Accept: 'application/json',
      },
    });
    const data = await res.json().catch(() => []);
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (isValidCoord(lat, lng)) return { lat, lng };
  } catch {
    /* ignore */
  }
  return null;
}

async function geocodeAddressThrottled(query) {
  const now = Date.now();
  const delay = Math.max(0, 1100 - (now - lastGeocodeMs));
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  lastGeocodeMs = Date.now();
  return geocodeAddress(query);
}

async function resolveMapCoords(item, index, { forMap, geocodeCount }) {
  const googleLocation = String(item.googleLocation || '').trim();
  const saved = coordsFromDoc(item);
  const savedSource = String(item.mapLocationSource || '').trim();

  if (googleLocation) {
    const fromUrl = coordsFromGoogleLocation(googleLocation);
    if (fromUrl) return { coords: fromUrl, source: 'google' };
  }

  if (saved && savedSource !== 'district') {
    return { coords: saved, source: savedSource || 'saved' };
  }

  if (googleLocation) {
    if (!looksLikeGoogleMapsUrl(googleLocation)) {
      const geocoded = await geocodeAddressThrottled(geocodeQueryFromInput(googleLocation));
      if (geocoded) return { coords: geocoded, source: 'geocode' };
    } else {
      const placeName = placeQueryFromGoogleUrl(googleLocation);
      if (placeName) {
        const geocoded = await geocodeAddressThrottled(geocodeQueryFromInput(placeName));
        if (geocoded) return { coords: geocoded, source: 'geocode' };
      }
    }
  }

  if (forMap) {
    const q = buildAddressQuery(item);
    const hasRealAddress = q && q !== 'Muğla, Türkiye';
    if (hasRealAddress) {
      geocodeCount.value += 1;
      const geocoded = await geocodeAddressThrottled(q);
      if (geocoded) return { coords: geocoded, source: 'geocode' };
    }
  }

  if (saved) {
    return { coords: saved, source: savedSource || 'saved' };
  }

  const a = addressFromDoc(item);
  if (a.district || a.neighborhood || a.city) {
    let fb = districtFallbackCoords(item, index);
    fb = jitterCoords(fb, index) || fb;
    return { coords: fb, source: 'district' };
  }

  return { coords: null, source: '' };
}

async function resolveLocationFieldsFromBody(body, address, indexSeed = 0) {
  const googleLocation = String(body.googleLocation ?? '').trim();
  let coords = null;
  let source = '';

  if (googleLocation) {
    const resolved = await coordsFromLocationInput(googleLocation);
    if (resolved) {
      coords = resolved.coords;
      source = resolved.source;
    }
  }
  if (!coords) {
    coords = coordsFromDoc(body);
    if (coords) source = String(body.mapLocationSource || 'saved').trim() || 'saved';
  }
  if (!coords) {
    const q = buildAddressQuery({ address });
    if (q) {
      const geocoded = await geocodeAddress(q);
      if (geocoded) {
        coords = geocoded;
        source = 'geocode';
      }
    }
  }
  if (!coords) {
    coords = districtFallbackCoords({ address }, indexSeed);
    source = 'district';
    coords = jitterCoords(coords, indexSeed) || coords;
  }
  return {
    googleLocation,
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    mapLocationSource: source,
  };
}

async function enrichListForMap(items, options = {}) {
  const {
    forMap = false,
    Model = null,
  } = options;
  const geocodeCount = { value: 0 };
  const out = [];

  for (let i = 0; i < items.length; i += 1) {
    const raw = items[i];
    const item = { ...raw };
    const googleLocation = String(item.googleLocation || '').trim();
    const { coords, source } = await resolveMapCoords(item, i, { forMap, geocodeCount });

    if (coords) {
      item.latitude = coords.lat;
      item.longitude = coords.lng;
      item.mapLocationSource = source;
      if (Model && item._id && (source === 'geocode' || source === 'google')) {
        try {
          await Model.findByIdAndUpdate(item._id, {
            $set: {
              latitude: coords.lat,
              longitude: coords.lng,
              mapLocationSource: source,
              ...(googleLocation ? { googleLocation } : {}),
            },
          });
        } catch {
          /* ignore persist errors */
        }
      }
    }

    out.push(item);
  }
  return out;
}

module.exports = {
  parseCoord,
  coordsFromDoc,
  coordsFromGoogleLocation,
  placeQueryFromGoogleUrl,
  coordsFromLocationInput,
  geocodeAddress,
  districtFallbackCoords,
  resolveLocationFieldsFromBody,
  enrichListForMap,
  DEFAULT_MUGLA,
};
