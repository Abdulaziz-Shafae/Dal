import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const result = await build({ stdin: { contents: "export {default as useGeolocation} from './src/hooks/useGeolocation.js'; export {default as useDeviceOrientation} from './src/hooks/useDeviceOrientation.js'; export {default as useGroupLocations} from './src/hooks/useGroupLocations.js';", resolveDir: new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') }, bundle: true, write: false, format: 'esm', define: { 'import.meta.env.VITE_API_BASE_URL': "''" }, plugins: [{ name: 'react-external', setup(build) { build.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true })); } }] });
const hooks = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
let tree, value, successes, failures, cleared, saved;
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); });
function mount(hook, props) { function Probe(input) { value = hook(input); return null; } act(() => { tree = Renderer.create(React.createElement(Probe, props)); }); return next => act(() => tree.update(React.createElement(Probe, next))); }
beforeEach(() => {
  const win = new EventTarget(); win.isSecureContext = true; win.screen = { orientation: { angle: 0 } }; win.DeviceOrientationEvent = class {};
  const doc = new EventTarget(); doc.hidden = false;
  globalThis.window = win; globalThis.document = doc; cleared = []; saved = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, geolocation: { watchPosition(ok, fail) { successes = ok; failures = fail; return 7; }, clearWatch(id) { cleared.push(id); } } } });
});
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });
test('GPS watch reads actual supplied browser coordinates and cleans up on stop', () => {
  const update = mount(input => hooks.useGeolocation(input.enabled), { enabled: true });
  assert.equal(value.status, 'loading');
  act(() => successes({ coords: { latitude: 24, longitude: 46, accuracy: 8 }, timestamp: Date.now() }));
  assert.equal(value.point.latitude, 24); assert.equal(value.point.accuracy, 8);
  update({ enabled: false }); assert.equal(value.point, null); assert.deepEqual(cleared, [7]);
});
test('GPS permission denied and unsupported context show explicit states', () => {
  mount(input => hooks.useGeolocation(input.enabled), { enabled: true });
  act(() => failures({ code: 1 })); assert.equal(value.status, 'denied'); assert.equal(value.point, null); assert.deepEqual(cleared, [7]);
  act(() => tree.unmount()); tree = null; window.isSecureContext = false;
  mount(input => hooks.useGeolocation(input.enabled), { enabled: true }); assert.equal(value.status, 'unavailable');
});
test('orientation requests iOS permission, reads heading and removes listeners', async () => {
  let calls = 0; window.DeviceOrientationEvent.requestPermission = async () => { calls++; return 'granted'; };
  mount(hooks.useDeviceOrientation, {});
  await act(async () => value.enable()); assert.equal(calls, 1);
  const event = new Event('deviceorientation'); event.webkitCompassHeading = 90; event.webkitCompassAccuracy = 5;
  act(() => window.dispatchEvent(event)); assert.equal(value.heading, 90);
  act(() => { document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); }); assert.equal(value.heading, null);
});
test('orientation denial and unsupported sensors retain north-only fallback', async () => {
  window.DeviceOrientationEvent.requestPermission = async () => 'denied';
  mount(hooks.useDeviceOrientation, {}); await act(async () => value.enable()); assert.equal(value.status, 'denied'); assert.equal(value.heading, null);
  window.DeviceOrientationEvent = undefined; await act(async () => value.enable()); assert.equal(value.status, 'unavailable');
});
test('group lifecycle requires consent, handles sharing revocation, offline, recovery and expiry', async () => {
  let mode = 'ok', reads = 0;
  const point = { userId: 2, name: 'Test member', latitude: 24.7, longitude: 46.6, accuracy: 8, recordedAt: new Date().toISOString(), sharingEnabled: true, visibilityMode: 'ALWAYS', visibleUntil: null };
  const settings = { sharingMode: 'WHILE_USING', sharingEnabled: true, updateIntervalSeconds: 15 };
  globalThis.fetch = async (url, options = {}) => {
    reads++;
    if (mode === 'offline') throw new Error('network');
    if (mode === 'expired') return new Response(JSON.stringify({ message: 'Your session has expired. Please log in again' }), { status: 400 });
    let body = url.endsWith('/csrf') ? { token: 'test', headerName: 'X-CSRF-TOKEN' } : url.endsWith('/sharing') ? settings : url.includes('/sharing/group/') ? { sharingEnabled: mode !== 'paused' } : url.includes('/location/group/') ? [{ ...point, sharingEnabled: mode !== 'paused' }] : url.includes('/meeting-point/') ? { name: 'Test meeting', latitude: 24, longitude: 46 } : url.includes('/group-member/') ? [] : {};
    if (url.endsWith('/location/update')) saved.push(JSON.parse(options.body));
    return new Response(JSON.stringify(body));
  };
  let expired = 0;
  mount(hooks.useGroupLocations, { user: { id: 1 }, group: { id: 1 }, active: true, sharing: settings, groupSharing: { sharingEnabled: true }, onSessionExpired: () => { expired++; } });
  await flush(); assert.equal(value.state, 'connected'); assert.equal(value.rows.length, 1); assert.equal(value.enabled, false);
  act(() => value.start()); assert.equal(value.enabled, true);
  act(() => successes({ coords: { latitude: 24, longitude: 46, accuracy: 10 }, timestamp: Date.now() })); await flush(); assert.equal(saved.length, 1);
  mode = 'offline'; act(() => window.dispatchEvent(new Event('online'))); await flush(); assert.equal(value.state, 'offline'); assert.equal(value.rows.length, 1); assert.equal(value.enabled, false); assert.ok(cleared.length);
  mode = 'ok'; act(() => window.dispatchEvent(new Event('online'))); await flush(); assert.equal(value.state, 'connected');
  mode = 'paused'; act(() => window.dispatchEvent(new Event('online'))); await flush(); assert.equal(value.rows.length, 0); assert.equal(value.consent, false);
  mode = 'expired'; act(() => window.dispatchEvent(new Event('online'))); await flush(); assert.equal(expired, 1); assert.equal(value.meeting, null);
  act(() => tree.unmount()); tree = null; const before = reads; window.dispatchEvent(new Event('online')); await flush(); assert.equal(reads, before);
});
