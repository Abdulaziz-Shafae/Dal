import { bearingBetween, distanceBetween, validCoordinates } from './navigationCalculations.js';

// Backend/Leaflet coordinates are [latitude, longitude], not ORS's raw GeoJSON order.
const longitudeDelta = value => ((value + 540) % 360) - 180;
const interpolate = (a, b, t) => ({ latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: longitudeDelta(a.longitude + longitudeDelta(b.longitude - a.longitude) * t) });
export function compassPath(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const points = coordinates.map(p => Array.isArray(p) ? { latitude: p[0], longitude: p[1] } : null);
  if (!points.every(validCoordinates)) return null;
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + distanceBetween(points[i - 1], points[i]));
  return cumulative.at(-1) > 1 ? { points, cumulative, length: cumulative.at(-1) } : null;
}

export function advanceCompassWaypoint(path, own, previous = null) {
  if (!path || !validCoordinates(own)) return { status: 'unavailable' };
  if (!Number.isFinite(own.accuracy) || own.accuracy < 0 || own.accuracy > 50) return { status: 'accuracy' };
  const { points, cumulative, length } = path;
  const moved = previous ? distanceBetween(previous.own, own) : 0;
  // A bounded forward window avoids jumping onto a nearby return leg at a hairpin.
  const maximum = previous ? Math.min(length, previous.progress + Math.max(30, Math.min(80, moved * 2 + own.accuracy))) : length;
  const minimum = previous ? Math.max(0, previous.progress - 10) : 0;
  let nearest = null;
  for (let i = 0; i < points.length - 1; i++) {
    const segment = cumulative[i + 1] - cumulative[i];
    if (segment < .01 || cumulative[i] > maximum || cumulative[i + 1] < minimum) continue;
    const a = points[i], b = points[i + 1], cos = Math.max(.000001, Math.cos(own.latitude * Math.PI / 180));
    const dx = longitudeDelta(b.longitude - a.longitude) * cos, dy = b.latitude - a.latitude;
    const px = longitudeDelta(own.longitude - a.longitude) * cos, py = own.latitude - a.latitude;
    const lower = Math.max(0, (minimum - cumulative[i]) / segment), upper = Math.min(1, (maximum - cumulative[i]) / segment);
    const t = Math.max(lower, Math.min(upper, (px * dx + py * dy) / (dx * dx + dy * dy)));
    const projected = interpolate(a, b, t), distance = distanceBetween(own, projected), along = cumulative[i] + t * segment;
    if (!nearest || distance < nearest.distance - 2 || (Math.abs(distance - nearest.distance) <= 2 && along < nearest.along)) nearest = { distance, along };
  }
  if (!nearest || nearest.distance > 35) return { status: 'off-route' };
  // Small backwards/forwards GPS jitter cannot undo completed progress.
  const progress = previous && nearest.along < previous.progress + 3 ? previous.progress : nearest.along;
  let segment = cumulative.findIndex((distance, i) => i > 0 && distance > progress + .1) - 1;
  if (segment < 0) segment = points.length - 2;
  if (segment < points.length - 2 && cumulative[segment + 1] - progress < 6) segment++;
  const waypointDistance = Math.min(cumulative[segment + 1], Math.max(cumulative[segment], progress + Math.max(12, Math.min(25, own.accuracy * 1.5))));
  const span = cumulative[segment + 1] - cumulative[segment];
  const waypoint = interpolate(points[segment], points[segment + 1], span ? (waypointDistance - cumulative[segment]) / span : 0);
  return { status: 'ready', progress, segment, waypoint, remainingMeters: Math.max(0, length - progress), bearing: bearingBetween(own, waypoint), own };
}
