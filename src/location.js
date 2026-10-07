// Launch area (Calexico, CA 92231), used when the user doesn't share GPS.
export const DEFAULT_LOCATION = { lat: 32.68, lng: -115.5, label: 'Calexico area (92231)' };

// Two decimals is ~1 km: close enough for "2 mi away", far enough to not
// pinpoint a home. The database rounds too; this keeps exact GPS off the wire.
export const round2 = (n) => Math.round(n * 100) / 100;

// Great-circle distance in miles (haversine).
export function distanceMiles(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

// Both points are rounded to ~1 km, so anything under a mile reads as "nearby".
export function formatDistance(miles) {
  if (miles < 1) return 'Nearby';
  return `${Math.round(miles)} mi away`;
}
