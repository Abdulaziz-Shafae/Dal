import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { nearestGroupMember } from '../src/utils/nearestGroupMember.js';
import { bearingBetween, distanceBetween } from '../src/utils/navigationCalculations.js';
import { translate } from '../src/i18n.js';

const now = Date.now(), point = { latitude: 0, longitude: 0, accuracy: 5, recordedAt: new Date(now).toISOString() };
const members = [{ userId: 1, name: 'Self' }, { userId: 2, name: 'Far member' }, { userId: 3, name: 'Near member' }];
const rows = members.map((member, i) => ({ ...member, ...point, longitude: i === 1 ? .002 : i === 2 ? .001 : 0, sharingEnabled: true }));
const options = { own: point, rows, members, userId: 1, groupId: 10, now };
test('nearest uses the existing direct distance, excludes self and ignores unrelated rows/meeting points', () => {
  const result = nearestGroupMember({ ...options, members: [...members, { name: 'Meeting point' }], rows: [...rows, { ...point, userId: 99, sharingEnabled: true }, { ...point, name: 'Meeting point', sharingEnabled: true }] });
  assert.equal(result.member, members[2]); assert.equal(result.distanceMeters, distanceBetween(point, rows[2]));
  assert.equal(bearingBetween(point, rows[2]), 90);
});
test('unshared, missing, invalid, stale and foreign-group positions cannot win', () => {
  for (const patch of [{ sharingEnabled: false }, { sharingEnabled: undefined }, { latitude: null }, { latitude: 91 }, { longitude: '0' }, { recordedAt: new Date(now - 30001).toISOString() }, { recordedAt: 'invalid' }, { groupId: 11 }]) {
    assert.equal(nearestGroupMember({ ...options, rows: [rows[0], rows[1], { ...rows[2], ...patch }] }).member.userId, 2);
  }
  assert.equal(nearestGroupMember({ ...options, rows: rows.slice(0, 2) }).member.userId, 2);
  assert.equal(nearestGroupMember({ ...options, members: [members[0], members[1], { ...members[2], groupId: 11 }] }).member.userId, 2);
});
test('30-second freshness boundary matches Compass warnings, and zero distance is valid', () => {
  assert.equal(nearestGroupMember({ ...options, rows: [rows[0], { ...rows[2], longitude: 0, recordedAt: new Date(now - 30000).toISOString() }] }).distanceMeters, 0);
});
test('no eligible member or missing/stale GPS returns no selection', () => {
  for (const own of [null, { ...point, latitude: NaN }, { ...point, recordedAt: new Date(now - 30001).toISOString() }]) assert.equal(nearestGroupMember({ ...options, own }), null);
  assert.equal(nearestGroupMember({ ...options, rows: [rows[0]] }), null);
});

const require = createRequire(import.meta.url);
const code = await build({ stdin: { contents: "export {default as Navigation} from './src/components/navigation/GroupNavigation.jsx'; export {LanguageProvider} from './src/LanguageContext.jsx';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, write: false, format: 'esm', loader: { '.css': 'empty' }, define: { 'import.meta.env.VITE_API_BASE_URL': "''" }, plugins: [{ name: 'fixture', setup(b) {
  b.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true }));
  b.onResolve({ filter: /^react-leaflet$/ }, () => ({ path: 'map', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const MapContainer=()=>null,TileLayer=()=>null,CircleMarker=()=>null,Popup=()=>null,Tooltip=()=>null,Polyline=()=>null,useMap=()=>({}),useMapEvents=()=>({});' }));
} }] });
const { Navigation, LanguageProvider } = await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text).toString('base64'));
let tree, selected, selectedCalls, nativeCalls, apiCalls, props;
const originals = new Map(['window', 'document', 'navigator', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
const button = label => tree.root.findAllByType('button').find(node => text(node) === label);
const nearestButton = () => button(translate('وجّهني لأقرب عضو', props.lang));
const compass = () => tree.root.findByProps({ className: 'dal-live-compass has-heading' });
function Probe({ lang, ...rest }) {
  const [target, setTarget] = React.useState(members[1]); selected = target;
  return React.createElement(LanguageProvider, { lang }, React.createElement(Navigation, { ...rest, selected: target, onSelect(member) { selectedCalls++; setTarget(member); } }));
}
function update(patch = {}) { props = { ...props, ...patch }; act(() => tree.update(React.createElement(Probe, props))); }
function mount(patch = {}) {
  const fresh = new Date().toISOString();
  props = { view: 'compass', lang: 'en', user: { id: 1 }, group: { id: 10, myRole: 'MEMBER', status: 'ACTIVE' }, members,
    navigation: { rows: rows.map(row => ({ ...row, recordedAt: fresh })), meeting: { ...point, name: 'Meeting point' }, state: 'connected', now: Date.now(), consent: true, enabled: true, settingsReady: true, sharingAllowed: true, gps: { status: 'ready', point: { ...point, recordedAt: fresh } }, start() { nativeCalls++; }, stop() {} },
    sensor: { enabled: true, status: 'ready', heading: 0, enable() { nativeCalls++; } }, navigate() {}, nudge() {}, arrived() {}, onError() {}, ...patch };
  act(() => { tree = Renderer.create(React.createElement(Probe, props), { createNodeMock: () => Object.assign(new EventTarget(), { focus() {}, querySelectorAll: () => [] }) }); });
}
beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), { isSecureContext: true, DeviceOrientationEvent: class {} });
  globalThis.document = Object.assign(new EventTarget(), { hidden: false, activeElement: null, body: { style: { overflow: '' } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {} } });
  selectedCalls = 0; nativeCalls = 0; apiCalls = [];
  globalThis.fetch = async url => { apiCalls.push(url); return new Response(JSON.stringify(url.endsWith('/csrf') ? { token: 'synthetic', headerName: 'X-CSRF-TOKEN' } : {})); };
});
afterEach(() => {
  if (tree) act(() => tree.unmount()); tree = null;
  for (const [key, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
});
test('action reuses selected member and Compass bearing/distance, stays stable as GPS moves, and manual selection works', () => {
  mount(); act(() => nearestButton().props.onClick()); assert.equal(selected.userId, 3); assert.equal(selectedCalls, 1);
  assert.equal(compass().findByProps({ className: 'dal-direction-arrow' }).props.style.transform, 'rotate(90deg)');
  assert.match(text(compass().findByProps({ className: 'nearest-member-feedback', role: 'status' })), /Near member.*111 m/);
  update({ navigation: { ...props.navigation, gps: { status: 'ready', point: { ...props.navigation.gps.point, longitude: .002 } } } });
  assert.equal(selected.userId, 3); assert.equal(selectedCalls, 1);
  act(() => tree.root.findAllByType('button').find(node => node.props['aria-pressed'] === false && text(node).includes('Far member')).props.onClick());
  assert.equal(selected.userId, 2); assert.equal(compass().findAllByProps({ className: 'nearest-member-feedback' }).length, 0);
});
test('nearest cancels existing walking preview and never calls ORS or activates native permissions', async () => {
  mount(); const manual = tree.root.findAllByType('button').find(node => node.props['aria-pressed'] === true);
  act(() => manual.props.onClick()); act(() => nearestButton().props.onClick());
  await act(async () => new Promise(done => setTimeout(done, 950)));
  assert.equal(selected.userId, 3); assert.deepEqual(apiCalls, []); assert.equal(nativeCalls, 0);
});
test('missing GPS uses the existing permission dialog without using cached own coordinates or changing target', () => {
  mount(); update({ navigation: { ...props.navigation, consent: false, enabled: false, gps: { status: 'idle', point: null } } });
  act(() => nearestButton().props.onClick()); assert.equal(selected.userId, 2); assert.equal(selectedCalls, 0); assert.equal(nativeCalls, 0);
  assert.equal(tree.root.findAllByProps({ role: 'dialog' }).length, 1); assert.ok(button('Enable location'));
  assert.match(text(compass()), /Enable your location/);
});
test('stale live GPS and no eligible members keep the selected target unchanged', () => {
  mount(); update({ navigation: { ...props.navigation, gps: { status: 'ready', point: { ...point, recordedAt: new Date(Date.now() - 31000).toISOString() } } } });
  act(() => nearestButton().props.onClick()); assert.equal(selected.userId, 2); assert.match(text(compass()), /fresh GPS/);
  update({ navigation: { ...props.navigation, gps: { status: 'ready', point: { ...point, recordedAt: new Date().toISOString() } }, rows: [rows[0]] } });
  act(() => nearestButton().props.onClick()); assert.equal(selected.userId, 2); assert.equal(selectedCalls, 0); assert.match(text(compass()), /No other member/);
});
test('low accuracy feedback and nearest control translate immediately in all three languages', () => {
  mount(); update({ navigation: { ...props.navigation, gps: { ...props.navigation.gps, point: { ...props.navigation.gps.point, accuracy: 80 } } } });
  act(() => nearestButton().props.onClick()); assert.match(text(compass()), /Low location accuracy/);
  for (const lang of ['fr', 'ar', 'en']) { update({ lang }); assert.ok(nearestButton()); assert.equal(tree.root.findByType('section').props.dir, lang === 'ar' ? 'rtl' : 'ltr'); }
});
test('revoked target location removes confirmation without exposing inaccessible coordinates', () => {
  mount(); act(() => nearestButton().props.onClick());
  update({ navigation: { ...props.navigation, rows: props.navigation.rows.filter(row => row.userId !== 3) } });
  assert.equal(selected.userId, 3); assert.equal(compass().findAllByProps({ className: 'nearest-member-feedback' }).length, 0);
  assert.equal(compass().findAllByProps({ className: 'dal-direction-arrow' }).length, 0);
});
