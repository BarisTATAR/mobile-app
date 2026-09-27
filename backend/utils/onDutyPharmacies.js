const TEKNIKZEKA_URL = 'https://api.teknikzeka.net/eczane/api.php';
const ECZANEAPI_URL = 'https://eczaneapi.com/api/v1/pharmacies/on-duty';
const CACHE_MS = 5 * 60 * 1000;
const cityCache = new Map();

function foldTr(value) {
  return String(value || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function asciiUpper(value) {
  return foldTr(value).toUpperCase();
}

function uniqueStrings(list) {
  const seen = new Set();
  const out = [];
  list.forEach((item) => {
    const s = String(item || '').trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  return out;
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}

function mapLocation(p) {
  const loc = p.location && typeof p.location === 'object' ? p.location : {};
  const lat = loc.latitude ?? loc.lat ?? p.lat ?? p.latitude;
  const lon = loc.longitude ?? loc.lng ?? loc.lon ?? p.lon ?? p.lng ?? p.longitude;
  if (lat == null || lon == null || lat === '' || lon === '') return null;
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function displayName(raw) {
  const name = String(raw || '').trim();
  if (!name) return 'Eczane';
  if (/eczane/i.test(name)) return name;
  return `${name} Eczanesi`;
}

function normalizePharmacy(p, index) {
  if (!p || typeof p !== 'object') return null;
  const name = displayName(p.name || p.eczaneAdi || p.pharmacyName);
  const phone = String(p.phone || p.phone1 || p.tel || '').trim();
  return {
    id: String(p.id || p.pharmacyId || `${name}-${phone || index}`),
    name,
    address: String(p.address || p.adres || '').trim(),
    phone,
    phone2: String(p.phone2 || '').trim() || null,
    district: String(p.district?.name || p.district || p.ilce || '').trim(),
    city: String(p.city?.name || p.city || p.il || '').trim(),
    location: mapLocation(p),
  };
}

function filterByDistrict(list, district) {
  const wanted = foldTr(district);
  if (!wanted) return list;
  return list.filter((p) => foldTr(p.district) === wanted);
}

async function fetchJson(url, headers = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': '48App/1.0',
        ...headers,
      },
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function pharmaciesFromEczaneApi(payload, today) {
  const d = payload && payload.data;
  if (!d) return [];
  if (Array.isArray(d)) {
    if (d.length && Array.isArray(d[0]?.pharmacies)) {
      const todayBlock = d.find((block) => String(block.date || '').slice(0, 10) === today);
      const nonempty = d.find((block) => Array.isArray(block.pharmacies) && block.pharmacies.length);
      return (todayBlock || nonempty || d[0]).pharmacies || [];
    }
    return d;
  }
  if (Array.isArray(d.pharmacies)) return d.pharmacies;
  if (Array.isArray(d.onDuty)) return d.onDuty;
  return [];
}

async function fetchEczaneApi(city, apiKey) {
  const today = todayInIstanbul();
  const params = new URLSearchParams({ city: String(city).trim(), date: today });
  const url = `${ECZANEAPI_URL}?${params.toString()}`;
  const { ok, data } = await fetchJson(url, { 'X-API-Key': apiKey });
  if (!ok || data?.success === false) return [];
  return pharmaciesFromEczaneApi(data, today)
    .map(normalizePharmacy)
    .filter(Boolean);
}

async function fetchTeknikZeka(city) {
  const candidates = uniqueStrings([asciiUpper(city), String(city).trim().toUpperCase()]);
  for (const il of candidates) {
    const url = `${TEKNIKZEKA_URL}?islem=nobetci&il=${encodeURIComponent(il)}`;
    const { ok, data } = await fetchJson(url);
    if (!ok) continue;
    const rows = Array.isArray(data?.sonuc) ? data.sonuc : [];
    const list = rows.map(normalizePharmacy).filter(Boolean);
    if (list.length) return list;
  }
  return [];
}

async function loadCityPharmacies(city) {
  const key = asciiUpper(city) || String(city).trim().toUpperCase();
  const cached = cityCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.list;

  const apiKey = process.env.ECZANE_API_KEY?.trim();
  let list = [];
  if (apiKey) {
    try {
      list = await fetchEczaneApi(city, apiKey);
    } catch (e) {
      console.warn('EczaneAPI fetch failed, falling back:', e.message);
    }
  }
  if (!list.length) {
    list = await fetchTeknikZeka(city);
  }
  cityCache.set(key, { at: Date.now(), list });
  return list;
}

async function getOnDutyPharmacies(city, district) {
  const cityName = String(city || '').trim();
  if (!cityName) {
    const err = new Error('city (il) parametresi gerekli');
    err.status = 400;
    throw err;
  }
  const all = await loadCityPharmacies(cityName);
  const pharmacies = filterByDistrict(all, district);
  return {
    city: cityName,
    district: String(district || '').trim() || null,
    date: todayInIstanbul(),
    pharmacies,
  };
}

module.exports = {
  getOnDutyPharmacies,
  foldTr,
};
