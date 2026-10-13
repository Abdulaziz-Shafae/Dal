import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { allowedLocations, bearingBetween, distanceBetween, headingFromEvent, shouldPublish, validCoordinates, globalSharingAllowed, locationAge, CACHE_TTL } from '../src/utils/navigationCalculations.js';
const a = { latitude: 0, longitude: 0, accuracy: 5 };
test('Haversine measures zero, known equatorial kilometre and antimeridian safely', () => {
  assert.equal(distanceBetween(a, a), 0);
  assert.ok(Math.abs(distanceBetween(a, { latitude: 0, longitude: 1 }) - 111194.93) < 1);
  assert.ok(distanceBetween({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 }) < 230);
});
test('bearing handles cardinal directions and unavailable/coincident points', () => {
  assert.equal(bearingBetween(a, { latitude: 1, longitude: 0 }), 0);
  assert.equal(bearingBetween(a, { latitude: 0, longitude: 1 }), 90);
  assert.equal(bearingBetween(a, { latitude: -1, longitude: 0 }), 180);
  assert.equal(bearingBetween(a, { latitude: 0, longitude: -1 }), 270);
  assert.equal(bearingBetween(a, a), null); assert.equal(bearingBetween(null, a), null);
});
test('missing, non-finite, strings and out-of-range coordinates never become markers', () => {
  for (const point of [null, {}, { latitude: null, longitude: 0 }, { latitude: '0', longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }]) assert.equal(validCoordinates(point), false);
});
test('server sharing flags remove hidden members even with supplied coordinates', () => {
  assert.deepEqual(allowedLocations([{ ...a, sharingEnabled: false }, { ...a, sharingEnabled: true, userId: 2 }, { latitude: null, longitude: null, sharingEnabled: true }]).map(p => p.userId), [2]);
});
test('compass accepts absolute/iOS headings, corrects screen rotation and rejects relative sensors', () => {
  assert.equal(headingFromEvent({ absolute: true, alpha: 90 }), 270);
  assert.equal(headingFromEvent({ absolute: true, alpha: 90 }, 90), 0);
  assert.equal(headingFromEvent({ webkitCompassHeading: 350, webkitCompassAccuracy: 5 }, 90), 80);
  assert.equal(headingFromEvent({ webkitCompassHeading: 30, webkitCompassAccuracy: -1 }), null);
  assert.equal(headingFromEvent({ absolute: false, alpha: 90 }), null);
});
test('GPS writes respect interval, movement threshold and periodic stationary heartbeat', () => {
  assert.equal(shouldPublish(a, null, Infinity, 15000), true);
  assert.equal(shouldPublish(a, a, 14000, 15000), false);
  assert.equal(shouldPublish(a, a, 20000, 15000), false);
  assert.equal(shouldPublish(a, a, 60000, 15000), true);
  assert.equal(shouldPublish({ ...a, latitude: .001 }, a, 15000, 15000), true);
});
test('scheduled sharing stops precisely at its end, with backend pause taking priority', () => {
  const settings = { sharingEnabled: true, sharingMode: 'SCHEDULED', startTime: '2026-10-13T12:00:00Z', endTime: '2026-10-13T13:00:00Z' };
  assert.equal(globalSharingAllowed(settings, Date.parse(settings.startTime)), true);
  assert.equal(globalSharingAllowed(settings, Date.parse(settings.endTime)), false);
  assert.equal(globalSharingAllowed({ ...settings, isPaused: true }, Date.parse(settings.startTime)), false);
});
test('timestamps remain explicit and stale data has a five-minute limit', () => {
  assert.equal(locationAge({}), Infinity);
  assert.equal(locationAge({ recordedAt: '2026-10-13T12:00:00Z' }, Date.parse('2026-10-13T12:05:00Z')), CACHE_TTL);
});
// Load the production uploader with only its unused API import removed.
const service = (await readFile(new URL('../src/services/locationService.js', import.meta.url), 'utf8')).replace("import { api } from '../api.js';", '').replace("'../utils/navigationCalculations.js'", JSON.stringify(new URL('../src/utils/navigationCalculations.js', import.meta.url).href));
const { createLocationPublisher } = await import('data:text/javascript;base64,' + Buffer.from(service).toString('base64'));
test('uploader prevents overlaps, suppresses jitter and releases failed requests', async () => {
  let release, calls = 0, now = 0;
  const uploader = createLocationPublisher(() => { calls++; return new Promise(resolve => { release = resolve; }); }, () => now);
  const first = uploader.publish(a, 1000);
  now = 2000; assert.equal(await uploader.publish({ ...a, latitude: .001 }, 1000), false); assert.equal(calls, 1);
  release(); await first;
  assert.equal(await uploader.publish(a, 1000), false);
  const failed = createLocationPublisher(async () => { throw new Error('offline'); }, () => now);
  await assert.rejects(failed.publish(a, 1000), /offline/);
  assert.equal(await failed.publish(a, 1000), false);
  now += 1000; await assert.rejects(failed.publish(a, 1000), /offline/);
});
