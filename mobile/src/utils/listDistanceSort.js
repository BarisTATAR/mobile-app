import { itemMapCoordinate } from './mapCoordinates';

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km) {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function sortItemsByDistance(items, userLocation) {
  if (!Array.isArray(items) || !userLocation) return items;
  const withDist = items.map((item, index) => {
    const coord = itemMapCoordinate(item, index);
    const distanceKm = coord
      ? haversineKm(
        userLocation.latitude,
        userLocation.longitude,
        coord.latitude,
        coord.longitude,
      )
      : null;
    return { item, distanceKm };
  });
  withDist.sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0;
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
  return withDist.map(({ item, distanceKm }) => ({ ...item, _distanceKm: distanceKm }));
}
