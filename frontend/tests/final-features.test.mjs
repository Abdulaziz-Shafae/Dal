import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const code = await build({ stdin: { contents: "export {default as walking,routeNeedsUpdate} from './src/hooks/useWalkingRoute.js'; export {default as orientation} from './src/hooks/useDeviceOrientation.js'; export {default as gps} from './src/hooks/useGeolocation.js'; export {badgeLabel} from './src/components/NotificationBadge.jsx';", resolveDir: new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') }, bundle: true, write: false, format: 'esm', define: { 'import.meta.env.VITE_API_BASE_URL': "''" }, plugins: [{ name: 'react', setup(b) { b.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true })); } }] });
const hooks = await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text).toString('base64'));
let tree, value, fetchOriginal, calls;
function mount(hook, props) { function Probe(input) { value = hook(input); return null; } act(() => { tree = Renderer.create(React.createElement(Probe, props)); }); return next => act(() => tree.update(React.createElement(Probe, next))); }
const wait = ms => act(async () => { await new Promise(r => setTimeout(r, ms)); });
beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), { isSecureContext: true, DeviceOrientationEvent: class {}, screen: { orientation: { angle: 0 } } });
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  fetchOriginal = globalThis.fetch; calls = [];
  globalThis.fetch = async (url, options = {}) => { if (url.endsWith('/csrf')) return new Response(JSON.stringify({ token: 'test', headerName: 'X-CSRF-TOKEN' })); calls.push(JSON.parse(options.body)); return new Response(JSON.stringify({ status: 'READY', coordinates: [[24, 46], [24.001, 46]], distanceMeters: 150, durationSeconds: 120 })); };
});
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; globalThis.fetch = fetchOriginal; });
test('notification labels cover 0,1,3,99+ and hide invalid counts', () => { for (const [count, expected] of [[0, ''], [1, '1'], [3, '3'], [99, '99'], [100, '99+'], [NaN, '']]) assert.equal(hooks.badgeLabel(count), expected); });
test('walking recalculation uses 25 metre movement, destination changes and short expiry', () => {
  const own = { latitude: 24, longitude: 46 }, target = { latitude: 24.001, longitude: 46 }, prior = { own, target, key: '1:2', time: 1000 };
  assert.equal(hooks.routeNeedsUpdate(prior, own, target, '1:2', 2000), false);
  assert.equal(hooks.routeNeedsUpdate(prior, { ...own, latitude: 24.00001 }, target, '1:2', 2000), false);
  assert.equal(hooks.routeNeedsUpdate(prior, { ...own, latitude: 24.0003 }, target, '1:2', 2000), true);
  assert.equal(hooks.routeNeedsUpdate(prior, own, { ...target, latitude: 24.002 }, '1:2', 2000), true);
  assert.equal(hooks.routeNeedsUpdate(prior, own, target, '1:3', 2000), true);
  assert.equal(hooks.routeNeedsUpdate(prior, own, target, '1:2', 31000), true);
});
test('walking previews only after selection and clears immediately on stop, offline or revoked sharing', async () => {
  const props = { groupId: 1, own: { latitude: 24, longitude: 46, recordedAt: new Date().toISOString() }, target: { userId: 2, latitude: 24.001, longitude: 46, sharingEnabled: true }, online: true, consent: true, now: Date.now() };
  const update = mount(hooks.walking, props); await wait(850); assert.equal(calls.length, 0);
  act(() => value.select()); await wait(850); assert.equal(value.result.status, 'READY'); assert.equal(calls[0].memberId, 2); assert.equal(calls[0].meetingPoint, false); assert.equal(calls.length, 1);
  act(() => value.start()); assert.equal(value.guiding, true);
  update({ ...props, online: false }); assert.equal(value.result, null);
  update({ ...props, target: { ...props.target, sharingEnabled: false } }); assert.equal(value.available, false); assert.equal(value.result, null);
  act(() => value.stop()); assert.equal(value.preview, false); assert.equal(value.guiding, false);
});
test('meeting routes use meeting destination without sending coordinates from React', async () => {
  mount(hooks.walking, { groupId: 1, own: { latitude: 24, longitude: 46, recordedAt: new Date().toISOString() }, target: { id: 7, latitude: 24.001, longitude: 46 }, consent: true, online: true, now: Date.now() });
  act(() => value.start()); await wait(850); assert.deepEqual(calls[0], { memberId: null, meetingPoint: true }); assert.equal(value.result.distanceMeters, 150);
});
test('orientation grant survives map/compass activation changes and resume without re-prompt', async () => {
  let prompts = 0; window.DeviceOrientationEvent.requestPermission = async () => { prompts++; return 'granted'; };
  const update = mount(p => hooks.orientation(p.active), { active: true });
  await act(async () => value.enable()); update({ active: false }); update({ active: true });
  await act(async () => value.enable()); assert.equal(prompts, 1);
  act(() => { document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); document.hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  const reading = new Event('deviceorientationabsolute'); reading.absolute = true; reading.alpha = 90;
  act(() => window.dispatchEvent(reading)); assert.equal(value.heading, 270); assert.equal(prompts, 1);
});
test('GPS observes browser revocation on resume and allows explicit retry', async () => {
  let permission = { state: 'granted', onchange: null }, watches = 0, cleared = 0;
  navigator.permissions = { query: async () => permission };
  navigator.geolocation = { watchPosition() { return ++watches; }, clearWatch() { cleared++; } };
  const update = mount(p => hooks.gps(p.enabled, p.attempt), { enabled: true, attempt: 0 }); await wait(5);
  permission.state = 'denied'; await act(async () => permission.onchange()); assert.equal(value.status, 'denied'); assert.equal(value.point, null); assert.ok(cleared);
  permission.state = 'granted'; update({ enabled: true, attempt: 1 }); assert.equal(watches, 2);
});
