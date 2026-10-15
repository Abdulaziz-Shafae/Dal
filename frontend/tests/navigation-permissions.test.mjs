import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { navigationRequirements } from '../src/utils/navigationPermissions.js';
const require = createRequire(import.meta.url);
const code = await build({ stdin: { contents: "export {default as Popup} from './src/components/navigation/NavigationPermissionDialog.jsx'; export {LanguageProvider} from './src/LanguageContext.jsx'; export {default as useOrientation} from './src/hooks/useDeviceOrientation.js';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, write: false, format: 'esm', plugins: [{ name: 'react', setup(builder) { builder.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true })); } }] });
const { Popup, LanguageProvider, useOrientation } = await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text).toString('base64'));
const point = { latitude: 24.7, longitude: 46.6 };
const gps = active => ({ consent: active, enabled: active, gps: { status: active ? 'ready' : 'idle', point: active ? point : null }, state: 'connected', settingsReady: true, sharingAllowed: true });
const orientation = active => ({ enabled: active, status: active ? 'ready' : 'idle', heading: active ? 45 : null });
for (const [view, location, sensor, expected] of [
  ['map', false, false, { location: true, sensor: false }], ['map', true, false, { location: false, sensor: false }],
  ['compass', false, false, { location: true, sensor: true }], ['compass', true, false, { location: false, sensor: true }],
  ['compass', false, true, { location: true, sensor: false }], ['compass', true, true, { location: false, sensor: false }]
]) test(`requirements: ${view}, GPS ${location}, sensor ${sensor}`, () => assert.deepEqual(navigationRequirements(view, gps(location), orientation(sensor)), expected));

let tree, locationCalls, sensorCalls, navigations;
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
const button = label => tree.root.findAllByType('button').find(node => text(node) === label);
const dialogCount = () => tree.root.findAllByProps({ role: 'dialog' }).length;
function render({ view = 'compass', navigation = gps(false), sensor = orientation(false), lang = 'en' } = {}) {
  return React.createElement(LanguageProvider, { lang }, React.createElement(Popup, { key: view, view, navigation: { ...navigation, start: () => locationCalls++ }, sensor: { ...sensor, enable: () => sensorCalls++ }, navigate: page => navigations.push(page) }));
}
function mount(props) { act(() => { tree = Renderer.create(render(props), { createNodeMock: () => Object.assign(new EventTarget(), { focus() {}, querySelectorAll: () => [] }) }); }); }
beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), { isSecureContext: true, DeviceOrientationEvent: class {}, screen: { orientation: { angle: 0 } } });
  globalThis.document = Object.assign(new EventTarget(), { hidden: false, activeElement: null, body: { style: { overflow: '' } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {} } });
  locationCalls = 0; sensorCalls = 0; navigations = [];
});
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });
test('opening and dismissing never activate features; dismissal persists until new page entry', () => {
  mount(); assert.equal(dialogCount(), 1); assert.equal(locationCalls + sensorCalls, 0);
  act(() => button('Not now').props.onClick()); assert.equal(dialogCount(), 0);
  act(() => tree.update(render({ sensor: { ...orientation(false), status: 'unavailable' } }))); assert.equal(dialogCount(), 0);
  act(() => tree.update(render({ view: 'map' }))); assert.equal(dialogCount(), 1); assert.equal(locationCalls + sensorCalls, 0);
});
test('separate feature buttons make at most one attempt per page visit', () => {
  mount(); const location = button('Enable location'), sensor = button('Enable compass sensor');
  act(() => { location.props.onClick(); location.props.onClick(); sensor.props.onClick(); sensor.props.onClick(); });
  assert.equal(locationCalls, 1); assert.equal(sensorCalls, 1);
  assert.ok(button('Enable location').props.disabled); assert.ok(button('Enable compass sensor').props.disabled);
});

test('Escape dismisses even when a pending permission button has lost focus', () => {
  mount(); act(() => button('Enable compass sensor').props.onClick());
  assert.ok(button('Enable compass sensor').props.disabled);
  const escape = new Event('keydown'); Object.defineProperty(escape, 'key', { value: 'Escape' });
  act(() => document.dispatchEvent(escape)); assert.equal(dialogCount(), 0);
  assert.equal(sensorCalls, 1); assert.equal(locationCalls, 0);
});
test('disabled sharing routes to existing settings without changing or activating anything', () => {
  mount({ navigation: { ...gps(false), sharingAllowed: false } });
  assert.ok(button('Enable location').props.disabled); act(() => button('Enable location').props.onClick()); assert.equal(locationCalls, 0);
  act(() => button('Account settings').props.onClick()); act(() => button('Group sharing settings').props.onClick());
  assert.deepEqual(navigations, ['settings', 'group']);
});
test('successful activation closes the popup once, without reopening on later lost readings', () => {
  mount(); act(() => tree.update(render({ navigation: gps(true), sensor: orientation(true) }))); assert.equal(dialogCount(), 0);
  act(() => tree.update(render({ navigation: gps(true), sensor: orientation(false) }))); assert.equal(dialogCount(), 0);
});
test('Map does not flash a popup while previously consented GPS resumes', () => {
  mount({ view: 'map', navigation: { ...gps(true), gps: { status: 'loading', point: null } } });
  assert.equal(dialogCount(), 0); assert.equal(locationCalls + sensorCalls, 0);
});
test('loading, waiting, denied and unsupported states explain missing requirements', () => {
  mount({ navigation: { ...gps(false), consent: true, gps: { status: 'loading', point: null } }, sensor: { ...orientation(false), status: 'waiting' } });
  assert.ok(text(tree.toJSON()).includes('Finding your location')); assert.ok(button('Enable location').props.disabled); assert.ok(button('Enable compass sensor').props.disabled);
  act(() => tree.update(render({ navigation: { ...gps(false), gps: { status: 'denied', point: null, error: 'إذن الموقع مرفوض. اسمح بالموقع من إعدادات المتصفح ثم أعد المحاولة.' } }, sensor: { ...orientation(false), status: 'denied' } })));
  assert.ok(text(tree.toJSON()).includes('Location permission denied')); assert.ok(text(tree.toJSON()).includes('Sensor permission denied'));
  window.DeviceOrientationEvent = undefined;
  act(() => tree.update(render())); assert.equal(button('Enable compass sensor'), undefined); assert.ok(text(tree.toJSON()).includes('not supported in this browser'));
});
test('popup copy and direction update immediately through the existing language provider', () => {
  mount(); assert.equal(tree.root.findByProps({ className: 'modal-backdrop' }).props.dir, 'ltr');
  act(() => tree.update(render({ lang: 'fr' }))); assert.ok(button('Pas maintenant')); assert.ok(button('Activer la localisation'));
  act(() => tree.update(render({ lang: 'ar' }))); assert.ok(button('ليس الآن')); assert.equal(tree.root.findByProps({ className: 'modal-backdrop' }).props.dir, 'rtl'); assert.equal(locationCalls + sensorCalls, 0);
});
test('orientation serializes pending requests and reuses a grant after unavailable readings', async () => {
  let value, resolve, prompts = 0;
  window.DeviceOrientationEvent.requestPermission = () => { prompts++; return new Promise(done => { resolve = done; }); };
  function Probe() { value = useOrientation(); return null; }
  act(() => { tree = Renderer.create(React.createElement(Probe)); });
  let pending; act(() => { pending = value.enable(); value.enable(); }); assert.equal(prompts, 1); assert.equal(value.status, 'requesting');
  await act(async () => { resolve('granted'); await pending; }); assert.equal(value.status, 'waiting');
  act(() => { document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); document.hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await act(async () => new Promise(done => setTimeout(done, 5100))); assert.equal(value.status, 'unavailable');
  await act(async () => value.enable()); assert.equal(prompts, 1);
});
