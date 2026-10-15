import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { locationFeedback, orientationFeedback } from '../src/utils/navigationPermissions.js';
const require = createRequire(import.meta.url);
const code = await build({ stdin: { contents: "export {default as gps} from './src/hooks/useGeolocation.js'; export {default as group} from './src/hooks/useGroupLocations.js'; export {default as sensor} from './src/hooks/useDeviceOrientation.js'; export {default as Popup} from './src/components/navigation/NavigationPermissionDialog.jsx'; export {LanguageProvider} from './src/LanguageContext.jsx';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, write: false, format: 'esm', define: { 'import.meta.env.VITE_API_BASE_URL': "''" }, plugins: [{ name: 'react', setup(b) { b.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true })); } }] });
const hooks = await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text).toString('base64'));
const keys = ['window', 'document', 'navigator', 'fetch', 'setTimeout', 'clearTimeout'];
const original = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let tree, value, watches, calls, maximum, timers, nextId, time, settings;
const point = () => ({ coords: { latitude: 24, longitude: 46, accuracy: 5 }, timestamp: Date.now() });
function mount(hook, props) { function Probe(p) { value = hook(p); return null; } act(() => { tree = Renderer.create(React.createElement(Probe, props)); }); return next => act(() => tree.update(React.createElement(Probe, next))); }
const flush = () => act(async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); });
const advance = ms => act(() => { time += ms; for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.fn(); } });
beforeEach(() => {
  time = 0; timers = new Map(); nextId = 0; watches = new Map(); calls = 0; maximum = 0;
  globalThis.setTimeout = (fn, ms) => { const id = ++nextId; timers.set(id, { fn, at: time + ms }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.window = Object.assign(new EventTarget(), { isSecureContext: true, DeviceOrientationEvent: class {}, screen: { orientation: { angle: 0 } } });
  globalThis.document = Object.assign(new EventTarget(), { hidden: false, activeElement: null, body: { style: { overflow: '' } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, geolocation: {
    watchPosition(ok, fail) { const id = ++calls; watches.set(id, { ok, fail }); maximum = Math.max(maximum, watches.size); return id; }, clearWatch(id) { watches.delete(id); }
  } } });
  settings = { sharingEnabled: true, sharingMode: 'ALWAYS', updateIntervalSeconds: 15 };
  globalThis.fetch = async url => new Response(JSON.stringify(url.endsWith('/csrf') ? { token: 'synthetic', headerName: 'X-CSRF-TOKEN' } : url.endsWith('/sharing') ? settings : url.includes('/sharing/group/') ? { sharingEnabled: true } : url.includes('/location/group/') || url.includes('/group-member/') ? [] : url.includes('/meeting-point/') ? null : { id: 10, status: 'ACTIVE' }));
});
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; for (const [key, descriptor] of original) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
test('Safari-like initial idle, absent/failed Permissions API never imply denial or request GPS', async () => {
  const update = mount(p => hooks.gps(p.enabled, p.attempt), { enabled: false, attempt: 0 });
  assert.equal(value.status, 'idle'); assert.equal(value.error, '');
  update({ enabled: true, attempt: 0 }); await flush(); assert.equal(value.status, 'idle'); assert.equal(calls, 0);
  navigator.permissions = { query: async () => { throw new TypeError('unsupported permission descriptor'); } };
  update({ enabled: false, attempt: 0 }); update({ enabled: true, attempt: 0 }); await flush();
  assert.equal(value.status, 'idle'); assert.equal(calls, 0);
  update({ enabled: true, attempt: 1 }); await flush(); assert.equal(value.status, 'loading'); assert.equal(calls, 1);
});
test('explicit denial is distinct from timeout, unavailable and unexpected errors; each supports a fresh retry', async () => {
  const update = mount(p => hooks.gps(true, p.attempt), { attempt: 1 });
  for (const [attempt, code, status] of [[1, 1, 'denied'], [2, 3, 'timeout'], [3, 2, 'unavailable'], [4, 99, 'error']]) {
    if (attempt > 1) update({ attempt });
    assert.equal(value.status, 'loading'); assert.equal(value.error, '');
    act(() => [...watches.values()][0].fail({ code })); assert.equal(value.status, status); assert.equal(watches.size, 0);
  }
  update({ attempt: 5 }); act(() => [...watches.values()][0].ok(point())); await flush();
  assert.equal(value.status, 'ready'); assert.equal(value.error, ''); assert.equal(maximum, 1);
});
test('native timeout fallback bounds loading and discards callbacks from the failed attempt', () => {
  const update = mount(p => hooks.gps(true, p.attempt), { attempt: 1 }); const old = [...watches.values()][0];
  advance(25001); assert.equal(value.status, 'timeout'); assert.equal(watches.size, 0);
  update({ attempt: 2 }); act(() => old.ok(point())); assert.equal(value.status, 'loading');
  act(() => [...watches.values()][0].ok(point())); assert.equal(value.status, 'ready'); assert.equal(maximum, 1);
});
test('a delayed permission snapshot cannot overwrite a successful explicit attempt', async () => {
  let resolve; navigator.permissions = { query: () => new Promise(done => { resolve = done; }) };
  mount(() => hooks.gps(true, 1)); act(() => [...watches.values()][0].ok(point()));
  await act(async () => resolve({ state: 'denied' })); assert.equal(value.status, 'ready'); assert.equal(watches.size, 1);
});
test('account/group scope changes clear old errors without consuming an old click as a new activation', async () => {
  const update = mount(p => hooks.gps(true, p.attempt, p.scope), { attempt: 1, scope: '1:10' });
  act(() => [...watches.values()][0].fail({ code: 1 })); assert.equal(value.status, 'denied');
  update({ attempt: 1, scope: '2:20' }); await flush(); assert.equal(value.status, 'idle'); assert.equal(calls, 1);
  update({ attempt: 2, scope: '2:20' }); act(() => [...watches.values()][0].ok(point())); assert.equal(value.status, 'ready');
});
test('automatic recovery requires a confirmed grant; unknown/prompt permission remains idle, not denied', async () => {
  const update = mount(p => hooks.gps(p.enabled, p.attempt), { enabled: true, attempt: 1 });
  act(() => [...watches.values()][0].ok(point())); update({ enabled: false, attempt: 1 });
  update({ enabled: true, attempt: 1 }); await flush(); assert.equal(calls, 1); assert.equal(value.status, 'idle');
  navigator.permissions = { query: async () => ({ state: 'granted' }) };
  update({ enabled: false, attempt: 1 }); update({ enabled: true, attempt: 1 }); await flush(); assert.equal(calls, 2);
  navigator.permissions.query = async () => ({ state: 'prompt' });
  update({ enabled: false, attempt: 1 }); update({ enabled: true, attempt: 1 }); await flush(); assert.equal(calls, 2); assert.equal(value.status, 'idle');
});
test('an activation interrupted before an eligible watch is not queued for automatic foreground/reconnect', async () => {
  const update = mount(p => hooks.gps(p.enabled, p.attempt), { enabled: false, attempt: 0 });
  update({ enabled: false, attempt: 1 }); update({ enabled: true, attempt: 1 }); await flush();
  assert.equal(calls, 0); assert.equal(value.status, 'idle');
  update({ enabled: true, attempt: 2 }); assert.equal(calls, 1); assert.equal(value.status, 'loading');
});
test('permission changes cannot silently re-prompt; a granted change recovers a consented watch safely', async () => {
  const permission = { state: 'prompt' }; navigator.permissions = { query: async () => permission };
  mount(() => hooks.gps(true, 0)); await flush(); assert.equal(calls, 0);
  permission.state = 'granted'; act(() => { permission.onchange(); }); await flush(); assert.equal(calls, 1);
  permission.state = 'denied'; act(() => { permission.onchange(); }); await flush(); assert.equal(value.status, 'denied'); assert.equal(watches.size, 0);
  permission.state = 'prompt'; act(() => { permission.onchange(); }); await flush(); assert.equal(value.status, 'idle'); assert.equal(calls, 1);
});
test('group denial does not poison a new consent attempt; multiple taps create only one watch and never activate Compass', async () => {
  let sensorCalls = 0; window.DeviceOrientationEvent.requestPermission = async () => { sensorCalls++; return 'granted'; };
  mount(hooks.group, { user: { id: 1 }, group: { id: 10, status: 'ACTIVE' }, active: true, sharing: settings, groupSharing: { sharingEnabled: true } }); await flush();
  assert.equal(value.gps.status, 'idle'); assert.equal(calls, 0);
  act(() => { value.start(); value.start(); value.start(); }); assert.equal(calls, 1);
  act(() => [...watches.values()][0].fail({ code: 1 })); assert.equal(value.consent, false); assert.equal(value.gps.status, 'denied');
  act(() => value.start()); assert.equal(calls, 2); assert.equal(value.gps.status, 'loading'); assert.equal(value.consent, true);
  act(() => [...watches.values()][0].ok(point())); await flush(); assert.equal(value.gps.status, 'ready'); assert.equal(value.consent, true);
  assert.equal(sensorCalls, 0); assert.equal(maximum, 1);
});
test('unsupported/insecure GPS and private sharing never offer an effective retry', () => {
  window.isSecureContext = false; mount(() => hooks.gps(true, 1)); assert.equal(value.status, 'unavailable'); assert.equal(value.supported, false); assert.equal(calls, 0);
  const nav = { gps: value, state: 'connected', settingsReady: true, sharingAllowed: true };
  assert.equal(locationFeedback(nav).disabled, true);
  assert.equal(locationFeedback({ ...nav, gps: { status: 'denied', supported: true }, sharingAllowed: false }).disabled, true);
});
test('orientation pending/denied/granted are distinct, and native permission is serialized', async () => {
  let prompts = 0, resolve; window.DeviceOrientationEvent.requestPermission = () => { prompts++; return new Promise(done => { resolve = done; }); };
  mount(() => hooks.sensor()); let pending;
  act(() => { pending = value.enable(); value.enable(); }); assert.equal(value.status, 'requesting'); assert.equal(prompts, 1); assert.equal(calls, 0);
  await act(async () => { resolve('denied'); await pending; }); assert.equal(value.status, 'denied');
  act(() => { pending = value.enable(); value.enable(); }); assert.equal(prompts, 2);
  await act(async () => { resolve('granted'); await pending; }); assert.equal(value.status, 'waiting');
  advance(5001); assert.equal(value.status, 'unavailable'); assert.equal(orientationFeedback(value).canActivate, true);
  await act(async () => { value.enable(); value.enable(); }); assert.equal(value.status, 'waiting'); assert.equal(prompts, 2);
  advance(5001); assert.equal(value.status, 'unavailable'); // Regression: retry formerly waited forever.
  assert.equal(calls, 0);
});
test('orientation retry restores valid iOS/absolute readings, ignores relative alpha and reuses grant after lifecycle changes', async () => {
  let prompts = 0; window.DeviceOrientationEvent.requestPermission = async () => { prompts++; return 'granted'; };
  const update = mount(p => hooks.sensor(p.active), { active: true }); await act(async () => value.enable());
  act(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 90, absolute: false, webkitCompassAccuracy: -1 })));
  assert.equal(value.heading, null); advance(5001); await act(async () => value.enable());
  act(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { webkitCompassHeading: 90, webkitCompassAccuracy: 5 })));
  assert.equal(value.heading, 90); assert.equal(value.status, 'ready');
  window.screen.orientation.angle = 90;
  act(() => window.dispatchEvent(Object.assign(new Event('deviceorientationabsolute'), { alpha: 270, absolute: true })));
  assert.equal(value.heading, 180);
  update({ active: false }); update({ active: true }); assert.equal(value.status, 'waiting');
  advance(5001); assert.equal(value.status, 'unavailable'); assert.equal(prompts, 1);
});
test('orientation unexpected activation errors are retryable errors, not fabricated permission denials', async () => {
  window.DeviceOrientationEvent.requestPermission = async () => { throw new TypeError('synthetic'); };
  mount(() => hooks.sensor()); await act(async () => value.enable()); assert.equal(value.status, 'error');
  window.DeviceOrientationEvent.requestPermission = async () => 'granted'; await act(async () => value.enable()); assert.equal(value.status, 'waiting');
});
test('same permission dialog permits GPS and sensor retries after failure without allowing overlapping taps', () => {
  let locationCalls = 0, sensorCalls = 0;
  const nav = status => ({ consent: true, enabled: true, settingsReady: true, sharingAllowed: true, state: 'connected', gps: { status, point: null, supported: true }, start: () => locationCalls++ });
  const sensor = status => ({ supported: true, heading: null, enabled: true, status, enable: () => sensorCalls++ });
  const render = (status, sensorStatus) => React.createElement(hooks.LanguageProvider, { lang: 'en' }, React.createElement(hooks.Popup, { view: 'compass', navigation: nav(status), sensor: sensor(sensorStatus), navigate() {} }));
  act(() => { tree = Renderer.create(render('timeout', 'unavailable'), { createNodeMock: () => Object.assign(new EventTarget(), { focus() {}, querySelectorAll: () => [] }) }); });
  const button = label => tree.root.findAllByType('button').find(b => b.children.join('') === label);
  act(() => { button('Try again').props.onClick(); button('Try again').props.onClick(); button('Enable compass sensor').props.onClick(); button('Enable compass sensor').props.onClick(); });
  assert.equal(locationCalls, 1); assert.equal(sensorCalls, 1);
  act(() => tree.update(render('loading', 'waiting'))); assert.ok(button('Finding your location…').props.disabled);
  act(() => tree.update(render('denied', 'unavailable'))); assert.equal(button('Try again').props.disabled, false);
  act(() => { button('Try again').props.onClick(); button('Enable compass sensor').props.onClick(); }); assert.equal(locationCalls, 2); assert.equal(sensorCalls, 2);
});
test('the dialog releases its sensor click guard even when repeated synchronous failures keep the same error status', async () => {
  let calls = 0; window.DeviceOrientationEvent.requestPermission = () => { calls++; throw new TypeError('synthetic activation failure'); };
  function Probe() {
    const sensor = hooks.sensor();
    return React.createElement(hooks.Popup, { view: 'compass', navigation: { consent: true, enabled: true, gps: { status: 'ready', point: { latitude: 24, longitude: 46 } }, settingsReady: true, sharingAllowed: true, state: 'connected' }, sensor, navigate() {} });
  }
  act(() => { tree = Renderer.create(React.createElement(hooks.LanguageProvider, { lang: 'en' }, React.createElement(Probe)), { createNodeMock: () => Object.assign(new EventTarget(), { focus() {}, querySelectorAll: () => [] }) }); });
  for (let i = 1; i <= 3; i++) {
    const button = tree.root.findAllByType('button').find(b => b.children.join('') === 'Enable compass sensor');
    assert.equal(button.props.disabled, false);
    await act(async () => { button.props.onClick(); await Promise.resolve(); });
    assert.equal(calls, i);
  }
});
