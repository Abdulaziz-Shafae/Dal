import { translate } from '../i18n.js';
export const normalizeAngle = angle => ((angle % 360) + 360) % 360;
export function validCoordinates(p) {
  return !!p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
}
const rad = value => value * Math.PI / 180;
export function distanceBetween(a, b) {
  if (!validCoordinates(a) || !validCoordinates(b)) return null;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function bearingBetween(a, b) {
  if (distanceBetween(a, b) === null || distanceBetween(a, b) < 0.1) return null;
  const lon = rad(b.longitude - a.longitude);
  return normalizeAngle(Math.atan2(Math.sin(lon) * Math.cos(rad(b.latitude)), Math.cos(rad(a.latitude)) * Math.sin(rad(b.latitude)) - Math.sin(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(lon)) * 180 / Math.PI);
}
export const allowedLocations = rows => (Array.isArray(rows) ? rows : []).filter(p => p.sharingEnabled === true && validCoordinates(p));
export function locationVisible(point, now = Date.now()) {
  if (point?.sharingEnabled !== true || !validCoordinates(point) || !Number.isFinite(Date.parse(point.recordedAt))) return false;
  if (!Object.prototype.hasOwnProperty.call(point, 'visibleUntil')) return false;
  if (point.visibleUntil === null) return true;
  const until = typeof point.visibleUntil === 'string' ? Date.parse(point.visibleUntil) : NaN;
  return Number.isFinite(until) && until > now && until > Date.parse(point.recordedAt);
}
export const visibleLocations = (rows, now = Date.now()) => allowedLocations(rows).filter(point => locationVisible(point, now));
export function headingFromEvent(event, screenAngle = 0) {
  if (Number.isFinite(event.webkitCompassHeading) && (event.webkitCompassAccuracy == null || (event.webkitCompassAccuracy >= 0 && event.webkitCompassAccuracy <= 50))) return normalizeAngle(event.webkitCompassHeading + screenAngle);
  if (event.absolute === true && Number.isFinite(event.alpha)) return normalizeAngle(360 - event.alpha + screenAngle);
  return null;
}
export function shouldPublish(next, last, elapsed, interval) {
  if (!validCoordinates(next) || elapsed < interval) return false;
  return !last || distanceBetween(last, next) >= Math.max(5, Math.min(next.accuracy || 5, 25)) || elapsed >= Math.max(interval, 60000);
}
export function globalSharingAllowed(settings, now = Date.now()) {
  if (!settings?.sharingEnabled || settings.isPaused) return false;
  return settings.sharingMode !== 'SCHEDULED' || (now >= Date.parse(settings.startTime) && now < Date.parse(settings.endTime));
}
export function locationAge(point, now = Date.now()) {
  const time = Date.parse(point?.recordedAt || point?.updatedAt);
  return Number.isFinite(time) ? Math.max(0, now - time) : Infinity;
}
export function locationLabel(point, now = Date.now(), lang = 'ar') {
  const tr = (key, ...values) => translate(key, lang, ...values);
  const time = point?.recordedAt || point?.updatedAt;
  const age = locationAge(point, now);
  if (!time || !Number.isFinite(age)) return tr('وقت التحديث غير متاح');
  return tr('آخر تحديث: {0}', new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(time)));
}
export function locationStatus(point, now = Date.now(), online = true, lang = 'ar') {
  return translate(!online ? 'آخر موقع معروف · بيانات محفوظة أثناء انقطاع الاتصال' : locationAge(point, now) > 30000 ? 'آخر موقع معروف' : 'موقع حديث', lang);
}
