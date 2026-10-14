import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { translate } from '../src/i18n.js';
const require = createRequire(import.meta.url);
const bundle = await build({ stdin: { contents: "export {default} from './src/hooks/useWalkingRoute.js';", resolveDir: new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') }, bundle: true, write: false, format: 'esm', define: { 'import.meta.env.VITE_API_BASE_URL': "''" }, plugins: [{ name: 'react', setup(b) { b.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true })); } }] });
const { default: useWalkingRoute } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const base = Date.parse('2026-11-01T13:00:00Z');
const sample = patch => ({ userId: 2, latitude: 24, longitude: 46.001, recordedAt: new Date(Date.now()).toISOString(), sharingEnabled: true, visibleUntil: null, ...patch });
const route = distance => ({ status: 'READY', coordinates: [[24,46],[24,46.001]], distanceMeters: distance, durationSeconds: 80 });
let tree, value, props, requests, timers;
const originalFetch = globalThis.fetch;
const flush = () => act(async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); });
function Probe(input) { value = useWalkingRoute(input); return null; }
function update(patch = {}) { props = { ...props, ...patch, now: Date.now() }; act(() => tree.update(React.createElement(Probe, props))); }
async function advance(ms, patch = {}, fresh = true) {
  act(() => timers.tick(ms));
  update({ ...(fresh ? { own: { ...props.own, recordedAt: new Date(Date.now()).toISOString() }, target: props.target?.userId ? { ...props.target, recordedAt: new Date(Date.now()).toISOString() } : props.target } : {}), ...patch });
  await flush();
}
async function finish(body = route(100), status = 200) { await act(async () => { requests.at(-1).resolve(new Response(JSON.stringify(body), { status })); for (let i = 0; i < 40; i++) await Promise.resolve(); }); }
async function initial() { act(() => value.start()); await advance(800); assert.equal(requests.length, 1); await finish(); assert.equal(value.result.status, 'READY'); }
async function refresh() { await advance(10000, { own: sample({ userId: 1, longitude: 46, latitude: 24.0003 }) }); await advance(800); assert.equal(requests.length, 2); }
beforeEach(({ mock }) => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: base }); timers = mock.timers; requests = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/csrf')) return new Response(JSON.stringify({ token: 'synthetic', headerName: 'X-CSRF-TOKEN' }));
    return new Promise(resolve => requests.push({ resolve, body: JSON.parse(options.body) }));
  };
  props = { groupId: 10, own: sample({ userId: 1, longitude: 46 }), target: sample(), online: true, consent: true, now: base, destinationId: 2, authorizationKey: '1:10:1' };
  act(() => { tree = Renderer.create(React.createElement(Probe, props)); });
});
afterEach(() => { act(() => tree.unmount()); globalThis.fetch = originalFetch; });

test('initial calculation, refresh pending geometry, successful replacement and direction input', async () => {
  act(() => value.start()); await advance(800); assert.equal(value.result.status, 'LOADING'); await finish();
  assert.deepEqual(requests[0].body, { memberId: 2, meetingPoint: false });
  await refresh(); assert.equal(value.result.distanceMeters, 100); assert.equal(value.updating, true); assert.equal(value.guiding, false);
  const calculatedAt = value.result.calculatedAt; await finish(route(120)); assert.equal(value.result.distanceMeters, 120); assert.equal(value.updating, false); assert.ok(value.result.calculatedAt > calculatedAt);
});
test('25 metres at the origin or destination triggers refresh; small jitter does not', async () => {
  await initial(); await advance(10000, { own: sample({ userId: 1, longitude: 46, latitude: 24.00002 }) }); await advance(800); assert.equal(requests.length, 1);
  await advance(1, { target: sample({ latitude: 24.0003 }) }); await advance(800); assert.equal(requests.length, 2); await finish(route(150));
});
test('30 seconds since successful calculation triggers one refresh without a real wait', async () => {
  await initial(); await advance(29000); assert.equal(requests.length, 1); await advance(1000); await advance(800); assert.equal(requests.length, 2); assert.equal(value.result.distanceMeters, 100);
});
for (const [label, body, status] of [['provider unavailable', { status: 'UNAVAILABLE' }, 200], ['network error', { message: 'synthetic' }, 503], ['rate limit', { message: 'synthetic' }, 429], ['validation error', { message: 'synthetic' }, 400]]) {
  test(`${label} preserves authorized geometry as outdated and bounds retry`, async () => {
    await initial(); await refresh(); await finish(body, status); assert.equal(value.result.status, 'READY'); assert.equal(value.result.outdated, true); assert.equal(value.result.failed, true);
    await advance(1000); assert.equal(requests.length, 2); act(() => value.start()); await advance(800); assert.equal(requests.length, 2);
    await advance(10000); await advance(800); assert.equal(requests.length, 3); await finish(route(200)); assert.equal(value.result.outdated, false);
  });
}
test('offline route remains an outdated reference with stale GPS and no new requests', async () => {
  await initial(); update({ online: false, own: null, requestEnabled: false }); assert.equal(value.result.status, 'READY'); assert.equal(value.result.offline, true); assert.equal(value.guiding, false);
  await advance(120000, { own: null }, false); assert.equal(requests.length, 1); assert.equal(value.result.status, 'READY');
});
test('reconnect hides geometry pending revalidation, then refreshes only after fresh GPS', async () => {
  await initial(); update({ online: false }); await advance(10000); update({ online: false, target: null, own: null, revalidating: true }); assert.equal(value.result, null);
  update({ online: true, target: sample(), own: null, revalidating: false, waitingForGps: true, requestEnabled: true }); assert.equal(value.result.status, 'READY'); await advance(1000, { own: null }); assert.equal(requests.length, 1);
  update({ own: sample({ userId: 1, longitude: 46 }), waitingForGps: false }); await advance(800); assert.equal(requests.length, 2); await finish(route(180)); assert.equal(value.result.outdated, false);
});
test('Stop clears geometry and reconnect does not restart navigation', async () => {
  await initial(); act(() => value.stop()); assert.equal(value.result, null); update({ online: false }); await advance(10000); update({ online: true }); await advance(1000); assert.equal(requests.length, 1); assert.equal(value.preview, false);
});
for (const [label, patch] of [
  ['destination', { destinationId: 3, target: sample({ userId: 3 }) }],
  ['group', { groupId: 11 }], ['logout', { consent: false, authorized: false }],
  ['sharing revocation', { target: sample({ sharingEnabled: false }) }],
  ['own sharing revocation', { authorized: false }], ['authorization period', { authorizationKey: '1:10:2' }],
  ['removed meeting point', { destinationId: 'meeting', target: null }]
]) test(`${label} clears geometry and discards a delayed response`, async () => {
  await initial(); await refresh(); update(patch); assert.equal(value.result, null); await finish(route(999)); assert.equal(value.result, null); assert.equal(value.guiding, false);
});
for (const mode of ['SCHEDULED', 'WHILE_USING']) test(`${mode} deadline purges offline geometry at the exact boundary`, async () => {
  update({ target: sample({ visibleUntil: new Date(base + 20000).toISOString() }) }); await initial(); update({ online: false }); await advance(19200, {}, false); assert.equal(value.result, null); assert.equal(value.guiding, false);
});
for (const field of ['own', 'target']) test(`stale ${field} cannot start or accept a delayed route`, async () => {
  update({ [field]: sample({ ...(field === 'own' ? { userId: 1, longitude: 46 } : {}), recordedAt: new Date(base - 30001).toISOString() }) }); act(() => value.start()); await advance(800, {}, false); assert.equal(requests.length, 0); assert.equal(value.available, false);
  update({ own: sample({ userId: 1, longitude: 46 }), target: sample() }); act(() => value.start()); await advance(800); assert.equal(requests.length, 1);
  await advance(30001, {}, false); assert.equal(value.result, null); await finish(route(999)); assert.equal(value.result, null);
});
for (const status of [401, 403, 404, 410]) test(`confirmed access failure ${status} removes sensitive geometry`, async () => {
  await initial(); await refresh(); await finish({ message: 'synthetic' }, status); assert.equal(value.result, null); assert.equal(value.guiding, false); assert.equal(value.blocked, true);
});
test('LOCATION_UNAVAILABLE removes geometry; malformed READY never replaces a valid route', async () => {
  await initial(); await refresh(); await finish({ status: 'READY', coordinates: [], distanceMeters: 1, durationSeconds: 1 }); assert.equal(value.result.distanceMeters, 100); assert.equal(value.result.outdated, true);
  act(() => value.start()); await advance(10000); await advance(800); await finish({ status: 'LOCATION_UNAVAILABLE' }); assert.equal(value.result, null); assert.equal(value.blocked, true);
});
for (const message of ['You are not a member of this group', 'Group not found', 'User not found', 'This group is closed', 'This group has no meeting point yet', 'Meeting point not found']) test(`existing HTTP 400 access contract: ${message}`, async () => {
  await initial(); await refresh(); await finish({ message }, 400); assert.equal(value.result, null); assert.equal(value.blocked, true); assert.equal(value.guiding, false);
});
test('a replacement fixed meeting point cannot inherit the old path', async () => {
  update({ destinationId: 'meeting', target: { id: 20, latitude: 24, longitude: 46.001 } }); await initial();
  update({ target: { id: 21, latitude: 24.002, longitude: 46 } }); assert.equal(value.result, null); assert.equal(value.preview, false);
});
test('fixed meeting-point routes work without a member timestamp', async () => {
  update({ destinationId: 'meeting', target: { name: 'Synthetic gate', latitude: 24, longitude: 46.001 } }); await initial(); assert.deepEqual(requests[0].body, { memberId: null, meetingPoint: true });
});
test('pending requests never overlap and an offline response cannot restore guidance', async () => {
  await initial(); await refresh(); update({ online: false }); await finish(route(999)); assert.equal(value.result.distanceMeters, 100); assert.equal(value.result.outdated, true);
  update({ online: true }); await advance(10000); await advance(800); assert.equal(requests.length, 3); await advance(1000); assert.equal(requests.length, 3);
});
test('route status messages have explicit English/French translations and Arabic originals', () => {
  for (const key of ['جارٍ تحديث المسار...', 'المسار محدّث', 'آخر مسار محسوب', 'الاتصال منقطع. هذا آخر مسار محسوب وقد لا يعكس موقعك الحالي.', 'تعذر تحديث المسار. يمكنك إعادة المحاولة.', 'انتهت صلاحية الموقع، توقف التوجيه.']) {
    assert.equal(translate(key, 'ar'), key); for (const language of ['en', 'fr']) assert.notEqual(translate(key, language), key);
  }
});
test('a physical disconnect during debounce prevents dispatch before the next poll', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    act(() => value.start()); Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
    await advance(800); assert.equal(requests.length, 0);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator; }
});
