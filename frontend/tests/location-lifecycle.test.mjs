import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { locationVisible, visibleLocations, locationStatus, locationLabel } from '../src/utils/navigationCalculations.js';
const require = createRequire(import.meta.url);
const code = await build({ stdin: { contents: "export {default as group} from './src/hooks/useGroupLocations.js'; export {default as walking} from './src/hooks/useWalkingRoute.js'; export {createLocationPublisher} from './src/services/locationService.js';", resolveDir: new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') }, bundle: true, write: false, format: 'esm', define: { 'import.meta.env.VITE_API_BASE_URL': "''" }, plugins: [{ name: 'react', setup(b) { b.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true })); } }] });
const hooks = await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text).toString('base64'));
let now, tree, value, mode, rows, settings, groupSharing, watches, saved, intervals, gpsSuccess;
const base = Date.parse('2026-11-01T13:00:00Z');
const point = patch => ({ userId: 2, name: 'Synthetic member', latitude: 24, longitude: 46, accuracy: 5, sharingEnabled: true, recordedAt: new Date(base).toISOString(), visibilityMode: 'ALWAYS', visibleUntil: null, ...patch });
const originals = new Map(['window', 'document', 'navigator', 'fetch', 'setInterval', 'clearInterval'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const originalNow = Date.now;
const flush = () => act(async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); });
function mount(hook, props) { function Probe(input) { value = hook(input); return null; } act(() => { tree = Renderer.create(React.createElement(Probe, props)); }); return next => act(() => tree.update(React.createElement(Probe, next))); }
function clock(time) { now = typeof time === 'string' ? Date.parse(time) : time; act(() => { for (const callback of [...intervals.values()]) callback(); }); }
function props(id = 1, groupId = 10) { return { user: { id }, group: { id: groupId, status: 'ACTIVE' }, active: true, sharing: settings, groupSharing, onSessionExpired() {} }; }
beforeEach(() => {
  now = base; mode = 'ok'; watches = 0; saved = []; rows = [point()]; settings = { sharingEnabled: true, sharingMode: 'ALWAYS', isPaused: false, updateIntervalSeconds: 15 }; groupSharing = { sharingEnabled: true }; intervals = new Map(); let intervalId = 0;
  Date.now = () => now;
  globalThis.setInterval = callback => { const id = ++intervalId; intervals.set(id, callback); return id; }; globalThis.clearInterval = id => intervals.delete(id);
  globalThis.window = Object.assign(new EventTarget(), { isSecureContext: true }); globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, permissions: { query: async () => ({ state: 'granted' }) }, geolocation: { watchPosition(ok) { watches++; gpsSuccess = ok; return watches; }, clearWatch() {} } } });
  globalThis.fetch = async (url, options = {}) => {
    if (mode === 'network') throw new Error('offline');
    if (mode === 'forbidden') return new Response(JSON.stringify({ message: 'You are not a member of this group' }), { status: 403 });
    const body = url.endsWith('/csrf') ? { token: 'synthetic', headerName: 'X-CSRF-TOKEN' } : url.endsWith('/sharing') ? settings : url.includes('/sharing/group/') ? groupSharing : url.includes('/location/group/') ? rows : url.includes('/meeting-point/') ? { name: 'Fixed gate', latitude: 24, longitude: 46 } : url.includes('/group-member/') ? [] : url.endsWith('/location/update') ? (saved.push(JSON.parse(options.body)), {}) : { id: 10, status: 'ACTIVE' };
    return new Response(JSON.stringify(body));
  };
});
afterEach(() => {
  if (tree) act(() => tree.unmount()); tree = null; Date.now = originalNow;
  for (const [key, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
});
test('visibility fails safely for missing, invalid or contradictory expiration metadata', () => {
  for (const patch of [{ visibleUntil: undefined }, { visibleUntil: 123 }, { visibleUntil: false }, { visibleUntil: 'invalid' }, { visibleUntil: new Date(base).toISOString() }, { sharingEnabled: false }, { latitude: null }, { recordedAt: 'invalid' }]) assert.equal(locationVisible(point(patch), base), false);
  const missing=point(); delete missing.visibleUntil; assert.equal(locationVisible(missing,base),false);
  assert.equal(locationVisible(point(), base + 1000 * 60 * 60 * 24), true);
});
test('scheduled and lease locations expire at exact server-provided boundaries independently of coordinate freshness', () => {
  const scheduled = point({ visibilityMode: 'SCHEDULED', visibleUntil: '2026-11-01T19:00:00Z' });
  assert.equal(locationVisible(scheduled, Date.parse('2026-11-01T18:59:59Z')), true); assert.equal(locationVisible(scheduled, Date.parse('2026-11-01T19:00:00Z')), false);
  const lease = point({ visibilityMode: 'WHILE_USING', visibleUntil: new Date(base + 90000).toISOString() });
  assert.equal(locationVisible(lease, base + 89999), true); assert.equal(locationVisible(lease, base + 90000), false);
});
test('last-known and offline labels never claim Live and show the actual localized recorded timestamp', () => {
  for (const lang of ['ar', 'en', 'fr']) {
    assert.notEqual(locationStatus(point(), base, true, lang), locationStatus(point(), base + 31000, true, lang));
    assert.notEqual(locationStatus(point(), base, true, lang), locationStatus(point(), base, false, lang));
    assert.ok(!locationStatus(point(), base + 31000, false, lang).includes('Live'));
    assert.notEqual(locationLabel(point(), base, lang), '');
  }
});
test('cached scheduled location survives disconnect, expires offline at 22:00, and retains the fixed meeting point', async () => {
  settings = { ...settings, sharingMode: 'SCHEDULED', startTime: new Date(base).toISOString(), endTime: '2026-11-01T19:00:00Z' };
  rows = [point({ visibilityMode: 'SCHEDULED', visibleUntil: settings.endTime })]; mount(hooks.group, props()); await flush(); assert.equal(value.rows.length, 1);
  mode = 'network'; navigator.onLine = false; act(() => window.dispatchEvent(new Event('offline'))); await flush(); assert.equal(value.state, 'offline');
  clock('2026-11-01T15:00:00Z'); assert.equal(value.rows.length, 1); clock('2026-11-01T18:59:59Z'); assert.equal(value.rows.length, 1);
  clock('2026-11-01T19:00:00Z'); assert.equal(value.rows.length, 0); assert.equal(value.expired, true); assert.equal(value.meeting.name, 'Fixed gate');
});
test('ALWAYS retains an old last-known location offline but revalidation purges a remote revocation', async () => {
  mount(hooks.group, props()); await flush(); mode = 'network'; navigator.onLine = false; act(() => window.dispatchEvent(new Event('offline'))); await flush();
  clock(base + 86400000); assert.equal(value.rows.length, 1); assert.equal(locationStatus(value.rows[0], now, false, 'en'), 'Last known location · cached while offline');
  mode = 'ok'; rows = [point({ sharingEnabled: false, latitude: null, longitude: null })]; navigator.onLine = true;
  act(() => window.dispatchEvent(new Event('online'))); assert.equal(value.rows.length, 0); await flush(); assert.equal(value.state, 'connected'); assert.equal(value.rows.length, 0);
});
test('WHILE_USING disappears offline after its finite lease without a close event', async () => {
  rows = [point({ visibilityMode: 'WHILE_USING', visibleUntil: new Date(base + 90000).toISOString() })]; mount(hooks.group, props()); await flush();
  mode = 'network'; navigator.onLine = false; act(() => window.dispatchEvent(new Event('offline'))); await flush(); clock(base + 89999); assert.equal(value.rows.length, 1); clock(base + 90000); assert.equal(value.rows.length, 0);
});
test('foreground recovery hides expired coordinates before a suspended interval gets another tick', async () => {
  rows=[point({visibleUntil:new Date(base+90000).toISOString()})]; mount(hooks.group,props()); await flush();
  document.hidden=true; act(()=>document.dispatchEvent(new Event('visibilitychange')));
  now=base+90000; mode='network'; navigator.onLine=false; document.hidden=false;
  act(()=>document.dispatchEvent(new Event('visibilitychange'))); await flush();
  assert.equal(value.rows.length,0); assert.equal(value.meeting.name,'Fixed gate');
});
test('account/group changes, logout and authorization failure cannot restore another scope cache', async () => {
  const update = mount(hooks.group, props()); await flush(); assert.equal(value.rows.length, 1); mode = 'network';
  update(props(2, 11)); assert.equal(value.rows.length, 0); await flush(); assert.equal(value.rows.length, 0);
  update({ ...props(2, 11), user: null, group: null, active: false }); assert.equal(value.rows.length, 0); assert.equal(value.meeting, null);
  mode = 'ok'; update(props()); await flush(); assert.equal(value.rows.length, 1);
  mode = 'forbidden'; act(() => window.dispatchEvent(new Event('online'))); await flush(); assert.equal(value.rows.length, 0); assert.equal(value.meeting, null);
});
test('an in-flight snapshot from before successful local revocation cannot restore its rows or settings', async () => {
  const originalFetch = globalThis.fetch; let release, snapshots = 0;
  globalThis.fetch = async (url, options) => {
    if (url.includes('/location/group/')) { await new Promise(resolve => { release = resolve; }); return new Response(JSON.stringify([point()])); }
    return originalFetch(url, options);
  };
  const update = mount(hooks.group, { ...props(), onSnapshot() { snapshots++; } }); await flush(); assert.equal(typeof release, 'function');
  settings = { ...settings, sharingEnabled: false, isPaused: true }; update({ ...props(), onSnapshot() { snapshots++; } });
  await act(async () => { release(); for (let i = 0; i < 30; i++) await Promise.resolve(); });
  assert.equal(value.rows.length, 0); assert.equal(snapshots, 0); assert.equal(value.enabled, false);
});
test('local stop or a new schedule clears only the owner period, retaining other authorized group members', async () => {
  rows=[point({userId:1}),point()]; const update=mount(hooks.group,props()); await flush(); assert.equal(value.rows.length,2);
  settings={...settings,sharingEnabled:false,isPaused:true}; update(props()); assert.deepEqual(value.rows.map(row=>row.userId),[2]);
  settings={...settings,sharingEnabled:true,isPaused:false,sharingMode:'SCHEDULED',startTime:new Date(base+3600000).toISOString(),endTime:new Date(base+7200000).toISOString()}; update(props()); assert.deepEqual(value.rows.map(row=>row.userId),[2]); assert.equal(value.consent,false);
});
test('stationary activity heartbeat posts the unchanged GPS measurement every 30 seconds and bounds retries', async () => {
  const sample = point(), posted = []; const publisher = hooks.createLocationPublisher(async input => posted.push(input), () => now);
  assert.equal(await publisher.publish(sample, 120000), true); now += 29999; assert.equal(await publisher.publish(sample, 120000), false); now++;
  assert.equal(await publisher.publish(sample, 120000), true); assert.equal(posted[1].recordedAt, posted[0].recordedAt); assert.equal(posted[1], sample);
});
test('GPS reconnect resumes only a previously granted permission and does not auto prompt when a grant is absent', async () => {
  mount(hooks.group, props()); await flush(); act(() => value.start()); act(() => gpsSuccess({ coords: { latitude: 24, longitude: 46, accuracy: 5 }, timestamp: now })); await flush(); assert.equal(watches, 1);
  mode = 'network'; navigator.onLine = false; act(() => window.dispatchEvent(new Event('offline'))); await flush(); mode = 'ok'; navigator.onLine = true; act(() => window.dispatchEvent(new Event('online'))); await flush(); assert.equal(watches, 2);
  mode = 'network'; navigator.onLine = false; act(() => window.dispatchEvent(new Event('offline'))); await flush(); navigator.permissions.query = async () => ({ state: 'prompt' }); mode = 'ok'; navigator.onLine = true; act(() => window.dispatchEvent(new Event('online'))); await flush(); assert.equal(watches, 2); assert.equal(value.consent, false);
});
test('stale member or missing visibility authorization cannot initiate a new route; fixed points remain usable', () => {
  const own = { latitude: 24, longitude: 46, recordedAt: new Date(base).toISOString() };
  const update = mount(hooks.walking, { own, target: point({ recordedAt: new Date(base - 30001).toISOString() }), groupId: 10, consent: true, online: true, now: base });
  act(() => value.start()); assert.equal(value.available, false); assert.equal(value.result, null);
  update({ own, target: point({ visibleUntil: undefined }), groupId: 10, consent: true, online: true, now: base }); assert.equal(value.available, false);
  update({ own, target: { name: 'Fixed gate', latitude: 24.001, longitude: 46 }, groupId: 10, consent: true, online: true, now: base }); assert.equal(value.available, true);
});
test('pending routes are invalidated when a member ages or its known visibility lease expires', async () => {
  for (const [target, elapsed] of [[point(), 30001], [point({ visibilityMode: 'WHILE_USING', visibleUntil: new Date(base + 1000).toISOString() }), 1000]]) {
    if (tree) act(() => tree.unmount()); let release;
    globalThis.fetch = async url => {
      if (url.endsWith('/csrf')) return new Response(JSON.stringify({ token: 'synthetic', headerName: 'X-CSRF-TOKEN' }));
      await new Promise(resolve => { release = resolve; });
      return new Response(JSON.stringify({ status: 'READY', coordinates: [[24,46],[24.001,46]], distanceMeters: 100, durationSeconds: 80 }));
    };
    now = base; const own = { latitude: 24, longitude: 46, recordedAt: new Date(base).toISOString() };
    const props = { own, target, groupId: 10, online: true, consent: true, now: base };
    const update = mount(hooks.walking, props); act(() => value.start());
    await act(async () => new Promise(resolve => setTimeout(resolve, 900))); assert.equal(typeof release, 'function');
    now = base + elapsed; update({ ...props, own: { ...own, recordedAt: new Date(now).toISOString() }, now });
    assert.equal(value.available, false); assert.equal(value.result, null);
    await act(async () => { release(); for (let i = 0; i < 30; i++) await Promise.resolve(); });
    assert.equal(value.result, null); assert.equal(value.guiding, false);
  }
});
